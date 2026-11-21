import { House, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../app/routes';
import { BrandSymbol } from './Brand';

const items = [
  { to: routes.home, label: 'Início', Icon: House },
  { to: routes.search, label: 'Buscar', Icon: Search },
  { to: routes.account, label: 'Conta', Icon: null },
] as const;

export function MainNavigation() {
  const { pathname } = useLocation();
  const accountPage = ['/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/auth/retorno'].includes(pathname);
  const publicProfile = pathname.startsWith('/prestadores/') || pathname.startsWith('/trabalhos/');
  const selected = publicProfile ? routes.search : accountPage ? routes.account : pathname;
  return (
    <nav className="main-nav" aria-label="Navegação principal">
      {items.map(({ to, label, Icon }) => {
        const active = selected === to || (to !== routes.home && selected.startsWith(`${to}/`));
        return <Link key={to} to={to} aria-current={active ? 'page' : undefined}
          className={`main-nav__link${active ? ' main-nav__link--active' : ''}`}>
          {Icon ? <Icon size={22} strokeWidth={1.8} aria-hidden="true" /> : <BrandSymbol />}
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
