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
  it('abre UFs do catálogo e filtra cidades sem exigir digitação',()=>{
    function City(){const [value,setValue]=useState('guaira-pr');return <CitySelect id="city" label="Cidade" cities={regionalCities} value={value} onChange={setValue}/>;}
    render(<City/>);
    expect(screen.getByLabelText('Estado')).toHaveValue('PR');
    expect(screen.getByLabelText('Cidade')).toHaveValue('guaira-pr');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'Naviraí/MS'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado'),{target:{value:'MS'}});
    expect(screen.getByLabelText('Cidade')).toHaveValue('');
    expect(screen.getByRole('option',{name:'Naviraí/MS'})).toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'Guaíra/PR'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cidade'),{target:{value:'navirai-ms'}});
    expect(screen.getByLabelText('Cidade')).toHaveValue('navirai-ms');
  });
  it('seleciona várias UFs com dropdown e resumo; não duplica nem remove a origem',()=>{
    render(<Areas/>);
    const uf=screen.getByLabelText('Estado atendido'), city=screen.getByLabelText('Adicionar cidade atendida');
    fireEvent.change(uf,{target:{value:'PR'}});fireEvent.change(city,{target:{value:'guaira-pr'}});
    expect(city).toHaveValue('');
    fireEvent.change(city,{target:{value:'guaira-pr'}});expect(screen.getByRole('status')).toHaveTextContent('2 cidades selecionadas');
    fireEvent.change(uf,{target:{value:'MS'}});fireEvent.change(city,{target:{value:'eldorado-ms'}});
    expect(screen.getByRole('status')).toHaveTextContent('3 cidades selecionadas');
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).toHaveTextContent('Guaíra/PR');
    fireEvent.click(screen.getByRole('button',{name:'Remover atendimento em Eldorado/MS'}));
    expect(screen.getByRole('status')).toHaveTextContent('2 cidades selecionadas');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Remover atendimento em Mundo Novo/MS'})).not.toBeInTheDocument();
  });
  it('deriva novas UFs do catálogo, sem MS/PR fixos no controle',()=>{
    render(<CitySelect id="city" label="Cidade" cities={[{id:'cidade-sc',name:'Cidade do catálogo',stateCode:'SC'}]} value="cidade-sc" onChange={()=>{}}/>);
    expect(screen.getByLabelText('Estado')).toHaveValue('SC');
    expect(screen.queryByRole('option',{name:'MS'})).not.toBeInTheDocument();
  });
  it('preserva seleções antigas indisponíveis e permite removê-las expressamente',()=>{
    render(<ServiceAreaPicker cities={regionalCities} originId="mundo-novo-ms" selectedIds={['guaira-pr','indisponivel']} onChange={()=>{}}/>);
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).toHaveTextContent('Guaíra/PR');
    expect(screen.getByRole('button',{name:/Remover atendimento em Cidade indisponível/})).toBeInTheDocument();
  });
});
