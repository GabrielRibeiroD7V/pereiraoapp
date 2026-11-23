import {render,screen,within} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {ReviewClassification} from './ReviewClassification';
import {adminFixture} from '../test/adminFixtures';
describe('classificação e atendimento na revisão administrativa',()=>{
  it('distingue lista vazia de leitura indisponível',()=>{
    const catalog={primaryCategory:null,additionalSpecialties:[],originCity:null,serviceCities:[]};
    render(<ReviewClassification catalog={catalog}/>);
    expect(screen.getByText('Nenhuma especialidade adicional informada.')).toBeVisible();
    expect(screen.getByText('Nenhuma cidade de atendimento informada.')).toBeVisible();
    expect(screen.getAllByText('Não informada.')).toHaveLength(2);
    expect(screen.queryByText('Leitura indisponível.')).not.toBeInTheDocument();
  });
  it('mostra todos os itens, UF e itens inativos sem selo de verificado',()=>{
    const catalog=adminFixture().detail.reviewCatalog!;
    catalog.additionalSpecialties=[{id:'pintura',name:'Pintura',active:true},{id:'eletrica',name:'Elétrica',active:false}];
    catalog.serviceCities=[catalog.originCity!,{id:'guaira-pr',name:'Guaíra',stateCode:'PR',active:true}];
    render(<ReviewClassification catalog={catalog}/>);
    const region=screen.getByRole('region',{name:'Especialidades e atendimento declarados'});
    expect(within(region).getByText('Climatização')).toBeVisible();
    expect(within(region).getByText('Pintura')).toBeVisible();
    expect(within(region).getByText('Elétrica (inativa)')).toBeVisible();
    expect(within(region).getAllByText('Mundo Novo/MS')).toHaveLength(2);
    expect(within(region).getByText('Guaíra/PR')).toBeVisible();
    expect(region).toHaveTextContent('Informações declaradas pelo responsável');
    expect(region).toHaveTextContent('não representa verificação');
  });
  it('preserva textos longos integralmente',()=>{
    const catalog=adminFixture().detail.reviewCatalog!;
    const long='Especialidade declarada com nome extenso '.repeat(10);
    catalog.additionalSpecialties=[{id:'longa',name:long,active:true}];
    catalog.serviceCities=[{id:'cidade-longa',name:'Cidade com nome extenso '.repeat(8),stateCode:'PR',active:true}];
    render(<ReviewClassification catalog={catalog}/>);
    expect(screen.getAllByRole('listitem')[0]?.textContent).toBe(long);
    expect(screen.getAllByRole('listitem')[1]?.textContent).toContain('Cidade com nome extenso');
  });
  it('não transforma erro ou migração pendente em lista vazia',()=>{
    render(<ReviewClassification catalog={null} fallbackCategory="Pintura" fallbackCity="Mundo Novo"/>);
    expect(screen.getByRole('status')).toHaveTextContent('indisponível');
    expect(screen.getAllByText('Leitura indisponível.')).toHaveLength(2);
    expect(screen.queryByText('Nenhuma cidade de atendimento informada.')).not.toBeInTheDocument();
    expect(screen.getByText('Mundo Novo (UF indisponível)')).toBeVisible();
  });
});
