import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenPair } from '@/entities/auth/types';
import { env } from '@/shared/config/env';
import { tokenStorage } from '@/shared/lib/auth/tokenStorage';

type AuthHandlers = {
  onTokensUpdated?: (tokens: TokenPair) => void;
  onUnauthorized?: () => void;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

let handlers: AuthHandlers = {};
let refreshPromise: Promise<TokenPair> | null = null;

export const setHttpAuthHandlers = (nextHandlers: AuthHandlers) => {
  handlers = nextHandlers;
};

const refreshTokens = async (): Promise<TokenPair> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) {
    throw new Error('No refresh token');
  }

  refreshPromise = axios
    .post<{ access: string }>(`${env.apiBaseUrl}/auth/refresh/`, { refresh })
    .then(({ data }) => {
      const nextTokens = {
        access: data.access,
        refresh,
      };
      tokenStorage.setTokens(nextTokens);
      handlers.onTokensUpdated?.(nextTokens);
      return nextTokens;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const access = tokenStorage.getAccessToken();

  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry || originalRequest.skipAuthRefresh) {
      return Promise.reject(error);
    }

    if (!tokenStorage.getRefreshToken()) {
      handlers.onUnauthorized?.();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const tokens = await refreshTokens();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${tokens.access}`;
      return http(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();
      handlers.onUnauthorized?.();
      return Promise.reject(refreshError);
    }
  },
);
