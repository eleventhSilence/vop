const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export const env = {
  apiBaseUrl: API_BASE_URL.replace(/\/$/, ''),
};
