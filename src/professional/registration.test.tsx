import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { BusinessRow } from '../lib/database.types';
import type { ProfessionalCatalog, ProfessionalRepository, RegistrationInput } from './types';
import { emptyRegistration, normalizeRegistration, validateRegistration, createRegistrationSlug } from './validation';
import { readCheckpoint, writeCheckpoint } from './checkpoint';
import { regionalCityFixture } from '../test/regionalCities';

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
  fireEvent.click(screen.getByRole('radio', { name: 'Elétrica' }));
}
async function finalStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByLabelText('WhatsApp');
}
beforeEach(() => { sessionStorage.clear(); });

describe('cadastro progressivo e espaço profissional', () => {
  it('abre edição da bio diretamente e mostra o texto antes de salvar', async () => {
    const repo = repository();
    open(repo, `/conta/profissional/${bid}/editar?secao=bio`);
    const bio = await screen.findByLabelText('Descrição');
    fireEvent.change(bio, { target: { value: 'Atendo Mundo Novo e região.' } });
    await finalStep();
    expect(screen.getByRole('region', { name: 'Revisão do cadastro' })).toHaveTextContent('Atendo Mundo Novo e região.');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
    expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ description: 'Atendo Mundo Novo e região.' }));
  });

  it('abre a prévia diretamente da edição e mantém fotos no perfil profissional', async () => {
    const repo = repository(); open(repo, `/conta/profissional/${bid}/editar`);
    const preview = await screen.findByRole('link', { name: 'Ver prévia do perfil' });
    expect(screen.getByRole('link', { name: 'Adicionar fotos' })).toHaveAttribute('href', `/conta/profissional/${bid}/trabalhos`);
    fireEvent.click(preview);
    expect(await screen.findByRole('heading', { name: input.name })).toBeInTheDocument();
    expect(screen.getByText(/Rascunho privado/)).toBeInTheDocument();
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });
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
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Minha bio profissional de teste.' } });
    expect(screen.queryByLabelText('CNPJ')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Mundo Novo/MS' })).not.toBeInTheDocument();
    expect(screen.getByText('Mundo Novo/MS já está incluída')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado atendido'),{target:{value:'MS'}});
    fireEvent.change(screen.getByLabelText('Adicionar cidade atendida'),{target:{value:'test-city'}});
    await finalStep();
    expect(screen.getByText('Minha bio profissional de teste.')).toBeInTheDocument();
    if (company) {
      fireEvent.click(screen.getByText('Dados empresariais privados', { exact: true, selector: 'summary' }));
      fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Empresa de teste' } });
      fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-99' } });
    } else expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+55 (67) 99999-1234' } });
    fireEvent.change(screen.getByLabelText('Instagram (opcional)'), { target: { value: '@teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
    expect(repo.createDraft).toHaveBeenCalledOnce();
    expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ type: company ? 'empresa' : 'autonomo', description: 'Minha bio profissional de teste.', whatsapp: '5567999991234', instagram: 'teste', areaCityIds: ['mundo-novo-ms', 'test-city'] }));
    const saved = vi.mocked(repo.saveDraft).mock.calls[0]?.[1];
    if (company) expect(saved).toMatchObject({ legalName: 'Empresa de teste', taxId: '12345678000199' });
    expect(saved).not.toHaveProperty('status'); expect(saved).not.toHaveProperty('ownerId');
    expect(await screen.findByText(/Rascunho privado/)).toBeInTheDocument();
    expect(readCheckpoint('registration-user')).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
  });

  it.each(['autonomo', 'empresa'] as const)('preserva origem e várias áreas de MS/PR entre etapas (%s)', async type => {
    const repo = repository();
    repo.getCatalog = vi.fn(async () => ({ ...catalog, cities: regionalCityFixture.map(city => ({ id: city.id, name: city.name, state_code: city.stateCode })) }));
    open(repo); await details(type === 'empresa');
    fireEvent.change(screen.getByLabelText('Estado',{exact:true}),{target:{value:'PR'}});
    fireEvent.change(screen.getByLabelText('Cidade', { exact: true }), { target: { value: 'terra-roxa-pr' } });
    fireEvent.change(screen.getByLabelText('Estado atendido'),{target:{value:'MS'}});
    fireEvent.change(screen.getByLabelText('Adicionar cidade atendida'),{target:{value:'mundo-novo-ms'}});
    fireEvent.change(screen.getByLabelText('Estado atendido'),{target:{value:'PR'}});
    fireEvent.change(screen.getByLabelText('Adicionar cidade atendida'),{target:{value:'guaira-pr'}});
    fireEvent.change(screen.getByLabelText('Estado atendido'),{target:{value:'MS'}});
    fireEvent.change(screen.getByLabelText('Adicionar cidade atendida'),{target:{value:'eldorado-ms'}});
    await finalStep();
    expect(screen.getByRole('region', { name: 'Revisão do cadastro' })).toHaveTextContent('Terra Roxa/PR');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByLabelText('Cidade', { exact: true })).toHaveValue('terra-roxa-pr');
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).toHaveTextContent('Guaíra/PR');
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).toHaveTextContent('Eldorado/MS');
    await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ type, cityId: 'terra-roxa-pr', areaCityIds: ['terra-roxa-pr', 'mundo-novo-ms', 'guaira-pr', 'eldorado-ms'] })));
    expect(repo.createDraft).toHaveBeenCalledOnce();
  });

  it('edição preserva a origem e as áreas existentes sem voltar automaticamente a Mundo Novo', async () => {
    const repo = repository();
    repo.getCatalog = vi.fn(async () => ({ ...catalog, cities: regionalCityFixture.map(city => ({ id: city.id, name: city.name, state_code: city.stateCode })) }));
    repo.getEditable = vi.fn(async () => ({ business: { ...business, city_id: 'guaira-pr' }, input: { ...input, cityId: 'guaira-pr', areaCityIds: ['guaira-pr', 'eldorado-ms'] } }));
    open(repo, `/conta/profissional/${bid}/editar`);
    await screen.findByRole('radio', { name: 'Profissional autônomo' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByLabelText('Cidade', { exact: true })).toHaveValue('guaira-pr');
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).toHaveTextContent('Eldorado/MS');
    expect(screen.getByRole('list',{name:'Cidades adicionais selecionadas'})).not.toHaveTextContent('Mundo Novo/MS');
    expect(repo.saveDraft).not.toHaveBeenCalled();
    await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ cityId: 'guaira-pr', areaCityIds: ['guaira-pr', 'eldorado-ms'] })));
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserva várias especialidades, promove principal e salva sem duplicar negócio (empresa=%s)', async company => {
    const repo = repository(); open(repo); await details(company);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pintura' }));
    await finalStep();
    expect(screen.getByRole('region', { name: 'Revisão do cadastro' })).toHaveTextContent('Pintura');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('checkbox', { name: 'Pintura' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Pintura' }));
    expect(screen.getByRole('checkbox', { name: 'Elétrica' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Pintura' })).not.toBeInTheDocument();
    await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ categoryId: 'pintura', additionalCategoryIds: ['eletrica'] })));
    expect(repo.createDraft).toHaveBeenCalledOnce();
  });
  it('edição carrega as adicionais e permite removê-las sem excluir serviços', async () => {
    const repo = repository();
    repo.getEditable = vi.fn(async () => ({ business, input: { ...input, additionalCategoryIds: ['pintura'], expectedSpecialties: { primaryId: 'eletrica', additionalIds: ['pintura'] } } }));
    open(repo, `/conta/profissional/${bid}/editar`);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('checkbox', { name: 'Pintura' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Remover especialidade Pintura' }));
    await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ additionalCategoryIds: [], expectedSpecialties: { primaryId: 'eletrica', additionalIds: ['pintura'] } })));
    expect(repo.createDraft).not.toHaveBeenCalled();
  });
  it('migração pendente mantém a categoria principal e o cadastro anterior funcionando', async () => {
    const repo = repository(); repo.getCatalog = vi.fn(async () => ({ ...catalog, specialtiesAvailable: false }));
    open(repo); await details();
    expect(screen.queryByRole('checkbox', { name: 'Pintura' })).not.toBeInTheDocument();
    expect(screen.getByText(/especialidades adicionais aguardam/)).toBeVisible();
    await finalStep(); fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(repo.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ categoryId: 'eletrica', additionalCategoryIds: [] })));
  });
  it('conflito preserva as escolhas e não cria outro perfil na repetição', async () => {
    const repo = repository(); repo.saveDraft = vi.fn().mockRejectedValue({ code: '40001' });
    open(repo); await details(); fireEvent.click(screen.getByRole('checkbox', { name: 'Pintura' })); await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Outro responsável');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('checkbox', { name: 'Pintura' })).toBeChecked();
    expect(repo.createDraft).toHaveBeenCalledOnce();
  });
  it('valida campos e preserva dados ao voltar etapas', async () => {
    const repo = repository(); open(repo);
    await screen.findByRole('radio', { name: 'Profissional autônomo' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Nome profissional'), { target: { value: 'Nome de teste' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Continuar' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione uma categoria');
    fireEvent.click(screen.getByRole('radio', { name: 'Elétrica' }));
    await finalStep();
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: 'errado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByLabelText('Nome profissional')).toHaveValue('Nome de teste');
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it('preserva dados empresariais ao voltar da revisão para informações e avançar', async () => {
    open(repository()); await details(true); await finalStep();
    fireEvent.click(screen.getByText('Dados empresariais privados', { exact: true, selector: 'summary' }));
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Nome privado existente' } });
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12345678000199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('radio', { name: 'Elétrica' })).toBeChecked();
    expect(screen.getByLabelText('Nome da empresa')).toHaveValue('Nome de teste');
    await finalStep();
    expect(screen.getByLabelText('Razão social')).toHaveValue('Nome privado existente');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12345678000199');
  });

  it('permite rascunho sem WhatsApp, sem oferecer publicação', async () => {
    const repo = repository(); open(repo); await details(); await finalStep();
    expect(screen.queryByRole('button', { name: /^Publicar$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
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
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
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
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
  });

  it('edita um perfil existente sem executar criação', async () => {
    writeCheckpoint('registration-user', { slug: 'draft-teste', businessId: bid });
    const repo = repository(); open(repo, `/conta/profissional/${bid}/editar`);
    await details(); await finalStep();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
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
    await screen.findByRole('heading', { level: 1, name: 'Meu perfil' });
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
