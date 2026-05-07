import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { SectionSidebar } from '@/widgets/navigation/SectionSidebar';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';

const accountNavItems = [
  { to: '/account/dashboard', label: 'Дашборд', end: true },
  { to: '/account/profile', label: 'Профиль', end: true },
  { to: '/account/courses', label: 'Мои курсы' },
  { to: '/account/reviews', label: 'Мои отзывы' },
];

export const AccountLayout = () => {
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? [...accountNavItems, { to: '/admin/dashboard', label: 'Админ-панель' }] : accountNavItems;

  return (
    <div className="app-shell">
      <TopNavigation />
      <div className="shell-grid">
        <SectionSidebar title="Личный кабинет" items={navItems} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
