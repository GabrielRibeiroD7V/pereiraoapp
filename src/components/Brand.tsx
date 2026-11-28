import { useId } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../app/routes';

export function Brand({ inverse = false }: { inverse?: boolean } = {}) {
  const id=`brand-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  return (
    <Link className={`brand${inverse ? ' brand--inverse' : ''}`} to={routes.home} aria-label="PEREIRÃO — Início">
      {inverse ? <svg className="brand__inverse-image" viewBox="20 151 338 87" width="338" height="87" role="img" aria-label="PEREIRÃO" focusable="false">
        <defs>
          <filter id={`${id}-white`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1 -1 -1 0 2.95"/></filter>
          <filter id={`${id}-color`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 .812  0 0 0 0 .871  -1 -1 -1 0 2.95"/></filter>
          <clipPath id={`${id}-letters`}><polygon points="0,166.4 261.1,166.4 265,151 303.4,151 303.4,166.4 384,166.4 384,216 0,216"/></clipPath>
          <clipPath id={`${id}-underline`}><rect x="0" y="216" width="384" height="28"/></clipPath>
        </defs>
        <image href="/images/brand/pereirao-384.png" width="384" height="256" filter={`url(#${id}-white)`} clipPath={`url(#${id}-letters)`}/>
        <image href="/images/brand/pereirao-384.png" width="384" height="256" filter={`url(#${id}-color)`} clipPath={`url(#${id}-underline)`}/>
      </svg> : <span className="brand__lettering"><img src="/images/brand/pereirao-384.png"
        srcSet="/images/brand/pereirao-384.png 384w, /images/brand/pereirao-768.png 768w"
        sizes="156px" width={384} height={256} alt="PEREIRÃO" fetchPriority="high" /></span>}
    </Link>
  );
}

/** A janela recorta apenas o símbolo da imagem oficial, sem redesenhar a marca. */
export function BrandSymbol() {
  return <span className="brand-symbol" aria-hidden="true"><img src="/images/brand/pereirao-384.png" width={384} height={256} alt="" /></span>;
}
