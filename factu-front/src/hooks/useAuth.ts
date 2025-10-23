import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import type { AuthState } from '../services/authService';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    const unsubscribe = authService.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  return {
    ...authState,
    login: () => authService.login(),
    logout: () => authService.logout(),
    getAccessToken: () => authService.getAccessToken(),
  };
}
