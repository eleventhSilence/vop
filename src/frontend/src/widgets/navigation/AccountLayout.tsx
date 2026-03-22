import { Outlet } from 'react-router-dom';
import { SectionSidebar } from '@/widgets/navigation/SectionSidebar';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';

const accountNavItems = [
  { to: '/account/dashboard', label: 'Дашборд' },
  { to: '/account/profile', label: 'Профиль' },
  { to: '/account/courses', label: 'Мои курсы' },
  { to: '/account/reviews', label: 'Мои отзывы' },
];

export const AccountLayout = () => {
  return (
    <div className="app-shell">
      <TopNavigation />
      <div className="shell-grid">
        <SectionSidebar title="Личный кабинет" items={accountNavItems} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
