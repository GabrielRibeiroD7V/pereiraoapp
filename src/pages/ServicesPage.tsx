import { useEffect, useRef, useState } from 'react';
import { PencilLine, Plus, Power, Trash2, Wrench } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ServiceEditor } from '../work/ServiceEditor';
import { WorkFrame } from '../work/WorkFrame';
import { useBusinessWork } from '../work/useBusinessWork';
import { formatPrice, workError } from '../work/validation';
import type { ServiceRow } from '../lib/database.types';
export function ServicesPage({ embedded = false, onChanged, startNew = false, onStartNew }: { embedded?: boolean; onChanged?: () => void; startNew?: boolean; onStartNew?: () => void } = {}) {
  const state = useBusinessWork();
  const [editor, setEditor] = useState<ServiceRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  useEffect(() => { if (startNew && state.data) { setEditor('new'); onStartNew?.(); } }, [startNew, state.data, onStartNew]);
  async function run(operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { await operation(); setDeleting(null); state.refresh(); onChanged?.(); } catch (cause) { setError(workError(cause)); } finally { busy.current = false; setPending(false); }
  }
  return <WorkFrame embedded={embedded} title={embedded ? "Serviços e preços" : "Meus serviços"} state={state}>
    {state.data && <>
      <div className="work-toolbar"><p>O que seu negócio oferece</p><button className="button button--primary" disabled={pending || state.loading} onClick={() => setEditor('new')}><Plus size={17} aria-hidden="true" />Adicionar serviço</button></div>
      {error && !deleting && <div role="alert" className="form-error"><p>{error}</p><button type="button" className="text-link" onClick={() => { setError(null); state.refresh(); }}>Atualizar lista</button></div>}
      {state.data.services.length === 0 ? <div className="work-empty"><Wrench size={27} aria-hidden="true" /><h2>Apresente seus serviços</h2><p>Adicione nome, categoria e preço. Você também pode atender sob orçamento.</p></div> : <ul className="service-list">{state.data.services.map((service) => <li key={service.id}>
        <div className="service-list__heading"><h2>{service.name}</h2><span className={`service-status${service.active ? ' is-active' : ''}`}>{service.active ? 'Ativo' : 'Inativo'}</span></div>
        <p className="field-help">{state.data!.catalog.categories.find((category) => category.id === service.category_id)?.name || service.category_id}</p>
        {service.description && <p className="service-description">{service.description}</p>}
        <div className="service-list__bottom"><strong>{formatPrice(service.pricing_type, service.price_amount_cents)}</strong><div className="work-icon-actions">
          <button className="icon-button" aria-label={`Editar serviço ${service.name}`} disabled={pending || state.loading} onClick={() => setEditor(service)}><PencilLine size={18} /></button>
          <button className="icon-button" aria-label={`${service.active ? 'Desativar' : 'Ativar'} serviço ${service.name}`} disabled={pending || state.loading} onClick={() => void run(() => state.repository!.setServiceActive(state.businessId, service.id, !service.active))}><Power size={18} /></button>
          <button className="icon-button icon-button--danger" aria-label={`Excluir serviço ${service.name}`} disabled={pending || state.loading} onClick={() => { setError(null); setDeleting(service); }}><Trash2 size={18} /></button>
        </div></div>
      </li>)}</ul>}
      {editor && <ServiceEditor key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} catalog={state.data.catalog} onClose={() => setEditor(null)} onSave={async (id, input, create) => { await state.repository!.saveService(state.businessId, id, input, create); state.refresh(); onChanged?.(); }} />}
      {deleting && <Modal title="Excluir serviço?" locked={pending} onClose={() => { setDeleting(null); setError(null); }}><p>Excluir “{deleting.name}”? As fotografias serão mantidas no portfólio, sem associação a este serviço.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="work-actions"><button className="button button--secondary" disabled={pending} onClick={() => setDeleting(null)}>Cancelar</button><button className="button button--danger" disabled={pending} onClick={() => void run(() => state.repository!.deleteService(state.businessId, deleting.id))}>{pending ? 'Excluindo…' : 'Confirmar exclusão'}</button></div></Modal>}
    </>}
  </WorkFrame>;
}
