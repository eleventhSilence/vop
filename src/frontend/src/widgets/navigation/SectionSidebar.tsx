import { NavLink } from 'react-router-dom';

type SidebarItem = {
  to: string;
  label: string;
  end?: boolean;
};

type SectionSidebarProps = {
  title: string;
  items: SidebarItem[];
};

export const SectionSidebar = ({ title, items }: SectionSidebarProps) => {
  return (
    <aside className="sidebar">
      <nav className="sidebar__group" aria-label={title}>
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
