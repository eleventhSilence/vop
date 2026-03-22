export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';

export type SessionUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  registered_at?: string;
  last_login_at?: string | null;
  is_email_verified?: boolean;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
};

export type LoginResponse = {
  user: SessionUser;
  tokens: TokenPair;
};

export type RegisterResponse = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  tokens: TokenPair;
};
