import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { MessageRepository } from '../messages/repository';
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
