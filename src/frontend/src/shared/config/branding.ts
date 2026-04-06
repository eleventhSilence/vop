import defaultHeroBackground from '@/shared/assets/hero-memory-bg.svg';
import defaultLogo from '@/shared/assets/vop-logo.svg';
import { env } from '@/shared/config/env';

export const brandingConfig = {
  defaultLogoUrl: defaultLogo,
  defaultHeroBackgroundUrl: defaultHeroBackground,
  logoUrl: env.brandLogoUrl ?? defaultLogo,
  heroBackgroundUrl: env.heroBackgroundUrl ?? defaultHeroBackground,
};
