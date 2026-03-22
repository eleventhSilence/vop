import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { LoginPayload, RegisterPayload, SessionUser, TokenPair } from '@/entities/auth/types';
import type { AuthState } from '@/features/auth/model/types';
import { authApi } from '@/shared/api/auth';
import { setHttpAuthHandlers } from '@/shared/api/http';
import { tokenStorage } from '@/shared/lib/auth/tokenStorage';

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<SessionUser>;
  logout: () => Promise<void>;
  updateUser: (user: SessionUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
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
    setState({
      user: null,
      tokens: null,
      isInitialized: true,
    });
  }, []);

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
      } catch (error) {
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

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
