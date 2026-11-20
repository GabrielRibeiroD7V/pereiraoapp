import { House, Search, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { routes } from '../app/routes';

const items = [
  { to: routes.home, label: 'Início', Icon: House },
  { to: routes.search, label: 'Buscar', Icon: Search },
  { to: routes.account, label: 'Conta', Icon: UserRound },
] as const;

export function MainNavigation() {
  return (
    <nav className="main-nav" aria-label="Navegação principal">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === routes.home}
          className={({ isActive }) => `main-nav__link${isActive ? ' main-nav__link--active' : ''}`}>
          <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
