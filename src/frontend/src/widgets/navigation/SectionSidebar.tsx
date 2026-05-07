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
      <button
        type="button"
        className="sidebar__toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Показать меню личного кабинета' : 'Свернуть меню личного кабинета'}
        title={isCollapsed ? 'Показать меню личного кабинета' : 'Свернуть меню личного кабинета'}
      >
        {isCollapsed ? '▸' : '◂'}
      </button>
      <nav className="sidebar__group" aria-label={title} aria-hidden={isCollapsed} hidden={isCollapsed}>
        <p className="sidebar__title">{title}</p>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="sidebar__link">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
