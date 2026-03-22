import { useParams } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminTestQuestionsPage = () => {
  const { testId } = useParams();

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Вопросы теста</h2>
        <p>Каркас страницы для управления вопросами теста.</p>
        <p className="muted">ID теста: {testId}</p>
      </div>
    </PageSection>
  );
};
