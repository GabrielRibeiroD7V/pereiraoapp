import { X } from 'lucide-react';
export interface Specialty { id: string; name: string }
export function SpecialtyBadges({ primary, additional, onRemove }: { primary: Specialty | null; additional: readonly Specialty[]; onRemove?: (id: string) => void }) {
  return <ul className="specialty-badges" aria-label="Especialidades selecionadas">
    {primary && <li className="specialty-badges__primary"><strong>{primary.name}</strong><span>Principal</span></li>}
    {additional.filter(item => item.id !== primary?.id).map(item => <li key={item.id}><span>{item.name}</span>{onRemove && <button type="button" aria-label={`Remover especialidade ${item.name}`} onClick={() => onRemove(item.id)}><X size={15} aria-hidden="true" /></button>}</li>)}
  </ul>;
}
