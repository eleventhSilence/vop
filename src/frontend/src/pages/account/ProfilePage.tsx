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
import { Toast } from '@/shared/ui/Toast';
import { AccountDashboardSection } from '@/pages/account/components/AccountDashboardSection';

const MIN_PASSWORD_LENGTH = 8;

export const ProfilePage = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  const [isProfileOverlayOpen, setProfileOverlayOpen] = useState(false);
  const [isPasswordOverlayOpen, setPasswordOverlayOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ['account', 'me'],
    queryFn: authApi.me,
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

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
      return 'Пароли не совпадают.';
    }

    return null;
  }, [passwordForm.current_password, passwordForm.new_password, passwordForm.new_password_confirm]);

  const profileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (updatedUser) => {
      setProfileError(null);
      setProfileOverlayOpen(false);
      setToast({ type: 'success', message: 'Профиль обновлён.' });
      queryClient.setQueryData(['account', 'me'], updatedUser);
      updateUser(updatedUser);
    },
    onError: () => {
      setProfileError('Не удалось обновить профиль. Проверьте данные и попробуйте ещё раз.');
      setToast({ type: 'error', message: 'Не удалось обновить профиль. Проверьте данные и попробуйте ещё раз.' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setPasswordError(null);
      setPasswordOverlayOpen(false);
      setPasswordForm({ current_password: '', new_password: '', new_password_confirm: '' });
      setToast({ type: 'success', message: 'Пароль изменён.' });
    },
    onError: () => {
      setPasswordError('Не удалось изменить пароль. Проверьте введённые данные.');
      setToast({ type: 'error', message: 'Не удалось изменить пароль. Проверьте введённые данные.' });
    },
  });

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  const openProfileOverlay = () => {
    if (meQuery.data) {
      setProfileForm({
        first_name: meQuery.data.first_name,
        last_name: meQuery.data.last_name,
        email: meQuery.data.email,
      });
    }
    setProfileError(null);
    setProfileOverlayOpen(true);
  };

  const closeProfileOverlay = () => {
    setProfileOverlayOpen(false);
    setProfileError(null);
    if (meQuery.data) {
      setProfileForm({
        first_name: meQuery.data.first_name,
        last_name: meQuery.data.last_name,
        email: meQuery.data.email,
      });
    }
  };

  const openPasswordOverlay = () => {
    setPasswordForm({ current_password: '', new_password: '', new_password_confirm: '' });
    setPasswordError(null);
    setPasswordOverlayOpen(true);
  };

  const closePasswordOverlay = () => {
    setPasswordOverlayOpen(false);
    setPasswordError(null);
    setPasswordForm({ current_password: '', new_password: '', new_password_confirm: '' });
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
          <div className="card card--wide profile-summary">
            <dl className="description-list">
              <div><dt>Имя</dt><dd>{meQuery.data.first_name}</dd></div>
              <div><dt>Фамилия</dt><dd>{meQuery.data.last_name}</dd></div>
              <div><dt>Email</dt><dd>{meQuery.data.email}</dd></div>
              <div><dt>Роль</dt><dd>{formatRole(meQuery.data.role)}</dd></div>
              <div><dt>Статус</dt><dd>{formatStatus(meQuery.data.status)}</dd></div>
              <div><dt>Дата регистрации</dt><dd>{formatDateTime(meQuery.data.registered_at)}</dd></div>
              <div><dt>Последний вход</dt><dd>{formatDateTime(meQuery.data.last_login_at)}</dd></div>
            </dl>
            <div className="button-row profile-actions">
              <Button type="button" onClick={openProfileOverlay}>Редактировать профиль</Button>
              <Button type="button" variant="ghost" onClick={openPasswordOverlay}>Изменить пароль</Button>
            </div>
          </div>

          {isProfileOverlayOpen ? (
            <div className="overlay" role="presentation" onClick={closeProfileOverlay}>
              <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <form className="form-stack" onSubmit={handleProfileSubmit}>
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
                  <div className="button-row">
                    <Button type="submit" disabled={profileMutation.isPending}>
                      {profileMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={closeProfileOverlay} disabled={profileMutation.isPending}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {isPasswordOverlayOpen ? (
            <div className="overlay" role="presentation" onClick={closePasswordOverlay}>
              <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <form className="form-stack" onSubmit={handlePasswordSubmit}>
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
                  <div className="button-row">
                    <Button type="submit" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={closePasswordOverlay} disabled={changePasswordMutation.isPending}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
          <div className="profile-statistics-section">
            <AccountDashboardSection />
          </div>
        </>
      ) : null}
      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
