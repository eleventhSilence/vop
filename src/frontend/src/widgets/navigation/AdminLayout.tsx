import { Outlet } from 'react-router-dom';
import { SectionSidebar } from '@/widgets/navigation/SectionSidebar';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';

const adminNavItems = [
  { to: '/admin/dashboard', label: 'Дашборд' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/courses', label: 'Курсы' },
  { to: '/admin/tests', label: 'Тесты' },
  { to: '/admin/reviews', label: 'Отзывы', end: true },
  { to: '/admin/reviews/pending', label: 'На модерации' },
];

export const AdminLayout = () => {
  return (
    <div className="app-shell">
      <TopNavigation />
      <div className="shell-grid">
        <SectionSidebar title="Администрирование" items={adminNavItems} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
