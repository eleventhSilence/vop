const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

const BRAND_LOGO_URL = import.meta.env.VITE_BRAND_LOGO_URL as string | undefined;
const HERO_BACKGROUND_URL = import.meta.env.VITE_HERO_BACKGROUND_URL as string | undefined;

const normalizeOptionalUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const env = {
  apiBaseUrl: API_BASE_URL.replace(/\/$/, ''),
  brandLogoUrl: normalizeOptionalUrl(BRAND_LOGO_URL),
  heroBackgroundUrl: normalizeOptionalUrl(HERO_BACKGROUND_URL),
};
