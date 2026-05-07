import { useEffect, useRef, useState } from 'react';
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

const EXPAND_THRESHOLD = 20;
const COLLAPSE_THRESHOLD = 100;
const MANUAL_OPEN_RELEASE_DELTA = 24;

export const AccountLayout = () => {
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? [...accountNavItems, { to: '/admin/dashboard', label: 'Админ-панель' }] : accountNavItems;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);

  const prevScrollYRef = useRef(0);
  const isSidebarCollapsedRef = useRef(isSidebarCollapsed);
  const manualOverrideRef = useRef(manualOverride);

  useEffect(() => {
    isSidebarCollapsedRef.current = isSidebarCollapsed;
  }, [isSidebarCollapsed]);

  useEffect(() => {
    manualOverrideRef.current = manualOverride;
  }, [manualOverride]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const prevY = prevScrollYRef.current;

      if (currentY <= EXPAND_THRESHOLD) {
        if (isSidebarCollapsedRef.current) {
          setIsSidebarCollapsed(false);
        }
        setManualOverride(null);
      } else if (currentY > COLLAPSE_THRESHOLD) {
        const isScrollingDown = currentY > prevY;
        const isManualOpen = manualOverrideRef.current === false;

        if (isManualOpen && isScrollingDown && currentY - prevY >= MANUAL_OPEN_RELEASE_DELTA) {
          setIsSidebarCollapsed(true);
          setManualOverride(null);
        } else if (!isManualOpen && !isSidebarCollapsedRef.current) {
          setIsSidebarCollapsed(true);
        }
      }

      prevScrollYRef.current = currentY;
    };

    prevScrollYRef.current = window.scrollY;
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleToggle = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      setManualOverride(next);
      return next;
    });
  };

  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid">
        <SectionSidebar title="Личный кабинет" items={navItems} isCollapsed={isSidebarCollapsed} onToggle={handleToggle} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
