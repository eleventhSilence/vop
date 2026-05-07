import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { SectionSidebar } from '@/widgets/navigation/SectionSidebar';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';
import { platformAssets } from '@/shared/config/platformAssets';

const accountNavItems = [
  { to: '/account/dashboard', label: 'Дашборд', end: true },
  { to: '/account/profile', label: 'Профиль', end: true },
  { to: '/account/courses', label: 'Мои курсы' },
  { to: '/account/reviews', label: 'Мои отзывы' },
];

export const AccountLayout = () => {
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? [...accountNavItems, { to: '/admin/dashboard', label: 'Админ-панель' }] : accountNavItems;
  const [isScrollCollapsed, setIsScrollCollapsed] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const shouldCollapse = window.scrollY > 100;
      setIsScrollCollapsed(shouldCollapse);
      if (!shouldCollapse) {
        setIsManualExpanded(false);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isCollapsed = isScrollCollapsed && !isManualExpanded;

  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid">
        <SectionSidebar
          title="Личный кабинет"
          items={navItems}
          isCollapsed={isCollapsed}
          onToggle={() => setIsManualExpanded((current) => !current)}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
