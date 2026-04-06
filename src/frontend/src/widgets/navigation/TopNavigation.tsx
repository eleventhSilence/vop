import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { brandingConfig } from '@/shared/config/branding';
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
  const location = useLocation();
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const menuItems = isAdmin ? adminMenuItems : userMenuItems;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase();
  const [logoUrl, setLogoUrl] = useState(brandingConfig.logoUrl);
  const [isLogoBroken, setIsLogoBroken] = useState(false);

  useEffect(() => {
    if (menuRef.current?.open) {
      menuRef.current.open = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    setLogoUrl(brandingConfig.logoUrl);
    setIsLogoBroken(false);
  }, [brandingConfig.logoUrl]);

  const closeMenu = () => {
    if (menuRef.current?.open) {
      menuRef.current.open = false;
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__brand-wrap">
        <NavLink to="/" className="brand-link" aria-label="Перейти на главную страницу">
          {isLogoBroken ? (
            <span className="brand-link__logo-fallback" role="img" aria-label="Логотип Вологодского объединения поисковиков">
              ВОП
            </span>
          ) : (
            <img
              src={logoUrl}
              alt="Логотип Вологодского объединения поисковиков"
              className="brand-link__logo-image"
              onError={() => {
                if (logoUrl !== brandingConfig.defaultLogoUrl) {
                  // Debug note: внешний источник может блокировать загрузку (hotlink/403), переключаемся на локальный fallback-asset.
                  setLogoUrl(brandingConfig.defaultLogoUrl);
                  return;
                }

                setIsLogoBroken(true);
              }}
            />
          )}
          <span className="brand-link__text">
            <span className="eyebrow">ВОП</span>
            <strong className="brand-link__title">Онлайн-платформа «Вологодское Объединение Поисковиков»</strong>
          </span>
        </NavLink>
      </div>

      <div className="topbar__actions">
        {isAuthenticated && user ? (
          <details className="user-menu" ref={menuRef}>
            <summary className="user-menu__trigger">
              <span className="user-menu__avatar" aria-hidden="true">{initials || 'U'}</span>
              <span className="user-menu__meta">
                <span className="user-menu__name">{fullName || user.email}</span>
                <span className="user-menu__role">{isAdmin ? 'Администратор' : 'Пользователь'}</span>
              </span>
            </summary>

            <div className="user-menu__dropdown">
              {menuItems.map((item) => (
                <Link key={item.to} to={item.to} className="user-menu__link" onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
              <Button variant="ghost" className="user-menu__logout" onClick={() => { closeMenu(); void logout(); }}>
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
