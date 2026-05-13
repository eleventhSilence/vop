import type { AdminUser, AdminUserUpdatePayload } from '@/entities/admin/types';
import { formatDateTime, formatRole, formatStatus } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';

type Props = {
  user: AdminUser;
  draft: {
    first_name: string;
    last_name: string;
    role: AdminUser['role'];
    status: AdminUser['status'];
  };
  roleOptions: Array<AdminUser['role']>;
  statusOptions: Array<AdminUser['status']>;
  pending: boolean;
  selfLocked: boolean;
  onClose: () => void;
  onChangeDraft: (payload: Partial<AdminUserUpdatePayload>) => void;
  onSave: () => void;
};

export const AdminUserOverlay = ({ user, draft, roleOptions, statusOptions, pending, selfLocked, onClose, onChangeDraft, onSave }: Props) => (
  <div className="overlay" role="presentation" onClick={onClose}>
    <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <div className="card__row">
        <div>
          <h3>Редактирование пользователя</h3>
          <p className="muted">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}</p>
        </div>
      </div>
      <section className="admin-user-panel__section">
        <div className="admin-user-panel__section-head"><p className="eyebrow">Редактируемые данные</p></div>
        <div className="grid-2">
          <label className="field"><span>Имя</span><input className="field__control" value={draft.first_name} onChange={(e) => onChangeDraft({ first_name: e.target.value })} /></label>
          <label className="field"><span>Фамилия</span><input className="field__control" value={draft.last_name} onChange={(e) => onChangeDraft({ last_name: e.target.value })} /></label>
          <label className="field"><span>Роль</span><select className="field__control" value={draft.role} onChange={(e) => onChangeDraft({ role: e.target.value as AdminUser['role'] })} disabled={selfLocked}>{roleOptions.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label>
          <label className="field"><span>Статус</span><select className="field__control" value={draft.status} onChange={(e) => onChangeDraft({ status: e.target.value as AdminUser['status'] })} disabled={selfLocked}>{statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
        </div>
      </section>
      <section className="admin-user-panel__section">
        <div className="admin-user-panel__section-head"><p className="eyebrow">Служебная информация</p></div>
        <div className="admin-user-panel__meta grid-2">
          <div className="admin-user-panel__value-block"><p className="muted">Email</p><strong>{user.email}</strong></div>
          <div className="admin-user-panel__value-block"><p className="muted">Дата регистрации</p><strong>{formatDateTime(user.registered_at)}</strong></div>
          <div className="admin-user-panel__value-block"><p className="muted">Последний вход</p><strong>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Нет данных'}</strong></div>
        </div>
      </section>
      <div className="users-actions__buttons">
        <Button variant="secondary" onClick={onSave} disabled={pending}>Сохранить</Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>Отмена</Button>
      </div>
    </div>
  </div>
);
