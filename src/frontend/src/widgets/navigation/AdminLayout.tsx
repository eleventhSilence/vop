import type { CSSProperties } from 'react';
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

  return (
    <div className="app-shell" style={{ '--app-bg-image': `url(${platformAssets.appBackground})` } as CSSProperties }>
      <TopNavigation />
      <div className="shell-grid shell-grid--single">
        <main className="content">
          <section className="page-section admin-layout-heading">
            <h1>Административная панель для управления пользователями и контентом</h1>
          </section>
          <div className="admin-tabs-sticky">
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
          <div className="admin-page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
