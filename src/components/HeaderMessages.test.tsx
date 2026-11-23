import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { MessageRepository } from '../messages/repository';
import { createWorkFixtures, fixtureBusinessId } from '../test/workFixtures';
import { marketplaceFixture } from '../test/marketplaceFixtures';

function gateway(authenticated = false): AuthGateway {
  return {
    getSession: vi.fn(async () => authenticated ? { user: { id: 'local-user', email: null, displayName: 'Usuário local' } } : null),
    subscribe: () => () => {}, signIn: vi.fn(), signUp: vi.fn(), requestReset: vi.fn(),
    updatePassword: vi.fn(), signOut: vi.fn(), completeCallback: vi.fn(),
  };
}
function open(path: string, authenticated = false) {
  const repository: MessageRepository = { list: vi.fn(async () => []), messages: vi.fn(), open: vi.fn(), send: vi.fn() };
  render(<MemoryRouter initialEntries={[path]}><App authGateway={gateway(authenticated)} messageRepository={repository} marketplaceRepository={marketplaceFixture()} /></MemoryRouter>);
  return repository;
}
describe('acesso global às mensagens', () => {
  it.each(['/', '/buscar', '/prestadores/prestador-simulado', '/conta'])('oferece um único atalho no cabeçalho de %s, sem contador fictício', async path => {
    open(path, true);
    await waitFor(() => expect(screen.queryByText('Verificando sua sessão…')).not.toBeInTheDocument());
    const header = document.querySelector('.app-header') as HTMLElement;
    const messages = within(header).getByRole('link', { name: 'Abrir mensagens' });
    expect(messages).toHaveAttribute('href', '/mensagens');
    expect(messages).toHaveTextContent('');
    expect(screen.getAllByRole('link', { name: 'Abrir mensagens' })).toHaveLength(1);
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
    expect(within(header).getByRole('img', { name: 'PEREIRÃO' })).toBeInTheDocument();
  });
  it('não duplica o acesso global no perfil do próprio negócio', async () => {
    const f = createWorkFixtures();
    render(<MemoryRouter initialEntries={[`/conta/profissional/${fixtureBusinessId}/perfil`]}><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Editar perfil' });
    expect(document.querySelectorAll('a[href="/mensagens"]')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Abrir mensagens' })).toBeVisible();
  });
  it('encaminha o visitante ao login com retorno à caixa, sem consultar conversas privadas', async () => {
    const repository = open('/');
    fireEvent.click(screen.getByRole('link', { name: 'Abrir mensagens' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/criar-conta?next=%2Fmensagens');
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('abre a caixa autenticada e mantém o estado vazio real', async () => {
    const repository = open('/buscar', true);
    fireEvent.click(screen.getByRole('link', { name: 'Abrir mensagens' }));
    expect(await screen.findByRole('heading', { name: 'Mensagens' })).toBeInTheDocument();
    await waitFor(() => expect(repository.list).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Abrir mensagens' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('estados da caixa e retorno à conversa', () => {
  function inbox(repository: MessageRepository | null) {
    render(<MemoryRouter initialEntries={['/mensagens']}><App authGateway={gateway(true)} messageRepository={repository} /></MemoryRouter>);
  }
  it('mostra carregamento sem anunciar uma caixa vazia antes da resposta', async () => {
    let resolve!: (items: []) => void;
    const response = new Promise<[]>(done => { resolve = done; });
    inbox({ list: vi.fn(() => response), messages: vi.fn(), open: vi.fn(), send: vi.fn() });
    expect(await screen.findByText('Carregando conversas…')).toBeVisible();
    expect(screen.queryByText(/Ainda não há conversas/)).not.toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText(/Ainda não há conversas/)).toBeVisible();
  });
  it('não confunde indisponibilidade com ausência real de conversas', async () => {
    inbox(null);
    expect(await screen.findByText('Mensagens indisponíveis neste momento.')).toBeVisible();
    expect(screen.queryByText(/Ainda não há conversas/)).not.toBeInTheDocument();
  });
  it('permite retomar uma consulta com erro sem revelar detalhes privados', async () => {
    const list = vi.fn().mockRejectedValueOnce({ code: '42501', message: 'detalhe privado' }).mockResolvedValue([]);
    inbox({ list, messages: vi.fn(), open: vi.fn(), send: vi.fn() });
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem acesso');
    expect(screen.queryByText('detalhe privado')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há conversas/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText(/Ainda não há conversas/)).toBeVisible();
    expect(list).toHaveBeenCalledTimes(2);
  });
  it.each(['/mensagens/00000000-0000-4000-8000-000000000020', '/mensagens/iniciar/00000000-0000-4000-8000-000000000010'])('preserva %s no login do visitante', async path => {
    const repository = open(path);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', `/criar-conta?next=${encodeURIComponent(path)}`);
    expect(repository.list).not.toHaveBeenCalled();
  });
});
