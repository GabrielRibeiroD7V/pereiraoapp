import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { marketplaceFixture } from '../test/marketplaceFixtures';
import { categoryCatalog16 as catalog } from '../test/categoryCatalog';
import type { OffersRepository } from '../offers/model';

function History() {
  const nav=useNavigate(),location=useLocation();
  return <><button onClick={()=>nav(-1)}>Histórico anterior</button><button onClick={()=>nav(1)}>Histórico seguinte</button><output aria-label="URL de teste">{location.search}</output></>;
}
function open(path:string, unified=false, delayed=false) {
  const market=marketplaceFixture();
  let resolve!: (value:typeof catalog)=>void;
  market.getCategories=vi.fn(()=>delayed?new Promise<typeof catalog>(done=>{resolve=done;}):Promise.resolve(catalog));
  market.search=vi.fn(async(_filters,page)=>({items:[],page,hasNext:page===1}));
  const offers={search:vi.fn(async()=>Array.from({length:21},(_,i)=>({id:String(i),kind:'provider',url:'/prestadores/local-'+i,title:'Resultado local '+i,description:'',author:'Fixture local',pricing_type:null}))) } as unknown as OffersRepository;
  render(<MemoryRouter initialEntries={[path]}><App marketplaceRepository={market} offersRepository={unified?offers:undefined} /><History /></MemoryRouter>);
  return {market,offers,resolve:(value:typeof catalog)=>resolve(value)};
}

it('mantém seis populares e revela as 16 em lista compacta ao abrir',async()=>{
  open('/');
  const region=screen.getByRole('region',{name:'Categorias populares'});
  expect(region.querySelectorAll('.category-tile')).toHaveLength(6);
  const details=region.querySelector('details')!;
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(within(region).getByText('Ver todas as categorias'));
  details.open=true;
  await waitFor(()=>expect(within(screen.getByRole('list',{name:'Todas as categorias'})).getAllByRole('link')).toHaveLength(16));
  for(const category of catalog)expect(within(screen.getByRole('list',{name:'Todas as categorias'})).getByRole('link',{name:category.name})).toHaveAttribute('href',`/buscar?categoria=${category.id}`);
});

it.each([false,true])('as 16 opções e URLs não dependem das seis ilustrações (unificada=%s)',async unified=>{
  const f=open('/buscar?categoria=beleza-estetica&cidade=guaira-pr',unified,true);
  const select=await screen.findByRole('combobox',{name:unified?'Área':'Categoria'});
  expect(select).toHaveValue('beleza-estetica');
  f.resolve(catalog);
  await screen.findByRole('option',{name:'Beleza e Estética'});
  expect(select).toHaveValue('beleza-estetica');
  for(const category of catalog){
    fireEvent.change(select,{target:{value:category.id}});
    expect(select).toHaveValue(category.id);
  }
  fireEvent.change(select,{target:{value:'mecanica-automotivo'}});
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(()=>expect(screen.getByLabelText('URL de teste')).toHaveTextContent('categoria=mecanica-automotivo'));
  expect(screen.getByLabelText('URL de teste')).toHaveTextContent('cidade=guaira-pr');
  if(unified)await waitFor(()=>expect(f.offers.search).toHaveBeenLastCalledWith(expect.objectContaining({area:'mecanica-automotivo',city:'guaira-pr'})));
  else await waitFor(()=>expect(f.market.search).toHaveBeenLastCalledWith(expect.objectContaining({categoryId:'mecanica-automotivo',cityId:'guaira-pr'}),1,expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button',{name:/Próxima/}));
  expect(screen.getByLabelText('URL de teste')).toHaveTextContent('pagina=2');
  expect(screen.getByLabelText('URL de teste')).toHaveTextContent('categoria=mecanica-automotivo');
  fireEvent.click(screen.getByRole('button',{name:'Histórico anterior'}));
  await waitFor(()=>expect(screen.getByLabelText('URL de teste')).not.toHaveTextContent('pagina=2'));
  fireEvent.click(screen.getByRole('button',{name:'Histórico anterior'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:unified?'Área':'Categoria'})).toHaveValue('beleza-estetica'));
  fireEvent.click(screen.getByRole('button',{name:'Histórico seguinte'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:unified?'Área':'Categoria'})).toHaveValue('mecanica-automotivo'));
});
