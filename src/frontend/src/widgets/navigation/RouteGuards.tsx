import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { LoadingState } from '@/shared/ui/DataState';

const getDefaultAuthorizedRoute = (isAdmin: boolean) => (isAdmin ? '/admin/dashboard' : '/account/dashboard');

export const ProtectedRoute = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  if (!isInitialized) {
    return <LoadingState message="Восстанавливаем сессию..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export const AdminRoute = () => {
  const { isAdmin, isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  if (!isInitialized) {
    return <LoadingState message="Проверяем доступ администратора..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/account/dashboard" replace />;
  }

  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { isAuthenticated, isInitialized, isAdmin } = useAuth();

  if (!isInitialized) {
    return <LoadingState message="Проверяем сессию..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={getDefaultAuthorizedRoute(isAdmin)} replace />;
  }

  return <Outlet />;
};
