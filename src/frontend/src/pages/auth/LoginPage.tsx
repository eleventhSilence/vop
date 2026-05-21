import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { extractApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveSafeRedirect = (target: string | null | undefined, isAdmin: boolean) => {
    if (!target) return isAdmin ? '/admin/dashboard' : '/account/profile';

    if (target.startsWith('/admin')) {
      return isAdmin ? target : '/account/profile';
    }

    if (target.startsWith('/account/courses/') && (target.includes('/test') || /^\/account\/courses\/[^/]+$/.test(target))) {
      return '/account/courses';
    }

    if (target.startsWith('/account/profile') || target.startsWith('/account/courses') || target.startsWith('/account/reviews') || target.startsWith('/account/dashboard')) {
      return target;
    }

    return isAdmin ? '/admin/dashboard' : '/account/profile';
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      const stateTarget = (location.state as { from?: string } | null)?.from;
      const storageTarget = sessionStorage.getItem('postLoginRedirect');
      sessionStorage.removeItem('postLoginRedirect');
      const target = resolveSafeRedirect(stateTarget ?? storageTarget, user.role === 'ADMIN');
      navigate(target, { replace: true });
    } catch (submitError) {
      setError(extractApiError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageSection>
      <div className="auth-card">
        <div>
          <p className="eyebrow">Авторизация</p>
          <h2>Вход в систему</h2>
        </div>

        <form className="form-stack" onSubmit={onSubmit}>
          <Input id="login-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input id="login-password" label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error ? <div className="form-error">{error}</div> : null}
          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </Button>
        </form>

        <p className="muted">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </PageSection>
  );
};
