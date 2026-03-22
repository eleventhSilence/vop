import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/AuthContext';
import { Button } from '@/shared/ui/Button';

const navItems = [
  { to: '/courses', label: 'Курсы' },
  { to: '/dashboard', label: 'Кабинет' },
  { to: '/my-courses', label: 'Мои курсы' },
  { to: '/reviews/my', label: 'Мои отзывы' },
  { to: '/account/profile', label: 'Профиль' },
];

const adminItems = [
  { to: '/admin/dashboard', label: 'Admin dashboard' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/courses', label: 'Курсы' },
  { to: '/admin/tests', label: 'Тесты' },
  { to: '/admin/reviews', label: 'Отзывы' },
];

export const AppShell = () => {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">VOP</p>
          <h1>Онлайн-платформа обучения для ВКР</h1>
        </div>
        <div className="topbar__actions">
          {isAuthenticated && user ? <span className="topbar__user">{user.first_name} {user.last_name}</span> : null}
          {isAuthenticated ? (
            <Button variant="secondary" onClick={() => void logout()}>
              Выйти
            </Button>
          ) : (
            <>
              <NavLink to="/login" className="nav-pill">Вход</NavLink>
              <NavLink to="/register" className="nav-pill">Регистрация</NavLink>
            </>
          )}
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar">
          <nav className="sidebar__group">
            <p className="sidebar__title">Основная навигация</p>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="sidebar__link">
                {item.label}
              </NavLink>
            ))}
          </nav>

          {isAdmin ? (
            <nav className="sidebar__group">
              <p className="sidebar__title">Администрирование</p>
              {adminItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="sidebar__link">
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
