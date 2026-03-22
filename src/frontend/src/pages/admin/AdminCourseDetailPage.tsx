import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminCourseDetailPage = () => {
  const { courseId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка курса</h2>
        <p>Каркас для дальнейшей работы с отдельным курсом в административной зоне.</p>
        <p className="muted">ID курса: {courseId}</p>
      </div>
    </PageSection>
  );
};
