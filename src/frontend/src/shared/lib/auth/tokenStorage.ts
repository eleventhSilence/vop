import type { TokenPair } from '@/entities/auth/types';

const ACCESS_KEY = 'vop_access_token';
const REFRESH_KEY = 'vop_refresh_token';

const hasWindow = typeof window !== 'undefined';

export const tokenStorage = {
  getAccessToken() {
    return hasWindow ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefreshToken() {
    return hasWindow ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  setTokens(tokens: TokenPair) {
    if (!hasWindow) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.access);
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh);
  },
  clear() {
    if (!hasWindow) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
  getTokens(): TokenPair | null {
    const access = this.getAccessToken();
    const refresh = this.getRefreshToken();

    if (!access || !refresh) {
      return null;
    }

    return { access, refresh };
  },
};
