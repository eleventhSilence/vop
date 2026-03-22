import { Link } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const NotFoundPage = () => (
  <PageSection>
    <div className="card">
      <p className="eyebrow">404</p>
      <h2>Страница не найдена</h2>
      <p>Проверьте адрес или вернитесь в каталог курсов.</p>
      <Link to="/courses" className="text-link">Перейти к курсам →</Link>
    </div>
  </PageSection>
);
