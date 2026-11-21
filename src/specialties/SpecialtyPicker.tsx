import type { CategoryId } from '../types/domain';
import { SpecialtyBadges } from './SpecialtyBadges';
export function SpecialtyPicker({ categories, primaryId, selected, onChange }: {
  categories: readonly { id: CategoryId; name: string }[]; primaryId: string;
  selected: readonly string[]; onChange: (ids: string[]) => void;
}) {
  const primary = categories.find(item => item.id === primaryId) ?? null;
  const extras = [...new Set(selected)].filter(id => id !== primaryId);
  function toggle(id: string, checked: boolean) { onChange(checked ? [...new Set([...extras, id])] : extras.filter(value => value !== id)); }
  return <fieldset className="specialty-picker"><legend>Especialidades adicionais (opcional)</legend>
    <p className="field-help">Um único perfil pode aparecer em várias categorias. Ao trocar a principal, a anterior continua como adicional.</p>
    {!primaryId && <p className="field-help">Escolha primeiro sua categoria principal.</p>}
    <div className="specialty-picker__options">{categories.filter(item => item.id !== primaryId).map(item => <label key={item.id}><input type="checkbox" disabled={!primaryId} checked={extras.includes(item.id)} onChange={event => toggle(item.id, event.target.checked)} />{item.name}</label>)}</div>
    <SpecialtyBadges primary={primary} additional={extras.map(id => ({ id, name: categories.find(item => item.id === id)?.name ?? `Indisponível (${id})` }))} onRemove={id => toggle(id, false)} />
  </fieldset>;
}
