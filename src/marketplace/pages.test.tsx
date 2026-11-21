import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { marketplaceFixture, publicProviderFixture as p } from '../test/marketplaceFixtures';
import type { PublicPage, PublicProvider } from './types';
function Location() { const location = useLocation(); return <output aria-label="URL atual">{location.pathname}{location.search}</output>; }
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
  it('mostra perfil, preços e contatos seguros sem exigir autenticação', async () => {
    open('/prestadores/prestador-simulado');
    await screen.findByRole('heading', { name: 'Prestador simulado' });
    await screen.findByText('Instalação simulada');
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
