import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminTestDetailPage = () => {
  const { testId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка теста</h2>
        <p>Каркас страницы для детальной настройки теста.</p>
        <p className="muted">ID теста: {testId}</p>
      </div>
    </PageSection>
  );
};
