import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { PortfolioRow, ServiceRow } from '../lib/database.types';
import { Modal } from '../components/Modal';
import { optimizeImage } from './images';
import { workError } from './validation';
export function PhotoEditor({ initial, services, onClose, onSave }: { initial?: PortfolioRow; services: ServiceRow[]; onClose: () => void; onSave: (id: string, file: Blob | null, caption: string, serviceId: string | null) => Promise<void> }) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [serviceId, setServiceId] = useState(initial?.service_id ?? '');
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const detailsOnly = initial?.media_state === 'ready';
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => { if (!file) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function choose(selected?: File) {
    const token = ++generation.current; setError(null); setFile(null);
    if (!selected) { setProcessing(false); return; }
    setProcessing(true);
    try { const value = await optimizeImage(selected); if (generation.current === token) setFile(value); }
    catch (cause) { if (generation.current === token) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a imagem.'); }
    finally { if (generation.current === token) setProcessing(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current || processing) return;
    if (!initial && !file) { setError('Selecione uma fotografia antes de enviar.'); return; }
    busy.current = true; setPending(true); setError(null);
    try { await onSave(id, file, caption, serviceId || null); onClose(); }
    catch (cause) { setError(workError(cause)); } finally { busy.current = false; setPending(false); }
  }
  return <Modal title={detailsOnly ? 'Editar fotografia' : initial ? 'Retomar envio' : 'Adicionar fotografia'} onClose={onClose} locked={pending}>
    <form className="auth-form" onSubmit={submit} aria-busy={pending || processing}><fieldset className="work-fields" disabled={pending}>
      {!detailsOnly && <div className="form-field"><label htmlFor="portfolio-file">Fotografia do trabalho</label><input id="portfolio-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void choose(event.target.files?.[0])} /><p className="field-help">JPEG, PNG ou WebP, até 10 MB. A imagem será otimizada antes do envio.</p>
        {initial && <p className="field-help">Você pode verificar o envio anterior ou selecionar novamente a fotografia.</p>}
      </div>}
      {processing && <p role="status">Preparando imagem…</p>}
      {preview && <img className="upload-preview" src={preview} alt="Prévia da fotografia selecionada" />}
      <div className="form-field"><label htmlFor="portfolio-caption">Legenda (opcional)</label><textarea id="portfolio-caption" rows={2} maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} /></div>
      <div className="form-field"><label htmlFor="portfolio-service">Associar a um serviço (opcional)</label><select id="portfolio-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Sem associação</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.active ? '' : ' (inativo)'}</option>)}</select></div>
    </fieldset>{error && <p role="alert" className="form-error">{error}</p>}<div className="work-actions"><button className="button button--secondary" type="button" disabled={pending} onClick={onClose}>Cancelar</button><button className="button button--primary" disabled={pending || processing}>{pending ? 'Aguarde…' : detailsOnly ? 'Salvar detalhes' : initial && !file ? 'Verificar envio' : 'Enviar fotografia'}</button></div></form>
  </Modal>;
}
