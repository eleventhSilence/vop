import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';
import { platformAssets } from '@/shared/config/platformAssets';

export const AccountLayout = () => {
  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid shell-grid--single">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
