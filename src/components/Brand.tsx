import { Link } from 'react-router-dom';
import { routes } from '../app/routes';

export function Brand() {
  return <Link className="brand" to={routes.home} aria-label="PEREIRÃO — Início">PEREIRÃO</Link>;
}
