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
  return <dialog ref={ref} className="work-modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
    <div className="work-modal__heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" aria-label="Fechar" disabled={locked} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
