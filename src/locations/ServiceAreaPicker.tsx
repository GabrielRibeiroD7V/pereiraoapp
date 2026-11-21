import { useId } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { cityLabel } from './cities';
import type { CityOption } from './cities';
import { CitySelect } from './CitySelect';

export function ServiceAreaPicker({ cities, originId, selectedIds, onChange }: {
  cities: readonly CityOption[]; originId: string; selectedIds: readonly string[]; onChange: (ids: string[]) => void;
}) {
  const id = useId(), origin = cities.find(city => city.id === originId);
  const ids = [...new Set([originId, ...selectedIds].filter(Boolean))];
  const additional = ids.filter(value => value !== originId);
  return <fieldset className="service-areas city-areas"><legend>Área de atendimento</legend>
    <p className="field-help">Adicione as cidades onde você presta serviços. Um único perfil pode atender várias cidades.</p>
    <p className="included-city"><MapPin size={17} aria-hidden="true" /><span>{origin ? cityLabel(origin) : 'Sua cidade'} já está incluída</span><Check size={16} aria-hidden="true" /></p>
    <CitySelect id={`${id}-area-city`} label="Adicionar cidade atendida" stateLabel="Estado atendido" cities={cities} value="" emptyLabel="Selecione para adicionar" onChange={value => {
      if (value && !ids.includes(value) && cities.some(city => city.id === value)) onChange([...new Set([...selectedIds, value])]);
    }} />
    <p className="field-help" role="status">{ids.length} {ids.length === 1 ? 'cidade selecionada' : 'cidades selecionadas'}</p>
    {additional.length > 0 && <ul className="city-areas__selected" aria-label="Cidades adicionais selecionadas">{additional.map(value => {
      const city = cities.find(item => item.id === value), label = city ? cityLabel(city) : `Cidade indisponível (${value})`;
      return <li key={value}><span>{label}</span><button type="button" className="city-areas__remove" aria-label={`Remover atendimento em ${label}`} onClick={() => onChange(selectedIds.filter(item => item !== value))}><X size={15} aria-hidden="true" /></button></li>;
    })}</ul>}
  </fieldset>;
}
