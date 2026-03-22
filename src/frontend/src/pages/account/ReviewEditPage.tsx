import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const ReviewEditPage = () => {
  const { reviewId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Личный кабинет</p>
        <h2>Редактирование отзыва</h2>
        <p>
          Отдельная страница для маршрута <code>/account/reviews/:reviewId/edit</code> подготовлена как каркас.
          Пока редактирование доступно через список отзывов.
        </p>
        <p className="muted">ID отзыва: {reviewId}</p>
      </div>
    </PageSection>
  );
};
