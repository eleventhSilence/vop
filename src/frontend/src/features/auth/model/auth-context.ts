import { createContext } from 'react';
import type { LoginPayload, RegisterPayload, SessionUser } from '@/entities/auth/types';
import type { AuthState } from '@/features/auth/model/types';

export type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<SessionUser>;
  logout: () => Promise<void>;
  updateUser: (user: SessionUser | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
