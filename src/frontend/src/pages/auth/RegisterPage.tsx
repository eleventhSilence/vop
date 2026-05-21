import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { extractApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register(form);
      navigate('/account/dashboard', { replace: true });
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
          <p className="eyebrow">Регистрация</p>
          <h2>Создание аккаунта</h2>
        </div>

        <form className="form-stack" onSubmit={onSubmit}>
          <Input id="register-first-name" label="Имя" value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} required />
          <Input id="register-last-name" label="Фамилия" value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} required />
          <Input id="register-email" label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          <Input id="register-password" label="Пароль" type="password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          {error ? <div className="form-error">{error}</div> : null}
          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="muted">
          Уже зарегистрированы? <Link to="/login">Войти</Link>
        </p>
      </div>
    </PageSection>
  );
};
