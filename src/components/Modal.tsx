import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, children, onClose, locked = false }: { title: string; children: ReactNode; onClose: () => void; locked?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (dialog && !dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
    return () => { if (dialog?.open && dialog.close) dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const viewport=window.visualViewport, dialog=ref.current;
    const update=()=>{
      if(!dialog)return;
      dialog.dataset.shortViewport=String((viewport?.height ?? window.innerHeight)<500);
      dialog.style.setProperty('--visual-height',`${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty('--visual-width',`${viewport?.width ?? window.innerWidth}px`);
      dialog.style.setProperty('--visual-top',`${viewport?.offsetTop ?? 0}px`);
      dialog.style.setProperty('--visual-left',`${viewport?.offsetLeft ?? 0}px`);
    };
    update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  }, []);
  return <dialog ref={ref} className="work-modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
    <div className="work-modal__heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" aria-label="Fechar" disabled={locked} onClick={onClose}><X size={20} /></button></div>
    <div className="work-modal__body">{children}</div>
  </dialog>;
}
