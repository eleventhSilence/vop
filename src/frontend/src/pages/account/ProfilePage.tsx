import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/model/useAuth';
import { authApi } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatRole, formatStatus } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { AccountDashboardSection } from '@/pages/account/components/AccountDashboardSection';

const MIN_PASSWORD_LENGTH = 8;

export const ProfilePage = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ['account', 'me'],
    queryFn: authApi.me,
  });

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }

    setProfileForm({
      first_name: meQuery.data.first_name,
      last_name: meQuery.data.last_name,
      email: meQuery.data.email,
    });
  }, [meQuery.data]);

  const profileValidationError = useMemo(() => {
    if (!profileForm.first_name.trim()) {
      return 'Поле «Имя» обязательно.';
    }

    if (!profileForm.last_name.trim()) {
      return 'Поле «Фамилия» обязательно.';
    }

    return null;
  }, [profileForm.first_name, profileForm.last_name]);

  const passwordValidationError = useMemo(() => {
    if (!passwordForm.current_password) {
      return 'Укажите текущий пароль.';
    }

    if (passwordForm.new_password.length < MIN_PASSWORD_LENGTH) {
      return `Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`;
    }

    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      return 'Новый пароль и подтверждение не совпадают.';
    }

    return null;
  }, [passwordForm.current_password, passwordForm.new_password, passwordForm.new_password_confirm]);

  const profileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (updatedUser) => {
      setProfileError(null);
      setProfileSuccess('Профиль успешно обновлён.');
      queryClient.setQueryData(['account', 'me'], updatedUser);
      updateUser(updatedUser);
    },
    onError: (error) => {
      setProfileSuccess(null);
      setProfileError(extractApiError(error));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSuccess('Пароль успешно изменён.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        new_password_confirm: '',
      });
    },
    onError: (error) => {
      setPasswordSuccess(null);
      setPasswordError(extractApiError(error));
    },
  });

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSuccess(null);

    if (profileValidationError) {
      setProfileError(profileValidationError);
      return;
    }

    setProfileError(null);
    profileMutation.mutate({
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSuccess(null);

    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    setPasswordError(null);
    changePasswordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  };

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Аккаунт</p>
          <h2>Профиль</h2>
        </div>
      </div>

      {meQuery.isLoading ? <LoadingState /> : null}
      {meQuery.isError ? <ErrorState message={extractApiError(meQuery.error)} /> : null}
      {!meQuery.isLoading && !meQuery.isError && !meQuery.data ? <EmptyState message="Профиль временно недоступен. Попробуйте обновить страницу." /> : null}

      {meQuery.data ? (
        <>
          <div className="card card--wide">
            <dl className="description-list">
              <div><dt>Имя</dt><dd>{meQuery.data.first_name}</dd></div>
              <div><dt>Фамилия</dt><dd>{meQuery.data.last_name}</dd></div>
              <div><dt>Email</dt><dd>{meQuery.data.email}</dd></div>
              <div><dt>Роль</dt><dd>{formatRole(meQuery.data.role)}</dd></div>
              <div><dt>Статус</dt><dd>{formatStatus(meQuery.data.status)}</dd></div>
              <div><dt>Дата регистрации</dt><dd>{formatDateTime(meQuery.data.registered_at)}</dd></div>
              <div><dt>Последний вход</dt><dd>{formatDateTime(meQuery.data.last_login_at)}</dd></div>
            </dl>
          </div>

          <form className="card form-stack" onSubmit={handleProfileSubmit}>
            <h3>Редактирование профиля</h3>
            <Input
              id="profile-first-name"
              label="Имя"
              value={profileForm.first_name}
              onChange={(event) => setProfileForm((current) => ({ ...current, first_name: event.target.value }))}
              required
            />
            <Input
              id="profile-last-name"
              label="Фамилия"
              value={profileForm.last_name}
              onChange={(event) => setProfileForm((current) => ({ ...current, last_name: event.target.value }))}
              required
            />
            <Input id="profile-email" label="Email" type="email" value={profileForm.email} readOnly />

            {profileError ? <div className="form-error">{profileError}</div> : null}
            {profileSuccess ? <div className="form-success">{profileSuccess}</div> : null}

            <Button type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? 'Сохраняем...' : 'Сохранить профиль'}
            </Button>
          </form>

          <form className="card form-stack" onSubmit={handlePasswordSubmit}>
            <h3>Смена пароля</h3>
            <Input
              id="profile-current-password"
              label="Текущий пароль"
              type="password"
              value={passwordForm.current_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
              required
            />
            <Input
              id="profile-new-password"
              label="Новый пароль"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={passwordForm.new_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
              required
            />
            <Input
              id="profile-new-password-confirm"
              label="Подтверждение нового пароля"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={passwordForm.new_password_confirm}
              onChange={(event) => setPasswordForm((current) => ({ ...current, new_password_confirm: event.target.value }))}
              required
            />

            {passwordError ? <div className="form-error">{passwordError}</div> : null}
            {passwordSuccess ? <div className="form-success">{passwordSuccess}</div> : null}

            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? 'Сохраняем...' : 'Изменить пароль'}
            </Button>
          </form>
          <AccountDashboardSection />
        </>
      ) : null}
    </PageSection>
  );
};
