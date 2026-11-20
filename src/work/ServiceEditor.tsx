import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ServiceRow } from '../lib/database.types';
import type { ProfessionalCatalog } from '../professional/types';
import type { ServiceInput } from './types';
import { emptyService, validateService, workError } from './validation';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
export function ServiceEditor({ initial, catalog, onSave, onClose }: { initial?: ServiceRow; catalog: ProfessionalCatalog; onSave: (id: string, input: ServiceInput, create: boolean) => Promise<void>; onClose: () => void }) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [input, setInput] = useState<ServiceInput>(() => initial ? { name: initial.name, description: initial.description ?? '', categoryId: initial.category_id, pricingType: initial.pricing_type, price: initial.price_amount_cents === null ? '' : (initial.price_amount_cents / 100).toFixed(2).replace('.', ','), active: initial.active } : { ...emptyService });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  function change<K extends keyof ServiceInput>(key: K, value: ServiceInput[K]) { setInput((current) => ({ ...current, [key]: value })); setError(null); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    const issue = validateService(input);
    if (issue || !catalog.categories.some((category) => category.id === input.categoryId)) { setError(issue || 'Selecione uma categoria disponível.'); return; }
    busy.current = true; setPending(true); setError(null);
    try { await onSave(id, input, !initial); onClose(); } catch (cause) { setError(workError(cause)); } finally { busy.current = false; setPending(false); }
  }
  return <Modal title={initial ? 'Editar serviço' : 'Adicionar serviço'} onClose={onClose} locked={pending}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="auth-form" onSubmit={submit} aria-busy={pending}><fieldset className="work-fields" disabled={pending}>
      <FormField id="service-name" label="Nome do serviço" value={input.name} onChange={(event) => change('name', event.target.value)} required minLength={2} maxLength={120} />
      <div className="form-field"><label htmlFor="service-description">Descrição</label><textarea id="service-description" rows={3} maxLength={2000} value={input.description} onChange={(event) => change('description', event.target.value)} /></div>
      <div className="form-field"><label htmlFor="service-category">Categoria</label><select id="service-category" value={input.categoryId} required onChange={(event) => change('categoryId', event.target.value)}><option value="">Selecione</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="form-field"><label htmlFor="service-price-type">Tipo de preço</label><select id="service-price-type" value={input.pricingType} onChange={(event) => change('pricingType', event.target.value as ServiceInput['pricingType'])}><option value="quote">Sob orçamento</option><option value="fixed">Preço fixo</option><option value="starting-at">A partir de</option></select></div>
      {input.pricingType !== 'quote' && <FormField id="service-price" label="Preço (R$)" inputMode="decimal" placeholder="150,00" maxLength={16} value={input.price} required onChange={(event) => change('price', event.target.value)} />}
      <label className="work-checkbox"><input type="checkbox" checked={input.active} onChange={(event) => change('active', event.target.checked)} />Serviço ativo</label>
    </fieldset><div className="work-actions"><button className="button button--secondary" type="button" disabled={pending} onClick={onClose}>Cancelar</button><button className="button button--primary" disabled={pending}>{pending ? 'Salvando…' : 'Salvar serviço'}</button></div></form>
  </Modal>;
}
