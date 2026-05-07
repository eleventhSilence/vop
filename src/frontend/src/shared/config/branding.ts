import defaultHeroBackground from '@/shared/assets/hero-memory-bg.svg';
import defaultLogo from '@/shared/assets/vop-logo.svg';
import { env } from '@/shared/config/env';
import { platformAssets } from '@/shared/config/platformAssets';

export const brandingConfig = {
  defaultLogoUrl: defaultLogo,
  defaultHeroBackgroundUrl: defaultHeroBackground,
  logoUrl: env.brandLogoUrl ?? platformAssets.logo,
  heroBackgroundUrl: env.heroBackgroundUrl ?? platformAssets.heroBackground,
};
