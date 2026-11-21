import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { regionalCityFixture } from '../test/regionalCities';
import { marketplaceFixture, publicProviderFixture as p } from '../test/marketplaceFixtures';
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
    fireEvent.click(screen.getByRole('tab', { name: 'Serviços' }));
    expect(await screen.findByText('Instalação simulada')).toBeVisible();
    expect(screen.getByText(/R\$\s*180,00/)).toBeInTheDocument();
    expect(screen.getByText(/A partir de R\$\s*90,00/)).toBeInTheDocument();
    expect(screen.getByText('Sob orçamento')).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: /WhatsApp de Prestador/ });
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer'); expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa.me\//);
    expect(screen.getByRole('link', { name: /Instagram de Prestador/ })).toHaveAttribute('href', 'https://www.instagram.com/perfil.simulado/');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(3);
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Buscar' })).toHaveAttribute('aria-current', 'page');
  });
  it('perfil destaca principal e mostra adicionais sem mudar abas ou contatos', async () => {
    const repository = marketplaceFixture();
    repository.getProvider = async () => ({ ...p, categoryId: 'construcao', specialty: 'Construção', additionalSpecialties: [{ id: 'pintura', name: 'Pintura' }, { id: 'eletrica', name: 'Elétrica' }] });
    open('/prestadores/prestador-simulado', repository);
    const badges = await screen.findByRole('list', { name: 'Especialidades selecionadas' });
    expect(badges).toHaveTextContent('ConstruçãoPrincipalPinturaElétrica');
    expect(screen.getByRole('tab', { name: 'Serviços' })).toBeVisible();
    expect(screen.getByRole('link', { name: /WhatsApp de Prestador/ })).toBeVisible();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(3);
  });
  it('renova a assinatura ao ampliar e fecha a galeria pelo evento cancel do diálogo', async () => {
    const repository = marketplaceFixture(), sign = vi.spyOn(repository, 'getImageUrl');
    open('/prestadores/prestador-simulado', repository);
    const enlarge = await screen.findByRole('button', { name: 'Ampliar fotografia Imagem sintética local' });
    await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
    fireEvent.click(enlarge);
    await screen.findByRole('dialog'); await waitFor(() => expect(sign).toHaveBeenCalledTimes(2));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
  it('oferece carrossel acessível e não apresenta trabalhos recentes ou recursos sociais', async () => {
    open('/');
    const list = await screen.findByRole('list', { name: 'Profissionais cadastrados' });
    expect(list).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Próximos profissionais' })).toBeInTheDocument();
    expect(within(list).getAllByRole('link', { name: /Ver perfil/ })).toHaveLength(2);
    expect(screen.queryByText(/Trabalhos recentes|Curtir|Seguidores/)).not.toBeInTheDocument();
  });
  it('omite contato malicioso e apresenta estado vazio sem fixtures públicas', async () => {
    const repository = marketplaceFixture(); repository.getProvider = async () => ({ ...p, whatsapp: 'javascript:bad', instagram: 'https://evil.test/profile' });
    open('/prestadores/prestador-simulado', repository);
    await screen.findByRole('heading', { name: p.name });
    expect(screen.queryByRole('link', { name: /WhatsApp|Instagram/ })).not.toBeInTheDocument();
  });
});
