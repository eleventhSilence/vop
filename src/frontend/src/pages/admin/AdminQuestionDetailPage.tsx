import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminQuestionDetailPage = () => {
  const { questionId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка вопроса</h2>
        <p>Каркас страницы для просмотра и редактирования вопроса.</p>
        <p className="muted">ID вопроса: {questionId}</p>
      </div>
    </PageSection>
  );
};
