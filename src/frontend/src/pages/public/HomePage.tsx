import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/useAuth';
import { PageSection } from '@/shared/ui/PageSection';

const organizationCards = [
  {
    title: 'Поисковая и мемориальная деятельность',
    description: 'Организация объединяет участников поискового движения, занимается полевыми работами и увековечением памяти защитников Отечества.',
  },
  {
    title: 'Сохранение исторической памяти',
    description: 'ВОП системно собирает, сохраняет и передаёт исторические материалы, чтобы история оставалась доступной для новых поколений.',
  },
  {
    title: 'Просветительская работа и подготовка участников',
    description: 'Платформа поддерживает обучение, помогает закреплять знания и выстраивать последовательную подготовку участников.',
  },
];

const learningSteps = [
  {
    title: '1. Курсы',
    description: 'Выберите учебный курс в каталоге и начните обучение в удобном темпе.',
  },
  {
    title: '2. Тестирование',
    description: 'Проверьте усвоение материалов с помощью тестов после прохождения тем.',
  },
  {
    title: '3. Прогресс',
    description: 'Отслеживайте результаты и продолжайте обучение в личном кабинете.',
  },
];

export const HomePage = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <PageSection className="public-page-stack">
      <section className="hero-card public-hero-card public-hero-card--single">
        <div className="public-hero-card__content">
          <p className="eyebrow">Вологодское объединение поисковиков</p>
          <h1 className="hero-card__title">Онлайн-платформа "Вологодское Объединение Поисковиков"</h1>
          <p className="lead public-hero-card__lead">
            Единое образовательное пространство для подготовки участников поискового движения,
            развития просветительской деятельности и сохранения исторической памяти.
          </p>
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">О ВОП</p>
            <h2>Основные направления деятельности</h2>
          </div>
        </div>
        <div className="card-grid public-feature-grid">
          {organizationCards.map((item) => (
            <article key={item.title} className="card feature-card">
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">Обучение на платформе</p>
            <h2>Понятный путь от старта до результата</h2>
          </div>
        </div>
        <div className="card-grid public-feature-grid">
          {learningSteps.map((item) => (
            <article key={item.title} className="card feature-card">
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card public-cta-card">
        <div>
          <p className="eyebrow">Действия</p>
          <h2>Продолжайте работу на платформе</h2>
          <p className="muted">Выберите следующий шаг в зависимости от вашей роли на платформе.</p>
        </div>

        <div className="public-cta-card__actions public-cta-card__actions--wrap">
          {!isAuthenticated && (
            <>
              <Link to="/courses" className="button button--primary">
                Открыть каталог
              </Link>
              <Link to="/register" className="button button--secondary">
                Создать аккаунт
              </Link>
            </>
          )}

          {isAuthenticated && !isAdmin && (
            <>
              <Link to="/account/courses" className="button button--primary">
                Мои курсы
              </Link>
              <Link to="/account/dashboard" className="button button--secondary">
                Продолжить обучение
              </Link>
            </>
          )}

          {isAuthenticated && isAdmin && (
            <Link to="/admin/dashboard" className="button button--primary">
              Админ-панель
            </Link>
          )}
        </div>
      </section>
    </PageSection>
  );
};
