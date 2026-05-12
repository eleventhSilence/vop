import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';
import { platformAssets } from '@/shared/config/platformAssets';

const adminNavItems = [
  { to: '/admin/dashboard', label: 'Дашборд', match: (path: string) => path === '/admin/dashboard' || path === '/admin' },
  { to: '/admin/users', label: 'Пользователи', match: (path: string) => path.startsWith('/admin/users') },
  { to: '/admin/courses', label: 'Курсы', match: (path: string) => path.startsWith('/admin/courses') },
  {
    to: '/admin/tests',
    label: 'Тесты',
    match: (path: string) => path.startsWith('/admin/tests') || path.startsWith('/admin/questions'),
  },
  { to: '/admin/reviews', label: 'Отзывы', match: (path: string) => path.startsWith('/admin/reviews') },
];

export const AdminLayout = () => {
  const { pathname } = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTabsExpanded, setIsTabsExpanded] = useState(false);

  const isTabsExpandedRef = useRef(isTabsExpanded);
  const lastScrollYRef = useRef(0);
  const lastToggleScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    isTabsExpandedRef.current = isTabsExpanded;
  }, [isTabsExpanded]);

  useEffect(() => {
    const ADMIN_TABS_COLLAPSE_OFFSET = 80;
    const MIN_SCROLL_DELTA = 8;
    const TOGGLE_DISTANCE = 56;
    const BOTTOM_GUARD = 16;
    const MIN_REMAINING_SCROLL_TO_COLLAPSE = 180;

    const processScroll = () => {
      frameRef.current = null;

      const currentScrollY = window.scrollY;
      const shouldCollapse = currentScrollY > ADMIN_TABS_COLLAPSE_OFFSET;
      setIsScrolled(shouldCollapse);

      if (!shouldCollapse) {
        if (isTabsExpandedRef.current) {
          isTabsExpandedRef.current = false;
          setIsTabsExpanded(false);
          lastToggleScrollYRef.current = currentScrollY;
        }
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const remainingScroll = maxScroll - currentScrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (Math.abs(delta) < MIN_SCROLL_DELTA) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const distanceFromLastToggle = Math.abs(currentScrollY - lastToggleScrollYRef.current);

      if (
        delta > 0 &&
        isTabsExpandedRef.current &&
        distanceFromLastToggle >= TOGGLE_DISTANCE
      ) {
        if (remainingScroll < MIN_REMAINING_SCROLL_TO_COLLAPSE || remainingScroll <= BOTTOM_GUARD) {
          lastScrollYRef.current = currentScrollY;
          return;
        }

        isTabsExpandedRef.current = false;
        setIsTabsExpanded(false);
        lastToggleScrollYRef.current = currentScrollY;
      }

      if (delta < 0 && !isTabsExpandedRef.current && distanceFromLastToggle >= TOGGLE_DISTANCE) {
        isTabsExpandedRef.current = true;
        setIsTabsExpanded(true);
        lastToggleScrollYRef.current = currentScrollY;
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(processScroll);
    };

    lastScrollYRef.current = window.scrollY;
    lastToggleScrollYRef.current = window.scrollY;
    processScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const showInlineTabs = !isScrolled;
  const showFloatingTabs = isScrolled && isTabsExpanded;
  const showFloatingToggle = isScrolled;
  const toggleSymbol = showFloatingTabs ? '⌃' : '⌄';
  const toggleLabel = showFloatingTabs ? 'Свернуть административную навигацию' : 'Показать административную навигацию';

  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid shell-grid--single">
        <main className="content">
          <section className="page-section admin-layout-heading">
            <h1>Административная панель для управления пользователями и контентом</h1>
          </section>
          <div className={`admin-tabs-inline ${showInlineTabs ? '' : 'admin-tabs-inline--hidden'}`}>
            <nav className="admin-tabs-shell" aria-label="Навигация административной панели">
              <div className="admin-tabs">
                {adminNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`admin-tabs__link ${item.match(pathname) ? 'admin-tabs__link--active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
          {showFloatingToggle ? (
            <div className="admin-tabs-floating">
              {showFloatingTabs ? (
                <nav className="admin-tabs-shell" aria-label="Навигация административной панели">
                  <div className="admin-tabs">
                    {adminNavItems.map((item) => (
                      <NavLink
                        key={`floating-${item.to}`}
                        to={item.to}
                        className={`admin-tabs__link ${item.match(pathname) ? 'admin-tabs__link--active' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </nav>
              ) : null}
              <button
                type="button"
                className="admin-tabs-toggle"
                aria-label={toggleLabel}
                onClick={() => {
                  setIsTabsExpanded((prev) => {
                    const next = !prev;
                    isTabsExpandedRef.current = next;
                    lastToggleScrollYRef.current = window.scrollY;
                    return next;
                  });
                }}
              >
                <span aria-hidden="true">{toggleSymbol}</span>
              </button>
            </div>
          ) : null}
          <div className="admin-page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
