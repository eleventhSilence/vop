import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminTestsPage = () => {
  const testsQuery = useQuery({ queryKey: ['admin', 'tests'], queryFn: () => testingApi.adminTests() });
  const tests = testsQuery.data ? ensurePaginated(testsQuery.data).results : [];

  return (
    <PageSection>
      <h2>Администратор: тесты</h2>
      {testsQuery.isLoading ? <LoadingState /> : null}
      {testsQuery.isError ? <ErrorState message={extractApiError(testsQuery.error)} /> : null}
      <div className="stack-list">
        {tests.map((test) => (
          <div className="card" key={test.test_id}>
            <h3>{test.title}</h3>
            <p>{test.course_title}</p>
            <p className="muted">Passing score: {test.passing_score}, max attempts: {test.max_attempts}</p>
            <div className="stack-list">
              <Link to={`/admin/tests/${test.test_id}`} className="text-link">Открыть тест →</Link>
              <Link to={`/admin/tests/${test.test_id}/questions`} className="text-link">Перейти к вопросам →</Link>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};
