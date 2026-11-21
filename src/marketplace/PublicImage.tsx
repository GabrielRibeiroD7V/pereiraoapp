import { useCallback, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useMarketplace } from './MarketplaceProvider';
import { usePublicQuery } from './usePublicQuery';
export function PublicImage({ businessId, path, alt, avatar = false }: { businessId: string; path: string; alt: string; avatar?: boolean }) {
  const repository = useMarketplace();
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(() => repository ? repository.getImageUrl(businessId, path) : Promise.reject(new Error('Unavailable')), [repository, businessId, path]);
  const state = usePublicQuery(`${businessId}:${path}`, load);
  if (!state.data || failed === state.data) return <span className={avatar ? 'public-avatar-fallback' : 'public-image-fallback'}>{avatar ? <UserRound aria-hidden="true" /> : state.loading ? 'Carregando imagem…' : 'Imagem indisponível'}</span>;
  return <img src={state.data} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(state.data!)} />;
}
