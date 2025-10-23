// Authentication service for FactuTable
import { CONFIG } from '../config';
export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface CognitoUser {
  email: string;
  name?: string;
  sub: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CognitoUser | null;
  tokens: CognitoTokens | null;
  error: string | null;
}

export class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    tokens: null,
    error: null,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  private setState(newState: Partial<AuthState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AuthState {
    return { ...this.state };
  }

  private async initialize() {
    this.setState({ isLoading: true });

    try {
      // Check if user is already authenticated
      const storedTokens = localStorage.getItem('cognito_tokens');
      const storedUser = localStorage.getItem('cognito_user');

      if (storedTokens && storedUser) {
        const tokens = JSON.parse(storedTokens);
        const user = JSON.parse(storedUser);
        
        this.setState({
          isAuthenticated: true,
          user,
          tokens,
          isLoading: false,
        });
        return;
      }

  // Check if we're returning from Cognito callback
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const success = urlParams.get('success') || hashParams.get('success');
  const tokensParam = urlParams.get('tokens') || hashParams.get('tokens');
  const userParam = urlParams.get('user') || hashParams.get('user');

  // Check for direct token parameters (from Lambda redirect) in either search or hash
  const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
  const idToken = urlParams.get('id_token') || hashParams.get('id_token');
  const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');

      if (success === 'true' && tokensParam && userParam) {
        // Old format: JSON encoded tokens
        await this.handleCallback(tokensParam, userParam);
      } else if (accessToken && idToken && refreshToken) {
        // New format: Direct token parameters
        console.debug('AuthService: detected direct tokens in URL/hash');
        await this.handleDirectTokens(accessToken, idToken, refreshToken);
      } else {
        this.setState({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
      this.setState({
        error: 'Failed to initialize authentication',
        isLoading: false,
      });
    }
  }

  private async handleCallback(tokensParam: string, userParam: string) {
    try {
      const tokens = JSON.parse(decodeURIComponent(tokensParam));
      const user = JSON.parse(decodeURIComponent(userParam));

      this.setState({
        isAuthenticated: true,
        user,
        tokens,
        isLoading: false,
        error: null,
      });

      // Store tokens and user info
      localStorage.setItem('cognito_tokens', JSON.stringify(tokens));
      localStorage.setItem('cognito_user', JSON.stringify(user));

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Callback handling failed:', error);
      this.setState({
        error: 'Failed to handle authentication callback',
        isLoading: false,
      });
    }
  }

  private async handleDirectTokens(accessToken: string, idToken: string, refreshToken: string) {
    try {
      // Tokens may be URL-encoded when redirected; decode if necessary
      const accessTokenRaw = decodeURIComponent(accessToken);
      const idTokenRaw = decodeURIComponent(idToken);
      const refreshTokenRaw = decodeURIComponent(refreshToken);

      // Decode the ID token to get user information
      const user = this.decodeJWT(idTokenRaw);
      
      const tokens: CognitoTokens = {
        accessToken: accessTokenRaw,
        idToken: idTokenRaw,
        refreshToken: refreshTokenRaw,
      };

      this.setState({
        isAuthenticated: true,
        user,
        tokens,
        isLoading: false,
        error: null,
      });

      // Store tokens and user info
      localStorage.setItem('cognito_tokens', JSON.stringify(tokens));
      localStorage.setItem('cognito_user', JSON.stringify(user));

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Direct token handling failed:', error);
      this.setState({
        error: 'Failed to handle authentication tokens',
        isLoading: false,
      });
    }
  }

  private decodeJWT(token: string): CognitoUser {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const payload = JSON.parse(jsonPayload);
      return {
        email: payload.email || payload['cognito:username'],
        name: payload.name || payload.given_name + ' ' + payload.family_name,
        sub: payload.sub,
      };
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      throw new Error('Invalid token format');
    }
  }

  async login() {
    try {
      this.setState({ isLoading: true, error: null });

      const cognitoConfig = CONFIG.COGNITO;
      const callbackEndpoint = CONFIG.COGNITO_CALLBACK_ENDPOINT;
      const clientId = encodeURIComponent(cognitoConfig.userPoolWebClientId);
      const redirectUri = encodeURIComponent(callbackEndpoint);
      const responseType = 'code';
      const scope = 'openid+email+profile';
      
      // Generate state parameter for security
      const state = this.generateState();
      localStorage.setItem('cognito_state', state);
      
      // Construct Cognito Hosted UI URL
      const cognitoUrl = `https://${cognitoConfig.domain}/oauth2/authorize?` +
        `response_type=${responseType}&` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `state=${state}`;
      
      // Redirect to Cognito Hosted UI
      window.location.href = cognitoUrl;
    } catch (error) {
      console.error('Login failed:', error);
      this.setState({
        error: 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  }

  async logout() {
    try {
      // Clear local storage
      localStorage.removeItem('cognito_tokens');
      localStorage.removeItem('cognito_user');
      localStorage.removeItem('cognito_state');
      
      this.setState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        error: null,
      });
      
      // Redirect to Cognito logout
      const cognitoConfig = CONFIG.COGNITO;
      
      const logoutUrl = `https://${cognitoConfig.domain}/logout?` +
        `client_id=${cognitoConfig.userPoolWebClientId}&` +
        `logout_uri=${encodeURIComponent(window.location.origin)}`;
      
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('Logout failed:', error);
      this.setState({
        error: 'Logout failed',
      });
    }
  }

  getAccessToken(): string | null {
    return this.state.tokens?.accessToken || null;
  }

  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
