import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { MessageRepository } from './repository';
import { marketplaceFixture } from '../test/marketplaceFixtures';

const businessId = '00000000-0000-4000-8000-000000000010';
const conversationId = '00000000-0000-4000-8000-000000000020';
const gateway: AuthGateway = {
  getSession: async () => ({ user: { id: 'customer-1', email: 'customer@example.invalid', displayName: 'Cliente' } }),
  subscribe: () => () => {}, signIn: vi.fn(), signUp: vi.fn(), requestReset: vi.fn(), updatePassword: vi.fn(), signOut: vi.fn(), completeCallback: vi.fn(),
};
function fixture(): MessageRepository {
  const conversation = { id: conversationId, businessId, businessName: 'Pintor', businessSlug: 'pintor', customerName: 'Cliente', side: 'customer' as const, updatedAt: '2026-11-22T12:00:00Z', lastMessage: 'Olá' };
  const messages = [{ id: '00000000-0000-4000-8000-000000000030', senderId: 'customer-1', body: 'Olá', createdAt: '2026-11-22T12:00:00Z' }];
  return { list: vi.fn(async () => [conversation]), messages: vi.fn(async () => ({ items: messages, hasMore: false, customerId: 'customer-1' })), open: vi.fn(async () => conversationId), send: vi.fn(async () => {}) };
}
function open(path: string, repo = fixture()) {
  render(<MemoryRouter initialEntries={[path]}><App authGateway={gateway} messageRepository={repo} marketplaceRepository={marketplaceFixture()} /></MemoryRouter>);
  return repo;
}
describe('mensagens internas e WhatsApp', () => {
  it('oferece ambos os canais e cria conversa autenticada', async () => {
    const repo = open('/prestadores/prestador-simulado');
    const link = await screen.findByRole('link', { name: 'Mensagem pelo PEREIRÃO' });
    expect(screen.getByRole('link', { name: /WhatsApp de Prestador/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\//));
    fireEvent.click(link);
    fireEvent.change(await screen.findByLabelText('Sua mensagem'), { target: { value: 'Preciso de orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() => expect(repo.open).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 'Preciso de orçamento'));
    expect(await screen.findByRole('heading', { name: 'Pintor' })).toBeInTheDocument();
  });
  it('lê histórico e responde sem trocar de aplicativo', async () => {
    const repo = open(`/mensagens/${conversationId}`);
    expect(await screen.findByText('Olá')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Responder'), { target: { value: 'Obrigado, vamos conversar.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(repo.send).toHaveBeenCalledWith(conversationId, 'Obrigado, vamos conversar.'));
  });
  it('não expõe detalhes do erro do banco', async () => {
    const repo = fixture(); repo.send = vi.fn().mockRejectedValue({ code: '42501', message: 'private data' });
    open(`/mensagens/${conversationId}`, repo);
    await screen.findByLabelText('Responder');
    fireEvent.change(screen.getByLabelText('Responder'), { target: { value: 'Teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem acesso');
    expect(screen.queryByText('private data')).not.toBeInTheDocument();
  });
});

it('uma atualização antiga não apaga a resposta confirmada mais recente', async () => {
  const repo=fixture();let finish!: (page: Awaited<ReturnType<MessageRepository['messages']>>) => void;
  let poll: (()=>void)|undefined;
  const original=window.setInterval.bind(window);
  const spy=vi.spyOn(window,'setInterval').mockImplementation(((callback:()=>void,ms:number)=>{if(ms===12000)poll=callback;return original(callback,ms);}) as typeof window.setInterval);
  const page=await repo.messages(conversationId);
  vi.mocked(repo.messages).mockClear().mockResolvedValueOnce(page).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({...page,items:[...page.items,{id:'new-message',senderId:'customer-1',body:'Resposta confirmada',createdAt:'2026-11-22T12:01:00Z'}]});
  try {
    open(`/mensagens/${conversationId}`,repo);await screen.findByText('Olá');
    poll!();await waitFor(()=>expect(finish).toBeDefined());
    fireEvent.change(screen.getByLabelText('Responder'),{target:{value:'Resposta confirmada'}});fireEvent.click(screen.getByRole('button',{name:'Enviar'}));
    await screen.findByText('Resposta confirmada');
    await import('@testing-library/react').then(({act})=>act(async()=>finish(page)));
    expect(screen.getByText('Resposta confirmada')).toBeInTheDocument();
  } finally {spy.mockRestore();}
});
