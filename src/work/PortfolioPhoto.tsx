import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { PortfolioRow } from '../lib/database.types';
import type { WorkRepository } from './types';
import { cacheImageUrl, getCachedImageUrl } from './imageUrlCache';
export function PortfolioPhoto({ item, repository, onOpen }: { item: PortfolioRow; repository: WorkRepository; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(() => getCachedImageUrl(item.storage_path));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true; setUrl(getCachedImageUrl(item.storage_path)); setFailed(false);
    void repository.imageUrl(item.storage_path).then((value) => { if (live) setUrl(cacheImageUrl(item.storage_path,value)); }).catch(() => { if (live && !getCachedImageUrl(item.storage_path)) setFailed(true); });
    return () => { live = false; };
  }, [repository, item.storage_path, attempt]);
  async function open() { try { onOpen(await repository.imageUrl(item.storage_path)); } catch { setFailed(true); } }
  return <div className="portfolio-image">{url && !failed ? <button type="button" aria-label={`Ampliar fotografia ${item.caption || 'do trabalho'}`} onClick={() => void open()}><img src={url} alt={item.caption || 'Fotografia de trabalho cadastrada pelo prestador'} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></button> : <div className="portfolio-image__placeholder"><ImageOff size={25} aria-hidden="true" /><span>{failed ? 'Imagem indisponível' : 'Carregando imagem…'}</span>{failed && <button type="button" className="text-link" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>}</div>}</div>;
}
