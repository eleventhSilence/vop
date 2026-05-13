import type { AdminReview, ReviewStatus } from '@/entities/review/types';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { RatingStars } from '@/shared/ui/RatingStars';
import { StatusBadge } from '@/shared/ui/StatusBadge';

type Props = {
  review: AdminReview;
  pending: boolean;
  onClose: () => void;
  onChangeStatus: (status: ReviewStatus) => void;
  getStatusTone: (status: ReviewStatus) => 'success' | 'danger' | 'accent';
  getAuthorLabel: (review: AdminReview) => string;
};

export const AdminReviewOverlay = ({ review, pending, onClose, onChangeStatus, getStatusTone, getAuthorLabel }: Props) => (
  <div className="overlay" role="presentation" onClick={onClose}>
    <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <div className="card__row"><h3>Модерация отзыва</h3></div>
      <section className="admin-user-panel__section">
        <div className="grid-2">
          <div><p className="muted">Курс</p><strong>{review.course_title}</strong></div>
          <div><p className="muted">Автор</p><strong>{getAuthorLabel(review)}</strong></div>
          <div><p className="muted">Email автора</p><strong>{review.user_email}</strong></div>
          <div><p className="muted">Оценка</p><strong><RatingStars rating={review.rating} ariaLabel="Оценка в модерации" /></strong></div>
          <div><p className="muted">Статус</p><StatusBadge status={review.status} label={formatStatus(review.status)} tone={getStatusTone(review.status)} /></div>
        </div>
        <div><p className="muted">Текст отзыва</p><p>{review.comment}</p></div>
      </section>
      <section className="admin-user-panel__section">
        <div className="admin-user-panel__section-head"><p className="eyebrow">Служебная информация</p></div>
        <div className="admin-user-panel__meta grid-2">
          <div className="admin-user-panel__value-block"><p className="muted">Дата создания</p><strong>{formatDateTime(review.created_at)}</strong></div>
          <div className="admin-user-panel__value-block"><p className="muted">Дата обновления</p><strong>{formatDateTime(review.updated_at)}</strong></div>
        </div>
      </section>
      <div className="users-actions__buttons">
        {review.status === 'pending' ? (
          <>
            <Button variant="secondary" onClick={() => onChangeStatus('approved')} disabled={pending}>Одобрить</Button>
            <Button variant="ghost" onClick={() => onChangeStatus('rejected')} disabled={pending}>Отклонить</Button>
          </>
        ) : <Button variant="secondary" onClick={() => onChangeStatus('pending')} disabled={pending}>Изменить решение</Button>}
        <Button variant="ghost" onClick={onClose} disabled={pending}>Закрыть</Button>
      </div>
    </div>
  </div>
);
