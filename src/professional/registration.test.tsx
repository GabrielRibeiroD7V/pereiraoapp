import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { BusinessRow } from '../lib/database.types';
import type { ProfessionalCatalog, ProfessionalRepository, RegistrationInput } from './types';
import { emptyRegistration, normalizeRegistration, validateRegistration, createRegistrationSlug } from './validation';
import { readCheckpoint, writeCheckpoint } from './checkpoint';

const bid = '00000000-0000-0000-0000-000000000004';
const catalog: ProfessionalCatalog = {
  categories: [{ id: 'eletrica', name: 'Elétrica' }, { id: 'pintura', name: 'Pintura' }],
  cities: [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }, { id: 'test-city', name: 'Cidade de teste', state_code: 'MS' }],
};
const input: RegistrationInput = { ...emptyRegistration, name: 'Nome de teste', categoryId: 'eletrica', cityId: 'mundo-novo-ms' };
const business: BusinessRow = { id: bid, name: input.name, type: 'autonomo', slug: 'teste', description: null, city_id: 'mundo-novo-ms', category_id: 'eletrica',
  whatsapp: null, instagram: null, avatar_path: null, status: 'draft', created_at: '', updated_at: '' };
function gateway(authenticated = true): AuthGateway {
  const session = { user: { id: 'registration-user', email: 'test@example.invalid', displayName: 'Teste' } };
  let listener: Parameters<AuthGateway['subscribe']>[0] | null = null;
  return { getSession: vi.fn(async () => authenticated ? session : null),
    subscribe: vi.fn((fn) => { listener = fn; return () => {}; }),
    signIn: vi.fn(async () => { listener?.(session); }), signUp: vi.fn(async () => ({ confirmationRequired: true })),
    requestReset: vi.fn(async () => {}), updatePassword: vi.fn(async () => {}), signOut: vi.fn(async () => { listener?.(null); }), completeCallback: vi.fn(async () => { listener?.(session); }) };
}
function repository(): ProfessionalRepository {
  return { getCatalog: vi.fn(async () => catalog), listMine: vi.fn(async () => [business]),
    getEditable: vi.fn(async () => ({ business, input })), createDraft: vi.fn(async () => bid), saveDraft: vi.fn(async () => {}) };
}
function open(repo: ProfessionalRepository, path = '/conta/profissional/cadastro', auth = gateway()) {
  return render(<MemoryRouter initialEntries={[path]}><App authGateway={auth} professionalRepository={repo} /></MemoryRouter>);
}
async function details(company = false) {
  await screen.findByRole('radio', { name: 'Empresa' });
  if (company) fireEvent.click(screen.getByRole('radio', { name: 'Empresa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByLabelText(company ? 'Nome da empresa' : 'Nome profissional'), { target: { value: 'Nome de teste' } });
  fireEvent.change(screen.getByLabelText('Categoria principal'), { target: { value: 'eletrica' } });
}
async function finalStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByLabelText('WhatsApp');
}
beforeEach(() => { sessionStorage.clear(); });

describe('cadastro progressivo e espaço profissional', () => {
  it('confirmação de e-mail retorna ao cadastro solicitado', async () => {
    open(repository(), '/auth/retorno?code=local-test&next=%2Fconta%2Fprofissional%2Fcadastro');
    expect(await screen.findByRole('radio', { name: 'Profissional autônomo' })).toBeInTheDocument();
  });
  it('visitante é autenticado e retorna ao cadastro', async () => {
    const repo = repository();
    const auth = gateway(false);
    open(repo, '/', auth);
    fireEvent.click(screen.getByRole('link', { name: 'Anunciar meus serviços' }));
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'somente-teste-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('radio', { name: 'Profissional autônomo' })).toBeInTheDocument();
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it.each([false, true])('salva cadastro em três etapas (empresa=%s) sem publicar', async (company) => {
    const repo = repository(); open(repo); await details(company);
    if (company) {
      fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Empresa de teste' } });
      fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-99' } });
    } else expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cidade de teste/MS'));
    await finalStep();
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+55 (67) 99999-1234' } });
    fireEvent.change(screen.getByLabelText('Instagram (opcional)'), { target: { value: '@teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
    expect(repo.createDraft).toHaveBeenCalledOnce();
    expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ type: company ? 'empresa' : 'autonomo', whatsapp: '5567999991234', instagram: 'teste', areaCityIds: ['mundo-novo-ms', 'test-city'] }));
    const saved = vi.mocked(repo.saveDraft).mock.calls[0]?.[1];
    expect(saved).not.toHaveProperty('status'); expect(saved).not.toHaveProperty('ownerId');
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
    expect(readCheckpoint('registration-user')).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
  });

  it('valida campos e preserva dados ao voltar etapas', async () => {
    const repo = repository(); open(repo); await details();
    fireEvent.change(screen.getByLabelText('Categoria principal'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Continuar' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione uma categoria');
    fireEvent.change(screen.getByLabelText('Categoria principal'), { target: { value: 'eletrica' } });
    await finalStep();
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: 'errado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByLabelText('Nome profissional')).toHaveValue('Nome de teste');
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it('permite rascunho sem WhatsApp, sem oferecer publicação', async () => {
    const repo = repository(); open(repo); await details(); await finalStep();
    expect(screen.queryByRole('button', { name: /^Publicar$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
    expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ whatsapp: '' }));
  });

  it('retoma o mesmo rascunho após falha parcial', async () => {
    const repo = repository(); vi.mocked(repo.saveDraft).mockRejectedValueOnce(new Error('test-only'));
    open(repo); await details(); await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('alert');
    expect(readCheckpoint('registration-user')?.businessId).toBe(bid);
    expect(JSON.stringify(readCheckpoint('registration-user'))).not.toContain('whatsapp');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
    expect(repo.createDraft).toHaveBeenCalledOnce();
    expect(repo.saveDraft).toHaveBeenCalledTimes(2);
  });

  it('impede submissão duplicada enquanto aguarda persistência', async () => {
    const repo = repository();
    let resolve!: (id: string) => void;
    repo.createDraft = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    open(repo); await details(); await finalStep();
    const form = screen.getByRole('button', { name: 'Salvar rascunho' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(repo.createDraft).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    await act(async () => resolve(bid));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
  });

  it('edita um perfil existente sem executar criação', async () => {
    writeCheckpoint('registration-user', { slug: 'draft-teste', businessId: bid });
    const repo = repository(); open(repo, `/conta/profissional/${bid}/editar`);
    await details(); await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
    expect(repo.createDraft).not.toHaveBeenCalled();
    expect(repo.getEditable).toHaveBeenCalledWith(bid);
    expect(readCheckpoint('registration-user')).toBeNull();
  });

  it('bloqueia cadastro com aviso honesto antes da nova migração', async () => {
    const repo = repository(); vi.mocked(repo.getCatalog).mockRejectedValue({ code: 'SETUP_REQUIRED' });
    open(repo);
    expect(await screen.findByRole('alert')).toHaveTextContent('aguarda uma atualização do banco');
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
  });

  it('não mostra formulário de edição quando a conta não é membro autorizado', async () => {
    const repo = repository(); vi.mocked(repo.getEditable).mockRejectedValue({ code: 'NOT_MANAGER' });
    open(repo, `/conta/profissional/${bid}/editar`);
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem permissão');
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
  });

  it('reconhece colisão de slug e permite nova tentativa', async () => {
    const repo = repository(); vi.mocked(repo.createDraft).mockRejectedValueOnce({ code: '23505' });
    open(repo); await details(); await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('identificador já está em uso');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Espaço profissional' });
    expect(repo.createDraft).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repo.createDraft).mock.calls[0]?.[1]).not.toBe(vi.mocked(repo.createDraft).mock.calls[1]?.[1]);
  });
});

describe('normalização e validação', () => {
  it('inclui cidade principal e deduplica áreas', () => {
    expect(normalizeRegistration({ ...input, areaCityIds: ['mundo-novo-ms', 'mundo-novo-ms'] }).areaCityIds).toEqual(['mundo-novo-ms']);
  });
  it('rejeita cidade e categoria fora do catálogo', () => {
    expect(validateRegistration({ ...input, cityId: 'unknown' }, catalog, 3)).toContain('cidade');
    expect(validateRegistration({ ...input, categoryId: '' }, catalog, 3)).toContain('categoria');
  });
  it('gera slug estável a partir do sufixo da tentativa', () => {
    expect(createRegistrationSlug('João & Cia', 'abc')).toBe('joao-cia-abc');
  });
});
