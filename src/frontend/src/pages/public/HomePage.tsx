import { Link } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

const platformHighlights = [
  {
    title: 'Учебные курсы',
    description: 'Открытая зона платформы помогает познакомиться с программами подготовки, их структурой и ожидаемым результатом обучения.',
  },
  {
    title: 'Тестирование знаний',
    description: 'После изучения материалов пользователь может перейти к проверке знаний в уже существующем учебном контуре системы.',
  },
  {
    title: 'Отслеживание прогресса',
    description: 'Авторизованные участники видят собственный прогресс, возвращаются к обучению и планируют дальнейшее прохождение курса.',
  },
  {
    title: 'Единая образовательная среда',
    description: 'Публичная часть аккуратно ведёт от знакомства с организацией к каталогу курсов и личному учебному кабинету.',
  },
];

const organizationFocus = [
  'Поисковая и мемориальная деятельность, связанная с сохранением исторической памяти.',
  'Просветительская работа с молодёжью, волонтёрами и участниками поискового движения.',
  'Подготовка к более системному и последовательному обучению внутри цифровой платформы.',
];

const platformPrinciples = [
  {
    title: 'Спокойная и понятная подача',
    description: 'Главная страница не перегружает пользователя и сразу объясняет, для чего создана платформа.',
  },
  {
    title: 'Переход к обучению без лишних шагов',
    description: 'Основной сценарий — познакомиться с проектом, открыть каталог и выбрать подходящий курс.',
  },
  {
    title: 'Готовность к дальнейшему развитию',
    description: 'Текущая структура уже поддерживает курсы, отзывы, тестирование и личный прогресс без смены архитектуры.',
  },
];

export const HomePage = () => {
  return (
    <PageSection className="public-page-stack">
      <section className="hero-card public-hero-card">
        <div className="public-hero-card__content">
          <p className="eyebrow">Вологодское объединение поисковиков</p>
          <h1 className="hero-card__title">Образовательная платформа для подготовки, сопровождения и развития участников поискового движения</h1>
          <p className="lead public-hero-card__lead">
            Открытая часть системы знакомит с организацией, объясняет задачи платформы и помогает перейти к курсам,
            посвящённым обучению, просветительской работе и последовательному освоению материалов.
          </p>
        </div>

        <div className="public-hero-card__aside">
          <div className="hero-card__actions">
            <Link to="/courses" className="button button--primary">
              Перейти к курсам
            </Link>
            <Link to="/register" className="button button--secondary">
              Создать аккаунт
            </Link>
          </div>

          <div className="public-hero-card__note">
            <strong>Публичный вход в систему</strong>
            <p className="muted">
              Здесь пользователь получает общее представление о проекте, а после авторизации может продолжить обучение в личном кабинете.
            </p>
          </div>
        </div>
      </section>

      <section className="content-columns">
        <article className="card card--wide">
          <div className="section-header">
            <div>
              <p className="eyebrow">Об организации</p>
              <h2>Для кого и зачем создаётся платформа</h2>
            </div>
          </div>
          <p>
            Платформа разрабатывается для проекта «Вологодское объединение поисковиков» как аккуратная цифровая среда,
            в которой можно представить образовательные материалы, поддержать подготовку участников и сделать вход в
            обучение более понятным и последовательным.
          </p>
          <div className="stack-list">
            {organizationFocus.map((item) => (
              <div key={item} className="list-item">
                {item}
              </div>
            ))}
          </div>
        </article>

        <aside className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Почему это важно</p>
              <h2>Открытая зона платформы</h2>
            </div>
          </div>
          <p className="muted">
            Публичный контур помогает не только показать каталог курсов, но и объяснить смысл обучения: от знакомства с
            организацией до перехода к системной работе с теорией, тестированием и личным прогрессом.
          </p>
        </aside>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">Возможности платформы</p>
            <h2>Что пользователь получает в образовательной среде</h2>
          </div>
        </div>
        <div className="card-grid public-feature-grid">
          {platformHighlights.map((item) => (
            <article key={item.title} className="card feature-card">
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card public-cta-card">
        <div>
          <p className="eyebrow">Каталог курсов</p>
          <h2>Начните знакомство с учебными материалами</h2>
          <p className="muted">
            Каталог собирает открытые карточки курсов и даёт понятную точку входа в учебный контур без перегруженного лендинга.
          </p>
        </div>

        <div className="public-cta-card__actions">
          <Link to="/courses" className="button button--primary">
            Открыть каталог
          </Link>
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">Подход к развитию</p>
            <h2>Как устроена публичная часть уже сейчас</h2>
          </div>
        </div>
        <div className="card-grid public-principles-grid">
          {platformPrinciples.map((item) => (
            <article key={item.title} className="card feature-card">
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </PageSection>
  );
};
