import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginPayload, RegisterPayload, SessionUser, TokenPair } from '@/entities/auth/types';
import type { AuthState } from '@/features/auth/model/types';
import { AuthContext } from '@/features/auth/model/auth-context';
import { authApi } from '@/shared/api/auth';
import { setHttpAuthHandlers } from '@/shared/api/http';
import { tokenStorage } from '@/shared/lib/auth/tokenStorage';
import type { AuthContextValue } from '@/features/auth/model/auth-context';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: tokenStorage.getTokens(),
    isInitialized: false,
  });

  const persistSession = useCallback((payload: { user: SessionUser; tokens: TokenPair }) => {
    tokenStorage.setTokens(payload.tokens);
    setState({
      user: payload.user,
      tokens: payload.tokens,
      isInitialized: true,
    });
  }, []);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    sessionStorage.removeItem('postLoginRedirect');
    queryClient.clear();
    setState({
      user: null,
      tokens: null,
      isInitialized: true,
    });
  }, [queryClient]);

  useEffect(() => {
    setHttpAuthHandlers({
      onTokensUpdated: (tokens) => {
        setState((current) => ({ ...current, tokens }));
      },
      onUnauthorized: clearSession,
    });
  }, [clearSession]);

  useEffect(() => {
    const bootstrap = async () => {
      const tokens = tokenStorage.getTokens();
      if (!tokens) {
        setState({ user: null, tokens: null, isInitialized: true });
        return;
      }

      try {
        const user = await authApi.me();
        setState({ user, tokens: tokenStorage.getTokens(), isInitialized: true });
      } catch {
        clearSession();
      }
    };

    void bootstrap();
  }, [clearSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authApi.login(payload);
    persistSession(response);
    return response.user;
  }, [persistSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await authApi.register(payload);
    tokenStorage.setTokens(response.tokens);
    const user = await authApi.me();
    persistSession({ user, tokens: response.tokens });
    return user;
  }, [persistSession]);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefreshToken();
    try {
      if (refresh) {
        await authApi.logout(refresh);
      }
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateUser = useCallback((user: SessionUser | null) => {
    setState((current) => ({ ...current, user }));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAuthenticated: Boolean(state.user && state.tokens),
    isAdmin: state.user?.role === 'ADMIN',
    login,
    register,
    logout,
    updateUser,
  }), [login, logout, register, state, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
