import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = { icon: LucideIcon; title: string; description: string; to?: string; onClick?: () => void; pending?: boolean; soon?: boolean; danger?: boolean };
export function MenuRow({ icon: Icon, title, description, to, onClick, pending, soon, danger }: Props) {
  const content = <><span className="menu-row__icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
    <span className="menu-row__copy"><strong>{title}</strong><span>{description}</span></span>
    {soon ? <span className="soon-label">Em breve</span> : (to || onClick) ? <ChevronRight size={20} aria-hidden="true" /> : null}</>;
  const className = `menu-row${danger ? ' menu-row--danger' : ''}${soon ? ' menu-row--soon' : ''}`;
  if (to) return <Link className={className} to={to}>{content}</Link>;
  if (onClick) return <button className={className} onClick={onClick} disabled={pending}>{content}</button>;
  return <div className={className}>{content}</div>;
}
