import { Link } from 'react-router-dom';
import { routes } from '../app/routes';

export function Brand() {
  return (
    <Link className="brand" to={routes.home} aria-label="PEREIRÃO — Início">
      <img src="/images/brand/pereirao-384.png"
        srcSet="/images/brand/pereirao-384.png 384w, /images/brand/pereirao-768.png 768w"
        sizes="156px" width={384} height={256} alt="PEREIRÃO" fetchPriority="high" />
    </Link>
  );
}
