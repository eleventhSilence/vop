import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';
import { platformAssets } from '@/shared/config/platformAssets';

export const PublicLayout = () => {
  return (
    <div className="app-shell app-shell--public" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <main className="content content--public">
        <Outlet />
      </main>
    </div>
  );
};
