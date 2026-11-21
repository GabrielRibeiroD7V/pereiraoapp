import { useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { cityLabel, matchesCity } from './cities';
import type { CityOption } from './cities';

export function ServiceAreaPicker({ cities, originId, selectedIds, onChange }: {
  cities: readonly CityOption[]; originId: string; selectedIds: readonly string[]; onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const origin = cities.find(city => city.id === originId);
  const ids = new Set([originId, ...selectedIds].filter(Boolean));
  const additional = cities.filter(city => city.id !== originId);
  const visible = additional.filter(city => matchesCity(city, query));
  const selected = additional.filter(city => ids.has(city.id));
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter(value => value !== id));
  }
  return <fieldset className="service-areas city-areas"><legend>Área de atendimento</legend>
    <p className="field-help">Selecione onde você presta serviços. Um único perfil pode atender várias cidades.</p>
    <p className="included-city"><MapPin size={17} aria-hidden="true" /><span>{origin ? cityLabel(origin) : 'Sua cidade'} já está incluída</span><Check size={16} aria-hidden="true" /></p>
    <div className="form-field"><label htmlFor="area-city-query">Pesquisar áreas de atendimento</label><input id="area-city-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome da cidade ou UF" maxLength={120} autoComplete="off" aria-controls="area-city-options" /></div>
    <p className="field-help" role="status">{ids.size} {ids.size === 1 ? 'cidade selecionada' : 'cidades selecionadas'}</p>
    {selected.length > 0 && <ul className="city-areas__selected" aria-label="Cidades adicionais selecionadas">{selected.map(city => <li key={city.id}><span>{cityLabel(city)}</span><button type="button" className="city-areas__remove" aria-label={`Remover atendimento em ${cityLabel(city)}`} onClick={() => toggle(city.id, false)}><X size={15} aria-hidden="true" /></button></li>)}</ul>}
    <div id="area-city-options" className="city-areas__options">{visible.map(city => <label key={city.id}><input type="checkbox" checked={ids.has(city.id)} onChange={event => toggle(city.id, event.target.checked)} />{cityLabel(city)}</label>)}</div>
    {visible.length === 0 && <p className="field-help">{query ? 'Nenhuma outra cidade encontrada. As cidades selecionadas continuam incluídas.' : 'Não há outras cidades disponíveis no catálogo.'}</p>}
  </fieldset>;
}
