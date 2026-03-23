import { Link } from 'react-router-dom';
import { PageSection } from '@/shared/ui/PageSection';

export const HomePage = () => {
  return (
    <PageSection>
      <div className="hero-card">
        <div>
          <p className="eyebrow">Главная страница</p>
          <h1 className="hero-card__title">Платформа обучения для подготовки и сопровождения ВКР</h1>
          <p className="lead">
            Базовая frontend-структура теперь разделена на публичную зону, личный кабинет и административную панель.
          </p>
        </div>

        <div className="hero-card__actions">
          <Link to="/courses" className="nav-pill nav-pill--action">Перейти к курсам</Link>
          <Link to="/register" className="nav-pill">Создать аккаунт</Link>
        </div>
      </div>
    </PageSection>
  );
};
