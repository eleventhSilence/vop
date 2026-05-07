import { NavLink } from 'react-router-dom';

type SidebarItem = {
  to: string;
  label: string;
  end?: boolean;
};

type SectionSidebarProps = {
  title: string;
  items: SidebarItem[];
  isCollapsed?: boolean;
  onToggle?: () => void;
};

export const SectionSidebar = ({ title, items, isCollapsed = false, onToggle }: SectionSidebarProps) => {
  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      {isCollapsed ? (
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label="Показать меню личного кабинета"
          title="Показать меню личного кабинета"
          aria-expanded={false}
        >
          ›
        </button>
      ) : null}
      <nav className="sidebar__group" aria-label={title} aria-hidden={isCollapsed} hidden={isCollapsed}>
        <div className="sidebar__header">
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onToggle}
            aria-label="Скрыть меню личного кабинета"
            title="Скрыть меню личного кабинета"
            aria-expanded
          >
            ‹
          </button>
          <p className="sidebar__title">{title}</p>
        </div>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="sidebar__link">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
