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

const MIN_SCROLL_DELTA = 6;
const TOGGLE_DISTANCE = 42;
const ADMIN_TABS_TOP_GAP = 12;

export const AdminLayout = () => {
  const { pathname } = useLocation();
  const tabsSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollAccumulatorRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const isTabsStickyActiveRef = useRef(false);

  const [isTabsStickyActive, setIsTabsStickyActive] = useState(false);
  const [isTabsCollapsed, setIsTabsCollapsed] = useState(false);

  useEffect(() => {
    isTabsStickyActiveRef.current = isTabsStickyActive;
  }, [isTabsStickyActive]);

  useEffect(() => {
    const getStickyTopOffset = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const cssHeaderHeight = Number.parseFloat(rootStyle.getPropertyValue('--header-height'));
      const headerHeight = Number.isFinite(cssHeaderHeight) ? cssHeaderHeight : 112;

      return headerHeight + ADMIN_TABS_TOP_GAP;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const stickyActive = !entry.isIntersecting;

        isTabsStickyActiveRef.current = stickyActive;
        setIsTabsStickyActive(stickyActive);

        if (!stickyActive) {
          setIsTabsCollapsed(false);
          scrollAccumulatorRef.current = 0;
        }
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${getStickyTopOffset()}px 0px 0px 0px`,
      },
    );

    const sentinelNode = tabsSentinelRef.current;
    if (sentinelNode) {
      observer.observe(sentinelNode);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const processScroll = () => {
      const currentScrollY = window.scrollY;
      const deltaY = currentScrollY - lastScrollYRef.current;

      if (!isTabsStickyActiveRef.current) {
        lastScrollYRef.current = currentScrollY;
        scrollAccumulatorRef.current = 0;
        return;
      }

      if (Math.abs(deltaY) < MIN_SCROLL_DELTA) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (deltaY > 0) {
        scrollAccumulatorRef.current = Math.max(0, scrollAccumulatorRef.current) + deltaY;
      } else {
        scrollAccumulatorRef.current = Math.min(0, scrollAccumulatorRef.current) + deltaY;
      }

      if (scrollAccumulatorRef.current >= TOGGLE_DISTANCE) {
        setIsTabsCollapsed(true);
        scrollAccumulatorRef.current = 0;
      } else if (Math.abs(scrollAccumulatorRef.current) >= TOGGLE_DISTANCE && scrollAccumulatorRef.current < 0) {
        setIsTabsCollapsed(false);
        scrollAccumulatorRef.current = 0;
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (animationFrameRef.current !== null) {
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        processScroll();
      });
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  const showTabsShell = !isTabsCollapsed;
  const toggleSymbol = showTabsShell ? '⌃' : '⌄';
  const toggleLabel = showTabsShell ? 'Свернуть административную навигацию' : 'Показать административную навигацию';

  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid shell-grid--single">
        <main className="content">
          <section className="page-section admin-layout-heading">
            <h1>Административная панель для управления пользователями и контентом</h1>
          </section>

          <div ref={tabsSentinelRef} className="admin-tabs-sentinel" aria-hidden="true" />

          <div className="admin-tabs-sticky">
            {showTabsShell ? (
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
            ) : null}

            {isTabsStickyActive ? (
              <button
                type="button"
                className="admin-tabs-toggle"
                aria-label={toggleLabel}
                onClick={() => setIsTabsCollapsed((prev) => !prev)}
              >
                <span aria-hidden="true">{toggleSymbol}</span>
              </button>
            ) : null}
          </div>

          <div className="admin-page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
