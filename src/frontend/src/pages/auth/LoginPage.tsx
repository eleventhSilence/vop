import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/AuthContext';
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(target ?? (user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'), { replace: true });
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
          <p className="eyebrow">Auth flow</p>
          <h2>Вход в систему</h2>
          <p>Используется backend endpoint <code>/api/auth/login/</code> и существующая модель JWT.</p>
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
