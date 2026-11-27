import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { categories } from '../config/categories';
import { CategoryTile } from '../components/CategoryTile';
import { ProviderList } from '../components/ProviderList';
import type { PublicProvider } from '../marketplace/types';
import { marketplaceFixture } from '../test/marketplaceFixtures';

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <output aria-label="URL atual">{pathname}{search}</output>;
}

function open(path = '/') {
  const market=marketplaceFixture();
  market.search=async(_filters,page)=>({items:[],page,hasNext:false});
  render(<MemoryRouter initialEntries={[path]}><App marketplaceRepository={market} /><CurrentLocation /></MemoryRouter>);
}

describe('Início', () => {
  it('mostra a logo oficial proporcional e uma única busca acessível', () => {
    open();
    const logo = screen.getByRole('img', { name: 'PEREIRÃO' });
    expect(logo).toHaveAttribute('viewBox', '20 151 345 87');
    expect(logo.querySelectorAll('image')).toHaveLength(2);
    for (const layer of logo.querySelectorAll('image')) {
      expect(layer).toHaveAttribute('href', '/images/brand/pereirao-384.png');
    }
    expect(screen.getAllByRole('search')).toHaveLength(1);
    expect(screen.getByRole('searchbox', { name: 'Buscar serviços ou profissionais' })).toHaveAttribute('placeholder', 'Buscar serviços ou profissionais');
    expect(screen.queryByRole('button', { name: /notifica/i })).not.toBeInTheDocument();
  });

  it.each(['eletricista', '  instalação & manutenção + elétrica  '])('preserva o termo %s na URL', (term) => {
    open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: term } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent(`/buscar?${new URLSearchParams({ q: term.trim() })}`);
    expect(screen.getByLabelText('Sua busca')).toHaveTextContent(term.trim());
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Buscar' })).toHaveAttribute('aria-current', 'page');
  });

  it('pesquisa vazia não cria parâmetro vazio', () => {
    open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent(/^\/buscar$/);
  });

  it.each(categories)('navega para a categoria $name', async ({ id, name }) => {
    open();
    const grid=screen.getByRole('region', { name: 'Categorias populares' }).querySelector('.category-grid')!;
    expect(within(grid as HTMLElement).getAllByRole('link')).toHaveLength(6);
    fireEvent.click(within(grid as HTMLElement).getByRole('link', { name }));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent(`/buscar?categoria=${id}`);
    expect(await screen.findByText(name,{selector:'strong'})).toBeInTheDocument();
  });

  it('mantém estado vazio sem fotos ou avaliações fictícias e convite com destino real', () => {
    open();
    const featured = screen.getByRole('region', { name: 'Profissionais cadastrados' });
    expect(within(featured).getByText('Novos profissionais em breve')).toBeInTheDocument();
    expect(within(featured).queryByRole('link')).not.toBeInTheDocument();
    const invite = screen.getByRole('region', { name: 'Destaques do PEREIRÃO' });
    fireEvent.click(within(invite).getByRole('button',{name:/Mostrar banner 2/}));
    expect(within(invite).getByRole('link', { name: /Profissional, divulgue seu trabalho/ })).toHaveAttribute('href', '/conta/profissional');
    expect(screen.getAllByRole('img')).toHaveLength(2); // Logo e banner ativo; ilustrações decorativas têm alt vazio.
  });

  it('reconhece parâmetros em acesso direto e ignora categoria desconhecida', () => {
    open('/buscar?q=pintura&categoria=nao-existe');
    expect(screen.getByLabelText('Sua busca')).toHaveTextContent('Você pesquisou: pintura');
    expect(screen.queryByText('Categoria:')).not.toBeInTheDocument();
  });

  it('volta ao placeholder neutro se uma futura imagem oficial falhar', () => {
    render(<MemoryRouter><CategoryTile category={{ id: 'pintura', name: 'Pintura', officialImage: {
      kind: 'official-category', src: '/missing.png', alt: 'Pintura', width: 400, height: 300,
    } }} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Pintura' });
    const image = link.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(link.querySelector('img')).toBeNull();
    expect(link).toHaveAttribute('href', '/buscar?categoria=pintura');
  });
});

// Fixture restrita ao teste: não importada ou servida pelo aplicativo.
const provider: PublicProvider = {
  id: 'test', slug: 'teste', name: 'Prestador de teste', specialty: 'Serviço de teste',
  city: { id: 'test-city', name: 'Cidade de teste', state: 'MS' }, avatarPath: null, type: 'autonomo', categoryId: null, description: null, whatsapp: null, instagram: null,
};

describe('estrutura da lista futura', () => {
  it('omite avaliação ausente e oferece acesso ao perfil', () => {
    render(<MemoryRouter><ProviderList providers={[provider]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Ver perfil de Prestador de teste' })).toHaveAttribute('href', '/prestadores/teste');
    expect(screen.queryByText(/avaliações/)).not.toBeInTheDocument();
  });

  it('não acrescenta avaliações, selos ou distâncias ao perfil público', () => {
    render(<MemoryRouter><ProviderList providers={[provider]} /></MemoryRouter>);
    expect(screen.queryByText(/avaliações|verificado|km/)).not.toBeInTheDocument();
  });
});
