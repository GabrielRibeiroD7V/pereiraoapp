import { useState } from 'react';
import { cityLabel } from './cities';
import type { CityOption } from './cities';

/** Opções exclusivamente do catálogo recebido. Selects nativos fecham após a escolha. */
export function CitySelect({ id, label, cities, value, onChange, name, required = false, emptyLabel = 'Selecione uma cidade', fallbackLabel = 'Cidade selecionada indisponível', stateLabel = 'Estado', requireCityForState = false }: {
  id: string; label: string; cities: readonly CityOption[]; value: string;
  onChange: (value: string) => void; name?: string; required?: boolean; emptyLabel?: string; fallbackLabel?: string;
  stateLabel?: string; requireCityForState?: boolean;
}) {
  const [chosenState, setChosenState] = useState('');
  const selected = cities.find(city => city.id === value);
  const state = selected?.stateCode ?? chosenState;
  const states = [...new Set(cities.map(city => city.stateCode))].sort();
  return <div className="city-select">
    <div className="form-field"><label htmlFor={`${id}-state`}>{stateLabel}</label>
      <select id={`${id}-state`} value={state} required={required && !value} onChange={event => {
        setChosenState(event.target.value); onChange('');
      }}><option value="">Selecione</option>{states.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select>
    </div>
    <div className="form-field"><label htmlFor={id}>{label}</label>
      <select id={id} name={name} value={value} disabled={!state && !value} required={required || Boolean(requireCityForState && state)} onChange={event => {
        const next = cities.find(city => city.id === event.target.value);
        if (next) setChosenState(next.stateCode);
        onChange(event.target.value);
      }}>
        <option value="">{state && requireCityForState ? 'Selecione uma cidade' : emptyLabel}</option>
        {value && !selected && <option value={value}>{fallbackLabel}</option>}
        {cities.filter(city => city.stateCode === state).map(city => <option key={city.id} value={city.id}>{cityLabel(city)}</option>)}
      </select>
    </div>
  </div>;
}
