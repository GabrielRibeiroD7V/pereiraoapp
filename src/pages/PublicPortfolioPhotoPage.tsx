import {useCallback} from 'react';
import {Link,useParams} from 'react-router-dom';
import {PageHeader} from '../components/PageHeader';
import {PublicImage} from '../marketplace/PublicImage';
import {useMarketplace} from '../marketplace/MarketplaceProvider';
import {QueryStatus} from '../marketplace/QueryStatus';
import {usePublicQuery} from '../marketplace/usePublicQuery';

export function PublicPortfolioPhotoPage(){
  const {slug='',photoId=''}=useParams();
  const repository=useMarketplace();
  const loadProvider=useCallback((signal:AbortSignal)=>repository?repository.getProvider(slug,signal):Promise.resolve(null),[repository,slug]);
  const provider=usePublicQuery(slug,loadProvider);
  const loadPhoto=useCallback((signal:AbortSignal)=>repository&&provider.data?repository.getPhoto(provider.data.id,photoId,signal):Promise.resolve(null),[repository,provider.data?.id,photoId]);
  const photo=usePublicQuery(provider.data ? `${provider.data.id}:${photoId}` : '',loadPhoto);
  const profile=`/prestadores/${slug}`;
  return <article className="public-profile public-post-page">
    <Link className="back-link" to={profile}>Voltar ao perfil</Link>
    <QueryStatus {...provider}/>
    {provider.data && <><QueryStatus {...photo}/>{photo.data ? <div className="portfolio-photo-page">
      <header className="portfolio-photo-page__header"><Link to={profile}>{provider.data.name}</Link><span> · Portfólio</span></header>
      <div className="public-enlarged"><PublicImage businessId={provider.data.id} path={photo.data.storagePath} alt={photo.data.caption || 'Foto de trabalho'} /></div>
      <div className="portfolio-photo-page__body"><PageHeader title="Foto de trabalho"/><p className="post-full-description">{photo.data.caption?.trim() || 'Esta foto não tem legenda.'}</p>
        {photo.data.serviceName && <p>Serviço: {photo.data.serviceName}</p>}
        <nav className="social-profile-actions" aria-label="Conheça o profissional"><Link className="post-action" to={profile}>Ver perfil</Link><Link className="post-action" to={`${profile}#servicos`}>Conferir serviços</Link><Link className="post-action" to={`/mensagens/iniciar/${provider.data.id}`}>Conversar</Link></nav>
      </div>
    </div> : !photo.loading&&!photo.error&&<p>Esta foto não está disponível publicamente.</p>}</>}
  </article>;
}
