// Configuration for the Factutable application
export const CONFIG = {
  // API Gateway endpoint for presigned URL generation
  API_GATEWAY_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod",
  
  // Lambda endpoint for Cognito callback (where Cognito redirects after login)
  COGNITO_CALLBACK_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod/auth/callback",
  
  // Cognito configuration
  COGNITO: {
    region: "us-east-1",
    userPoolId: "us-east-1_5M9YXKeOe",
    userPoolWebClientId: "7nilk1q7pj4k2adn54ocjhkg0u",
    domain: "factutable-auth.auth.us-east-1.amazoncognito.com" // Your Cognito domain
  },
  
  // S3 configuration for file uploads
  S3: {
    region: "us-east-1",
    bucket:"factu-table-facturas-98eb5c"
  }
};

// Authentication state management
export class AuthManager {
  constructor() {
    this.isAuthenticated = false;
    this.user = null;
    this.tokens = null;
  }

  // Initialize authentication
  async initialize() {
    try {
      // Check if user is already authenticated
      const storedTokens = localStorage.getItem('cognito_tokens');
      if (storedTokens) {
        this.tokens = JSON.parse(storedTokens);
        this.isAuthenticated = true;
        this.user = JSON.parse(localStorage.getItem('cognito_user') || '{}');
      }
      
      // Check if we're returning from Cognito callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code) {
        await this.handleCallback(code, state);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
      return false;
    }
  }

  // Login with Cognito Hosted UI
  async login() {
    try {
      const cognitoConfig = CONFIG.COGNITO;
      const redirectUri = encodeURIComponent(window.location.origin);
      const redirect = encodeURIComponent(CONFIG.COGNITO_CALLBACK_ENDPOINT);
      const clientId = encodeURIComponent(cognitoConfig.userPoolWebClientId);
      const responseType = 'code';
      const scope = 'openid+email+profile';
      
      // Generate state parameter for security
      const state = this.generateState();
      localStorage.setItem('cognito_state', state);
      
      // Construct Cognito Hosted UI URL
      const cognitoUrl = `https://${cognitoConfig.domain}/oauth2/authorize?` +
        `response_type=${responseType}&` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirect}&` +
        `scope=${scope}&` +
        `state=${state}`;
      
      // Redirect to Cognito Hosted UI
      window.location.href = cognitoUrl;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  // Handle callback from Cognito
  async handleCallback(code, state) {
    try {
      // Check if we have tokens in URL parameters (from lambda redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const tokensParam = urlParams.get('tokens');
      const userParam = urlParams.get('user');
      const success = urlParams.get('success');
      
      if (success === 'true' && tokensParam && userParam) {
        // We have tokens from the lambda redirect
        const tokens = JSON.parse(decodeURIComponent(tokensParam));
        const user = JSON.parse(decodeURIComponent(userParam));
        
        this.tokens = tokens;
        this.user = user;
        this.isAuthenticated = true;
        
        // Store tokens and user info
        localStorage.setItem('cognito_tokens', JSON.stringify(this.tokens));
        localStorage.setItem('cognito_user', JSON.stringify(this.user));
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        return true;
      }
      
      // Verify state parameter
      const storedState = localStorage.getItem('cognito_state');
      if (state !== storedState) {
        console.error('Invalid state parameter');
        return false;
      }
      
      // Clean up state
      localStorage.removeItem('cognito_state');
      
      // If we have a code but no tokens in URL, the lambda will handle the redirect
      // This should not happen in the current flow, but keeping for compatibility
      return false;
    } catch (error) {
      console.error('Callback handling failed:', error);
      return false;
    }
  }

  // Logout
  async logout() {
    try {
      // Clear local storage
      localStorage.removeItem('cognito_tokens');
      localStorage.removeItem('cognito_user');
      
      this.isAuthenticated = false;
      this.user = null;
      this.tokens = null;
      
      // Redirect to Cognito logout
      const cognitoConfig = CONFIG.COGNITO;
      const logoutUrl = `https://${cognitoConfig.domain}/logout?` +
        `client_id=${cognitoConfig.userPoolWebClientId}&` +
        `logout_uri=${encodeURIComponent(window.location.origin)}`;
      
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Generate random state parameter
  generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Get authorization header for API calls
  getAuthHeader() {
    if (this.tokens && this.tokens.accessToken) {
      return {
        'Authorization': `Bearer ${this.tokens.accessToken}`
      };
    }
    return {};
  }
}

// Create global auth manager instance
export const authManager = new AuthManager();
