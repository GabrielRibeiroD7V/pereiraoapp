import { MapPin, UserRound } from 'lucide-react';
import { PostLink } from '../posts/PostLink';
import { useRef } from 'react';
import type { PublicProvider } from '../marketplace/types';
import { ContactLinks } from '../marketplace/ContactLinks';
import { PublicImage } from '../marketplace/PublicImage';
import { ContentState } from './ContentState';

export function ProviderList({ providers, carousel = false }: { providers: readonly PublicProvider[]; carousel?: boolean }) {
  const list = useRef<HTMLUListElement>(null);
  function move(direction: number) {
    list.current?.scrollBy({ left: direction * list.current.clientWidth * .8, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  if (providers.length === 0) {
    return <ContentState icon={UserRound} title="Novos profissionais em breve">
      Os perfis de profissionais e empresas da sua cidade aparecerão aqui.
    </ContentState>;
  }

  return (
    <div className={carousel ? 'public-carousel' : undefined}>
    <ul className="provider-list public-provider-list" ref={list} tabIndex={carousel ? 0 : undefined} aria-label={carousel ? 'Profissionais cadastrados' : undefined}
      onKeyDown={carousel ? (event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } } : undefined}>
      {providers.map((provider) => (
        <li key={provider.id}>
          <PostLink className="provider-item" to={`/prestadores/${encodeURIComponent(provider.slug)}`}
            aria-label={`Ver perfil de ${provider.name}`}>
            <span className="provider-item__avatar">
              {provider.avatarPath ? <PublicImage businessId={provider.id} path={provider.avatarPath} alt="" avatar /> : <UserRound aria-hidden="true" />}
            </span>
            <span className="provider-item__details">
              <strong>{provider.name}</strong>
              <span className="provider-item__classification"><span className="provider-item__specialty">{provider.specialty}</span><span className="provider-item__type">{provider.type === 'empresa' ? 'Empresa' : 'Autônomo'}</span></span>
              <span className="provider-item__location"><MapPin size={14} aria-hidden="true" />{provider.city.name}, {provider.city.state}</span>
              {!!provider.additionalSpecialties?.length && <span aria-label="Especialidades adicionais">{provider.additionalSpecialties.map(item => item.name).join(" · ")}</span>}
              {provider.description && <span className="public-description-preview">{provider.description}</span>}
            </span>
          </PostLink>
          <ContactLinks name={provider.name} whatsapp={provider.whatsapp} instagram={provider.instagram} compact />
        </li>
      ))}
    </ul>
    {carousel && providers.length > 1 && <div className="public-carousel-controls" role="group" aria-label="Controles dos profissionais"><button className="button button--secondary" onClick={() => move(-1)} aria-label="Profissionais anteriores">←</button><button className="button button--secondary" onClick={() => move(1)} aria-label="Próximos profissionais">→</button></div>}
    </div>
  );
}
