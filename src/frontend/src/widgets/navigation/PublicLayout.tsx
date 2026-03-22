import { Outlet } from 'react-router-dom';
import { TopNavigation } from '@/widgets/navigation/TopNavigation';

export const PublicLayout = () => {
  return (
    <div className="app-shell app-shell--public">
      <TopNavigation />
      <main className="content content--public">
        <Outlet />
      </main>
    </div>
  );
};
