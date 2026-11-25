import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
/** Aguarda o conteúdo remoto antes de posicionar o destino do link de serviços. */
export function useSectionAnchor(ready: boolean) {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (ready && ['#servicos','#horarios'].includes(hash)) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, key, ready]);
}
