import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway, AuthListener, AuthSession } from './types';
import { safeReturnPath } from './RequireAuth';
import { authErrorMessage } from './errors';
import { validPublicConfig } from '../lib/supabase';
import { callbackUrl, createAuthGateway } from './supabaseAuthGateway';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

const session: AuthSession = { user: { id: 'test-user', email: 'test@example.invalid', displayName: 'Pessoa de teste' } };
function mockGateway(initial: AuthSession | null = null) {
  let listener: AuthListener | null = null;
  let current = initial;
  const emit = (value: AuthSession | null) => { current = value; listener?.(value); };
  const unsubscribe = vi.fn();
  const gateway: AuthGateway = {
    getSession: vi.fn(async () => current),
    subscribe: vi.fn((fn) => { listener = fn; return unsubscribe; }),
    signIn: vi.fn(async () => emit(session)),
    signUp: vi.fn(async () => ({ confirmationRequired: true })),
    requestReset: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    signOut: vi.fn(async () => emit(null)),
    completeCallback: vi.fn(async () => emit(session)),
  };
  return { gateway, emit, unsubscribe };
}
function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <div aria-label="URL de teste">{pathname}{search}</div>;
}
function open(path: string, gateway: AuthGateway | null) {
  return render(<MemoryRouter initialEntries={[path]}><App authGateway={gateway} /><CurrentLocation /></MemoryRouter>);
}
async function ready() { await waitFor(() => expect(screen.queryByText('Verificando sua sessão…')).not.toBeInTheDocument()); }
function credentials() {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: 'somente-teste-123' } });
}

describe('autenticação e rotas', () => {
  it.each(['/', '/buscar', '/conta'])('mantém %s público sem configuração ou sessão', (path) => {
    open(path, null);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText('URL de teste')).toHaveTextContent(path);
  });

  it('impede envio sem configuração e permite voltar ao marketplace', () => {
    open('/entrar', null);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('link', { name: 'Continuar sem entrar' }));
    expect(screen.getByRole('heading', { level: 1, name: 'O que você está procurando?' })).toBeInTheDocument();
  });

  it('aguarda restauração de sessão antes de redirecionar rota privada', async () => {
    const { gateway } = mockGateway();
    let resolve!: (value: AuthSession | null) => void;
    gateway.getSession = () => new Promise((done) => { resolve = done; });
    open('/conta/dados', gateway);
    expect(screen.getByRole('status')).toHaveTextContent('Verificando');
    expect(screen.queryByRole('heading', { name: 'Meus dados' })).not.toBeInTheDocument();
    await act(async () => resolve(null));
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });
    expect(screen.getByLabelText('URL de teste')).toHaveTextContent('/entrar?next=%2Fconta%2Fdados');
  });

  it('entra e retorna ao destino privado solicitado', async () => {
    const { gateway } = mockGateway();
    open('/entrar?next=%2Fconta%2Fdados', gateway);
    await ready(); credentials();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Meus dados' })).toBeInTheDocument();
    expect(gateway.signIn).toHaveBeenCalledWith('test@example.invalid', 'somente-teste-123');
  });

  it('mostra erro de credenciais sem expor resposta técnica', async () => {
    const { gateway } = mockGateway();
    gateway.signIn = vi.fn().mockRejectedValue({ code: 'invalid_credentials', message: 'sensitive internals' });
    open('/entrar', gateway); await ready(); credentials();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.queryByText('sensitive internals')).not.toBeInTheDocument();
  });

  it('cadastro informa confirmação de e-mail sem criar sessão fictícia', async () => {
    const { gateway } = mockGateway();
    open('/criar-conta', gateway); await ready(); credentials();
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Pessoa de teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Confira seu e-mail');
    expect(gateway.signUp).toHaveBeenCalledWith('test@example.invalid', 'somente-teste-123', 'Pessoa de teste', '/conta');
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveValue('');
  });

  it('recuperação usa mensagem neutra quanto à existência da conta', async () => {
    const { gateway } = mockGateway();
    open('/recuperar-senha', gateway); await ready();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se houver uma conta');
    expect(gateway.requestReset).toHaveBeenCalledWith('test@example.invalid');
  });

  it('restaura sessão e sai, retirando acesso privado', async () => {
    const { gateway } = mockGateway(session);
    open('/conta', gateway); await ready();
    expect(await screen.findByRole('button', { name: 'Sair' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('não sobrescreve logout recente com restauração antiga de sessão', async () => {
    const { gateway, emit } = mockGateway();
    let resolve!: (value: AuthSession | null) => void;
    gateway.getSession = () => new Promise((done) => { resolve = done; });
    open('/conta', gateway);
    await act(async () => { emit(null); resolve(session); });
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('confirma código e remove a URL de callback ao concluir', async () => {
    const { gateway } = mockGateway();
    open('/auth/retorno?code=local-test-code', gateway);
    expect(await screen.findByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(gateway.completeCallback).toHaveBeenCalledWith('local-test-code');
    expect(screen.getByLabelText('URL de teste')).toHaveTextContent(/^\/conta$/);
  });

  it('link de recuperação permite redefinir a senha e encerra sessão', async () => {
    const { gateway } = mockGateway();
    open('/auth/retorno?code=recovery-test&flow=recovery', gateway);
    await screen.findByRole('heading', { level: 1, name: 'Definir nova senha' });
    fireEvent.change(screen.getByLabelText('Nova senha', { exact: true }), { target: { value: 'nova-senha-teste-123' } });
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'nova-senha-teste-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(gateway.updatePassword).toHaveBeenCalledWith('nova-senha-teste-123');
    expect(gateway.signOut).toHaveBeenCalled();
  });

  it('link inválido informa o erro sem aceitar um destino externo', async () => {
    const { gateway } = mockGateway();
    gateway.completeCallback = vi.fn().mockRejectedValue({ code: 'flow_state_expired' });
    open('/auth/retorno?code=expired', gateway);
    expect(await screen.findByRole('alert')).toHaveTextContent('Este link expirou');
    expect(safeReturnPath('https://evil.invalid')).toBe('/conta');
    expect(safeReturnPath('//evil.invalid')).toBe('/conta');
    expect(safeReturnPath('/conta/dados')).toBe('/conta/dados');
  });

  it('cancela a assinatura de eventos ao desmontar', () => {
    const { gateway, unsubscribe } = mockGateway();
    const view = open('/', gateway);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('cliente e gateway Supabase', () => {
  it('rejeita configurações de outros projetos e chaves não publicáveis', () => {
    expect(validPublicConfig('https://yazdjiwaksamizrbqewq.supabase.co', 'sb_publishable_test')).toBe(true);
    expect(validPublicConfig('https://other.supabase.co', 'sb_publishable_test')).toBe(false);
    expect(validPublicConfig('https://yazdjiwaksamizrbqewq.supabase.co', 'sb_secret_test')).toBe(false);
    expect(validPublicConfig(undefined, undefined)).toBe(false);
  });

  it('deriva redirects da origem fornecida sem domínio de produção presumido', () => {
    expect(callbackUrl('http://localhost:5173')).toBe('http://localhost:5173/auth/retorno');
    expect(callbackUrl('https://preview.example.invalid', true)).toBe('https://preview.example.invalid/auth/retorno?flow=recovery');
    expect(() => callbackUrl('http://public.example.invalid')).toThrow();
  });

  it('configura confirmação e recuperação com PKCE e deduplica troca de código', async () => {
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
    });
    const signUp = vi.spyOn(client.auth, 'signUp').mockResolvedValue({ data: { user: null, session: null }, error: null });
    const reset = vi.spyOn(client.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null });
    const sdkSession: Session = { access_token: 'test-only', refresh_token: 'test-only', expires_in: 3600, token_type: 'bearer',
      user: { id: 'test-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
    const exchange = vi.spyOn(client.auth, 'exchangeCodeForSession').mockResolvedValue({ data: { user: sdkSession.user, session: sdkSession }, error: null });
    const gateway = createAuthGateway(client, () => 'https://preview.example.invalid');
    expect(await gateway.signUp('test@example.invalid', 'test-only', 'Teste')).toEqual({ confirmationRequired: true });
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: 'https://preview.example.invalid/auth/retorno?next=%2Fconta', data: { display_name: 'Teste' } } }));
    await gateway.signUp('test@example.invalid', 'test-only', 'Teste', '/conta/profissional/cadastro');
    expect(signUp).toHaveBeenLastCalledWith(expect.objectContaining({ options: { emailRedirectTo: 'https://preview.example.invalid/auth/retorno?next=%2Fconta%2Fprofissional%2Fcadastro', data: { display_name: 'Teste' } } }));
    await gateway.requestReset('test@example.invalid');
    expect(reset).toHaveBeenCalledWith('test@example.invalid', { redirectTo: 'https://preview.example.invalid/auth/retorno?flow=recovery' });
    await Promise.all([gateway.completeCallback('test-code'), gateway.completeCallback('test-code')]);
    expect(exchange).toHaveBeenCalledOnce();
    signUp.mockRestore(); reset.mockRestore(); exchange.mockRestore();
  });

  it('não apresenta mensagens técnicas desconhecidas', () => {
    expect(authErrorMessage(new Error('token=do-not-display'))).not.toContain('token');
  });
});
