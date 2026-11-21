import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CitySelect } from './CitySelect';
import { ServiceAreaPicker } from './ServiceAreaPicker';
import { matchesCity } from './cities';
import { regionalCityFixture as regionalCities } from '../test/regionalCities';

function Areas() {
  const [ids, setIds] = useState<string[]>([]);
  return <ServiceAreaPicker cities={regionalCities} originId="mundo-novo-ms" selectedIds={ids} onChange={setIds} />;
}
describe('seletores regionais', () => {
  it.each(['guaira','GUAÍRA','guaira pr','PR Guaíra'])('pesquisa sem depender de acentos e considera UF: %s', query => {
    expect(matchesCity(regionalCities[5]!, query)).toBe(true);
    expect(matchesCity(regionalCities[0]!, query)).toBe(false);
  });
  it('mantém a cidade selecionada quando uma pesquisa não a inclui', () => {
    render(<CitySelect id="city" label="Cidade" cities={regionalCities} value="guaira-pr" onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Pesquisar cidade'), { target: { value: 'Navirai' } });
    expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue('guaira-pr');
    expect(screen.getByRole('option', { name: 'Naviraí/MS' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Guaíra/PR' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Eldorado/MS' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pesquisar cidade'), { target: { value: 'sem resultado' } });
    expect(screen.getByRole('status')).toHaveTextContent('Sua seleção foi mantida');
  });
  it('seleciona várias UFs e preserva escolhas ao filtrar/remover', () => {
    render(<Areas />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guaíra/PR' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Eldorado/MS' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 cidades selecionadas');
    fireEvent.change(screen.getByLabelText('Pesquisar áreas de atendimento'), { target: { value: 'PR' } });
    expect(screen.getByRole('checkbox', { name: 'Guaíra/PR' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Eldorado/MS' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover atendimento em Eldorado/MS' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 cidades selecionadas');
    fireEvent.change(screen.getByLabelText('Pesquisar áreas de atendimento'), { target: { value: '' } });
    expect(screen.getByRole('checkbox', { name: 'Eldorado/MS' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Guaíra/PR' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Remover atendimento em Mundo Novo/MS' })).not.toBeInTheDocument();
  });
});
