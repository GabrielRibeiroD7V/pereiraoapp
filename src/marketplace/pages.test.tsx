import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { regionalCityFixture } from '../test/regionalCities';
import { marketplaceFixture, photoFixtureId, publicProviderFixture as p } from '../test/marketplaceFixtures';
import type { PublicPage, PublicProvider } from './types';
function Location() { const location = useLocation(), navigate = useNavigate(); return <><output aria-label="URL atual">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Histórico voltar</button><button onClick={() => navigate(1)}>Histórico avançar</button></>; }
function open(path: string, repository = marketplaceFixture()) { render(<MemoryRouter initialEntries={[path]}><App marketplaceRepository={repository} /><Location /></MemoryRouter>); return repository; }
describe('navegação do marketplace sem login', () => {
  it('preserva todos os filtros e a paginação na URL e reinicia página ao pesquisar', async () => {
    const repository = marketplaceFixture(), search = vi.spyOn(repository, 'search');
    open('/buscar?q=instalacao&categoria=climatizacao&cidade=mundo-novo-ms&tipo=empresa', repository);
    await screen.findByRole('link', { name: 'Ver perfil de Prestador simulado' });
    fireEvent.click(screen.getByRole('button', { name: /Próxima — resultados/ }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith({ query: 'instalacao', categoryId: 'climatizacao', cityId: 'mundo-novo-ms', type: 'empresa' }, 2, expect.any(AbortSignal)));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent('pagina=2');
    fireEvent.change(screen.getByLabelText('Buscar por nome, especialidade ou serviço'), { target: { value: 'pintura' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent('q=pintura&categoria=climatizacao&cidade=mundo-novo-ms&tipo=empresa');
    expect(screen.getByLabelText('URL atual')).not.toHaveTextContent('pagina=');
  });
  it('mantém cidade atendida na URL, paginação e histórico voltar/avançar', async () => {
    const repository = marketplaceFixture(), search = vi.spyOn(repository, 'search');
    repository.getCities = async () => regionalCityFixture.map(city => ({ id: city.id, name: city.name, state: city.stateCode }));
    open('/buscar', repository);
    await screen.findByRole('option', { name: 'PR' });
    expect(screen.getByLabelText('Cidade atendida', { exact: true })).toHaveValue('mundo-novo-ms');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PR' } });
    fireEvent.change(screen.getByLabelText('Cidade atendida', { exact: true }), { target: { value: 'guaira-pr' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ cityId: 'guaira-pr' }), 1, expect.any(AbortSignal)));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent('cidade=guaira-pr');
    fireEvent.click(screen.getByRole('button', { name: 'Histórico voltar' }));
    await waitFor(() => expect(screen.getByLabelText('Cidade atendida', { exact: true })).toHaveValue('mundo-novo-ms'));
    fireEvent.click(screen.getByRole('button', { name: 'Histórico avançar' }));
    await waitFor(() => expect(screen.getByLabelText('Cidade atendida', { exact: true })).toHaveValue('guaira-pr'));
    fireEvent.click(screen.getByRole('button', { name: /Próxima — resultados/ }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ cityId: 'guaira-pr' }), 2, expect.any(AbortSignal)));
  });
  it('perfil apresenta as cidades atendidas, incluindo municípios de outra UF', async () => {
    const repository = marketplaceFixture();
    repository.getAreas = async () => ({ items: regionalCityFixture.filter(city => ['mundo-novo-ms', 'guaira-pr', 'eldorado-ms'].includes(city.id)).map(city => ({ id: city.id, name: city.name, state: city.stateCode })), page: 1, hasNext: false });
    open('/prestadores/prestador-simulado', repository);
    fireEvent.click(await screen.findByRole('tab', { name: 'Sobre' }));
    const region = await screen.findByRole('region', { name: 'Área de atendimento' });
    expect(await within(region).findByText('Guaíra/PR')).toBeVisible();
    expect(within(region).getByText('Mundo Novo/MS')).toBeVisible();
    expect(within(region).getByText('Eldorado/MS')).toBeVisible();
  });
  it('mostra perfil, preços e contatos seguros sem exigir autenticação', async () => {
    open('/prestadores/prestador-simulado');
    await screen.findByRole('heading', { name: 'Prestador simulado' });
    fireEvent.click(screen.getByRole('tab',{name:'Serviços'}));
    expect(screen.getByRole('region', { name: 'Serviços e preços' })).toBeVisible();
    expect(await screen.findByText('Instalação simulada')).toBeVisible();
    expect(screen.getByText(/R\$\s*180,00/)).toBeInTheDocument();
    expect(screen.getByText(/A partir de R\$\s*90,00/)).toBeInTheDocument();
    expect(screen.getByText('Sob orçamento')).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: /WhatsApp de Prestador/ });
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer'); expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa.me\//);
    expect(screen.getByRole('link', { name: /Instagram de Prestador/ })).toHaveAttribute('href', 'https://www.instagram.com/perfil.simulado/');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(4);
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Buscar' })).toHaveAttribute('aria-current', 'page');
  });
  it('perfil destaca principal e mostra adicionais sem mudar abas ou contatos', async () => {
    const repository = marketplaceFixture();
    repository.getProvider = async () => ({ ...p, categoryId: 'construcao', specialty: 'Construção', additionalSpecialties: [{ id: 'pintura', name: 'Pintura' }, { id: 'eletrica', name: 'Elétrica' }] });
    open('/prestadores/prestador-simulado', repository);
    const badges = await screen.findByRole('list', { name: 'Especialidades selecionadas' });
    expect(badges).toHaveTextContent('ConstruçãoPrincipalPinturaElétrica');
    fireEvent.click(screen.getByRole('tab',{name:'Serviços'}));
    expect(screen.getByRole('region', { name: 'Serviços e preços' })).toBeVisible();
    expect(screen.getByRole('link', { name: /WhatsApp de Prestador/ })).toBeVisible();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(4);
  });
  it('abre a foto do portfólio numa página própria, com legenda e navegação', async () => {
    const repository = marketplaceFixture(), sign = vi.spyOn(repository, 'getImageUrl');
    open('/prestadores/prestador-simulado', repository);
    fireEvent.click(await screen.findByRole('tab',{name:'Fotos de trabalhos'}));
    const enlarge = await screen.findByRole('link', { name: 'Abrir fotografia Imagem sintética local' });
    await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
    fireEvent.click(enlarge);
    await screen.findByRole('heading', { name: 'Foto de trabalho' });
    expect(screen.getByLabelText('URL atual')).toHaveTextContent(`/prestadores/prestador-simulado/fotos/${photoFixtureId}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Imagem sintética local')).toBeVisible();
    expect(screen.getByRole('link',{name:'Voltar ao perfil'})).toBeVisible();
  });
  it('não distingue perfil inexistente de rascunho e não mostra dados privados', async () => {
    open('/prestadores/rascunho');
    await screen.findByRole('heading', { name: 'Perfil não encontrado' });
    expect(screen.queryByText(/CNPJ|owner|tax_id|display_name/)).not.toBeInTheDocument();
  });
  it('exibe erro recuperável sem mostrar a resposta interna do servidor', async () => {
    const repository = marketplaceFixture(); vi.spyOn(repository, 'search').mockRejectedValueOnce({ message: 'internal-private-information' });
    open('/buscar', repository);
    await screen.findByRole('alert'); expect(screen.queryByText('internal-private-information')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('link', { name: 'Ver perfil de Prestador simulado' });
  });
  it('descarta a resposta de uma pesquisa anterior que terminou atrasada', async () => {
    const repository = marketplaceFixture(); let finish!: (data: PublicPage<PublicProvider>) => void;
    vi.spyOn(repository, 'search').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ items: [{ ...p, name: 'Resultado novo' }], page: 1, hasNext: false });
    open('/buscar?q=antiga', repository);
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(screen.getByLabelText('Buscar por nome, especialidade ou serviço'), { target: { value: 'nova' } }); fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('link', { name: 'Ver perfil de Resultado novo' });
    await act(async () => finish({ items: [{ ...p, name: 'Resposta antiga' }], page: 1, hasNext: false }));
    expect(screen.queryByText('Resposta antiga')).not.toBeInTheDocument();
  });
  it('oferece carrossel acessível e não inventa recursos sociais', async () => {
    open('/');
    const list = await screen.findByRole('list', { name: 'Profissionais cadastrados' });
    expect(list).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Próximos profissionais' })).toBeInTheDocument();
    expect(within(list).getAllByRole('link', { name: /Ver perfil/ })).toHaveLength(2);
    expect(screen.queryByText(/Curtir|Seguidores/)).not.toBeInTheDocument();
  });
  it('omite contato malicioso e apresenta estado vazio sem fixtures públicas', async () => {
    const repository = marketplaceFixture(); repository.getProvider = async () => ({ ...p, whatsapp: 'javascript:bad', instagram: 'https://evil.test/profile' });
    open('/prestadores/prestador-simulado', repository);
    await screen.findByRole('heading', { name: p.name });
    expect(screen.queryByRole('link', { name: /WhatsApp|Instagram/ })).not.toBeInTheDocument();
  });
});

it('busca apresenta categoria, tipo e ambos os contatos configurados, sem ranking inventado',async()=>{
 open('/buscar');const results=await screen.findByRole('region',{name:'Resultados da busca'});
 expect(within(results).getByRole('link',{name:/Instagram de Prestador/})).toHaveAttribute('href','https://www.instagram.com/perfil.simulado/');
 expect(within(results).getByRole('link',{name:/WhatsApp de Prestador/})).toHaveAttribute('href',expect.stringContaining('https://wa.me/'));
 expect(results.querySelector('.provider-item__specialty')).toHaveTextContent('Climatização');expect(results.querySelector('.provider-item__type')).toHaveTextContent('Autônomo');
 expect(results).toHaveTextContent('ordem alfabética');expect(results).not.toHaveTextContent('melhores profissionais');
});

it('nome no resultado abre perfil com Publicações primeiro e Voltar recupera a busca',async()=>{
 open('/buscar');fireEvent.click(await screen.findByRole('link',{name:'Ver perfil de Prestador simulado'}));
 await screen.findByRole('heading',{name:'Prestador simulado'});expect(screen.getByRole('tab',{name:'Publicações'})).toHaveAttribute('aria-selected','true');
 fireEvent.click(screen.getByRole('tab',{name:'Serviços'}));await screen.findByText('Instalação simulada');
 fireEvent.click(screen.getByRole('button',{name:'Voltar'}));await screen.findByRole('heading',{name:'Buscar'});
 expect(screen.getByRole('region',{name:'Resultados da busca'})).toBeInTheDocument();
});
