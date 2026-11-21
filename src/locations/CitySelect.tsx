import { useState } from 'react';
import { cityLabel, matchesCity } from './cities';
import type { CityOption } from './cities';

// Select nativo para teclado/leitores de tela; a pesquisa nunca apaga a seleção atual.
export function CitySelect({ id, label, cities, value, onChange, name, required = false, emptyLabel = 'Selecione uma cidade', fallbackLabel = 'Cidade selecionada indisponível' }: {
  id: string; label: string; cities: readonly CityOption[]; value: string;
  onChange: (value: string) => void; name?: string; required?: boolean; emptyLabel?: string; fallbackLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const matches = cities.filter(city => matchesCity(city, query));
  return <div className="form-field city-select">
    <label htmlFor={id}>{label}</label>
    <label className="visually-hidden" htmlFor={`${id}-query`}>Pesquisar {label.toLocaleLowerCase('pt-BR')}</label>
    <input id={`${id}-query`} type="search" placeholder="Pesquisar por nome ou UF" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} autoComplete="off" aria-controls={id} />
    <select id={id} name={name} value={value} required={required} onChange={event => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {value && !cities.some(city => city.id === value) && <option value={value}>{fallbackLabel}</option>}
      {cities.filter(city => city.id === value || matchesCity(city, query)).map(city => <option key={city.id} value={city.id}>{cityLabel(city)}</option>)}
    </select>
    {query && matches.length === 0 && <p className="field-help" role="status">Nenhuma cidade encontrada. Sua seleção foi mantida.</p>}
  </div>;
}
