import { MapPin, Star, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Provider } from '../types/domain';
import { ContentState } from './ContentState';

type ProviderSummary = Pick<Provider, 'id' | 'slug' | 'name' | 'specialty' | 'city' | 'avatar' | 'rating'>;

/** Não busca dados nem gera exemplos. A futura integração fornecerá a lista. */
export function ProviderList({ providers }: { providers: readonly ProviderSummary[] }) {
  if (providers.length === 0) {
    return <ContentState icon={UserRound} title="Novos profissionais em breve">
      Os perfis de profissionais e empresas da sua cidade aparecerão aqui.
    </ContentState>;
  }

  return (
    <ul className="provider-list">
      {providers.map((provider) => (
        <li key={provider.id}>
          <Link className="provider-item" to={`/prestadores/${encodeURIComponent(provider.slug)}`}
            aria-label={`Ver perfil de ${provider.name}`}>
            <span className="provider-item__avatar">
              {provider.avatar ? <img src={provider.avatar.src} alt="" loading="lazy" decoding="async"
                width={provider.avatar.width} height={provider.avatar.height} /> : <UserRound aria-hidden="true" />}
            </span>
            <span className="provider-item__details">
              <strong>{provider.name}</strong>
              <span>{provider.specialty}</span>
              <span className="provider-item__location"><MapPin size={14} aria-hidden="true" />{provider.city.name}, {provider.city.state}</span>
              {provider.rating && provider.rating.count > 0 && (
                <span className="provider-item__rating"><Star size={14} aria-hidden="true" />
                  {provider.rating.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  {' '}({provider.rating.count} avaliações)
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
