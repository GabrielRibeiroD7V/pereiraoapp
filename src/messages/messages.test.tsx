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
    await waitFor(() => expect(repo.send).toHaveBeenCalledWith(conversationId, 'Obrigado, vamos conversar.', expect.any(String)));
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


it('preserva o próximo rascunho digitado enquanto o envio anterior aguarda confirmação', async () => {
  const repo = fixture(); let finish!: () => void;
  vi.mocked(repo.send).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  open(`/mensagens/${conversationId}`, repo);
  const field = await screen.findByLabelText('Responder');
  fireEvent.change(field, { target: { value: 'Primeira mensagem' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.change(field, { target: { value: 'Próximo texto ainda não enviado' } });
  await import('@testing-library/react').then(({ act }) => act(async () => finish()));
  expect(field).toHaveValue('Próximo texto ainda não enviado');
  expect(repo.send).toHaveBeenCalledExactlyOnceWith(conversationId, 'Primeira mensagem', expect.any(String));
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
});


it('uma falha de envio preserva o próximo rascunho sem enviar automaticamente', async () => {
  const repo = fixture(); let fail!: (reason: unknown) => void;
  vi.mocked(repo.send).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  open(`/mensagens/${conversationId}`, repo);
  const field = await screen.findByLabelText('Responder');
  fireEvent.change(field, { target: { value: 'Mensagem aguardando' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await waitFor(() => expect(fail).toBeDefined());
  fireEvent.change(field, { target: { value: 'Rascunho preservado após falha' } });
  await import('@testing-library/react').then(({ act }) => act(async () => fail(new Error('offline'))));
  expect(field).toHaveValue('Rascunho preservado após falha');
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível');
  expect(repo.send).toHaveBeenCalledOnce();
});


it('inicia contato com autor pessoal sem negócio e preserva a mesma requisição após falha',async()=>{
 const r=fixture(); r.openAccount=vi.fn().mockRejectedValueOnce({code:'NETWORK'}).mockResolvedValueOnce(conversationId);
 open(`/mensagens/pessoa/${businessId}`,r);
 fireEvent.change(await screen.findByLabelText('Sua mensagem'),{target:{value:'Mensagem local'}});
 fireEvent.click(screen.getByRole('button',{name:'Enviar mensagem'})); await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Enviar mensagem'}));
 await waitFor(()=>expect(r.openAccount).toHaveBeenCalledTimes(2));
 expect(vi.mocked(r.openAccount).mock.calls[0]).toEqual(vi.mocked(r.openAccount).mock.calls[1]);
 expect(vi.mocked(r.openAccount).mock.calls[0]![0]).toEqual({author:businessId,work:undefined});
});
it('mostra conversa pessoal sem inventar empresa ou canal WhatsApp',async()=>{
 const r=fixture();vi.mocked(r.list).mockResolvedValue([{id:conversationId,businessId:'',businessName:'',businessSlug:'',customerName:'',side:'account',peerId:businessId,peerName:'Pessoa local',updatedAt:'2026-11-22T12:00:00Z',lastMessage:'Olá'}]);
 open(`/mensagens/${conversationId}`,r);
 expect(await screen.findByRole('heading',{name:'Pessoa local'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Ver publicações do perfil'})).toHaveAttribute('href',`/pessoas/${businessId}`);
 expect(screen.queryByText('Ver perfil profissional e WhatsApp')).not.toBeInTheDocument();
});

it('mostra mensagens não lidas na navegação e marca a conversa ao abrir', async () => {
  const r = fixture();
  r.unreadCount = vi.fn(async () => 2);
  r.markRead = vi.fn(async () => {});
  vi.mocked(r.list).mockResolvedValue([{ ...(await r.list())[0]!, unreadCount: 2 }]);
  open(`/mensagens/${conversationId}`, r);
  expect(await screen.findByLabelText('2 mensagens não lidas')).toHaveTextContent('2');
  await waitFor(() => expect(r.markRead).toHaveBeenCalledWith(conversationId));
});

it('não marca como lida uma resposta que chegou enquanto a aba estava oculta', async () => {
  const r = fixture();
  r.markRead = vi.fn(async () => {});
  let finish!: (page: Awaited<ReturnType<MessageRepository['messages']>>) => void;
  const page = await r.messages(conversationId);
  vi.mocked(r.messages).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  try {
    open(`/mensagens/${conversationId}`, r);
    await waitFor(() => expect(finish).toBeDefined());
    visibility.mockReturnValue('hidden');
    const { act } = await import('@testing-library/react');
    await act(async () => finish(page));
    expect(r.markRead).not.toHaveBeenCalled();
    vi.mocked(r.messages).mockResolvedValue(page);
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(r.markRead).toHaveBeenCalledWith(conversationId));
  } finally { visibility.mockRestore(); }
});

it('reconsulta a caixa ao voltar online sem esperar o polling', async () => {
  const r = open('/mensagens');
  await screen.findByText('Pintor');
  vi.mocked(r.list).mockClear();
  fireEvent(window, new Event('online'));
  await waitFor(() => expect(r.list).toHaveBeenCalled());
});
