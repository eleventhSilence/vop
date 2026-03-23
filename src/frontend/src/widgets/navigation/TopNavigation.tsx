import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/AuthContext';
import { Button } from '@/shared/ui/Button';

const guestLinks = [
  { to: '/login', label: 'Вход' },
  { to: '/register', label: 'Регистрация' },
];

const userMenuItems = [
  { to: '/account/profile', label: 'Профиль' },
  { to: '/account/courses', label: 'Мои курсы' },
  { to: '/account/reviews', label: 'Мои отзывы' },
];

const adminMenuItems = [
  ...userMenuItems,
  { to: '/admin/dashboard', label: 'Админ-панель' },
];

export const TopNavigation = () => {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const menuItems = isAdmin ? adminMenuItems : userMenuItems;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar__brand-wrap">
        <NavLink to="/" className="brand-link" aria-label="Перейти на главную страницу">
          <span className="brand-link__logo">ВКР</span>
          <span>
            <span className="eyebrow">VOP</span>
            <strong className="brand-link__title">Онлайн-платформа обучения</strong>
          </span>
        </NavLink>
      </div>

      <div className="topbar__actions">
        {isAuthenticated && user ? (
          <details className="user-menu">
            <summary className="user-menu__trigger">
              <span className="user-menu__avatar" aria-hidden="true">{initials || 'U'}</span>
              <span className="user-menu__meta">
                <span className="user-menu__name">{fullName || user.email}</span>
                <span className="user-menu__role">{isAdmin ? 'Администратор' : 'Пользователь'}</span>
              </span>
            </summary>

            <div className="user-menu__dropdown">
              {menuItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="user-menu__link">
                  {item.label}
                </NavLink>
              ))}
              <Button variant="ghost" className="user-menu__logout" onClick={() => void logout()}>
                Выйти
              </Button>
            </div>
          </details>
        ) : (
          guestLinks.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-pill">
              {item.label}
            </NavLink>
          ))
        )}
      </div>
    </header>
  );
};
