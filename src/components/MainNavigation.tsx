import { House, Search, MessageCircle, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '../app/routes';
const items = [
  { to: routes.home, label: 'Início', Icon: House, iconOnly: false },
  { to: routes.search, label: 'Buscar', Icon: Search, iconOnly: false },
  { to: routes.conversations, label: 'Conversas', Icon: MessageCircle, iconOnly: false },
  { to: routes.account, label: 'Conta', Icon: UserRound, iconOnly: true },
] as const;

export function MainNavigation() {
  const { pathname } = useLocation();
  const accountPage = ['/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/auth/retorno'].includes(pathname);
  const publicProfile = pathname.startsWith('/prestadores/') || pathname.startsWith('/trabalhos/');
  const selected = publicProfile ? routes.search : accountPage ? routes.account : pathname;
  return (
    <nav className="main-nav" aria-label="Navegação principal">
      {items.map(({ to, label, Icon, iconOnly }) => {
        const active = selected === to || (to !== routes.home && selected.startsWith(`${to}/`));
        return <Link key={to} to={to} aria-current={active ? 'page' : undefined}
          className={`main-nav__link${iconOnly ? ' main-nav__link--icon-only' : ''}${active ? ' main-nav__link--active' : ''}`}>
          <Icon size={iconOnly ? 27 : 22} strokeWidth={1.8} aria-hidden="true" />
          <span className={iconOnly ? 'visually-hidden' : undefined}>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
