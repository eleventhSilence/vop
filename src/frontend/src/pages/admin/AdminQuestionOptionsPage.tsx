import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminQuestionOptionsPage = () => {
  const { questionId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Варианты ответа</h2>
        <p>Каркас страницы для работы с вариантами ответа конкретного вопроса.</p>
        <p className="muted">ID вопроса: {questionId}</p>
      </div>
    </PageSection>
  );
};
