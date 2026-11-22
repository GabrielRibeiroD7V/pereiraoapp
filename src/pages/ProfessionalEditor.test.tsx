import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { createWorkFixtures, fixtureBusinessId as bid } from '../test/workFixtures';
import type { EditableBusiness, RegistrationInput } from '../professional/types';
import { postsFixtures } from '../test/postsFixtures';
import { emptyRegistration } from '../professional/validation';

vi.mock('../work/images', async original => ({ ...await original<typeof import('../work/images')>(), optimizeImage: vi.fn(async () => new Blob(['synthetic'], { type: 'image/webp' })) }));
afterEach(() => vi.unstubAllGlobals());

function open(section = '', visitor = false, company = false, route?: string, presentationRepository?: import('../presentation/model').PresentationRepository) {
  const f = createWorkFixtures(false, visitor);
  let input: RegistrationInput = { ...emptyRegistration, type: company ? 'empresa' : 'autonomo', name: 'Perfil salvo', description: 'Bio salva', categoryId: 'climatizacao', cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], legalName: 'Privado', taxId: '12345678000199' };
  const business = { id: bid, name: input.name, type: input.type, slug: 'local', city_id: input.cityId, category_id: 'climatizacao' as const, status: 'draft' as const, description: input.description, whatsapp: null, instagram: null, avatar_path: null, created_at: '', updated_at: '' };
  const professional = { ...f.professional, getEditable: vi.fn(async (id: string): Promise<EditableBusiness> => {
    if (id !== bid) throw { code: 'NOT_MANAGER' };
    return { business: { ...business, name: input.name, description: input.description, type: input.type }, input: { ...input } };
  }), createDraft: vi.fn(), saveDraft: vi.fn(async (_id: string, value: RegistrationInput) => { input = { ...value }; }) };
  render(<MemoryRouter initialEntries={[route ?? `/conta/profissional/${bid}/editar${section}`]}><App presentationRepository={presentationRepository} authGateway={f.gateway} professionalRepository={professional} workRepository={f.work} managedPosts={postsFixtures('draft', true).managed} /></MemoryRouter>);
  return { ...f, professional };
}
describe('área central do perfil existente', () => {
  it('a vitrine usa título persistido e não a apresentação ainda em edição', async () => {
    let saved = { headline: 'Título persistido', experience: '', education: '', certifications: '', professional_registration: '' };
    const repository = { get: vi.fn(async () => ({ available: true, data: { ...saved } })), save: vi.fn(async (_id: string, value: typeof saved) => { saved = { ...value }; }) };
    open('', false, false, undefined, repository);
    fireEvent.change(await screen.findByLabelText('Título profissional'), { target: { value: 'Título não salvo' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await screen.findByText('Título persistido')).toBeVisible();
    expect(screen.queryByText('Título não salvo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar apresentação' }));
    await screen.findByText(/Apresentação salva/);
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await screen.findByText('Título não salvo')).toBeVisible();
    expect(repository.save).toHaveBeenCalledWith(bid, expect.objectContaining({ headline: 'Título não salvo' }));
  });
  it('abre Adicionar serviço diretamente da entrada, cancela sem gravar e mantém o negócio', async () => {
    const f = open();
    await screen.findByLabelText('Bio');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }));
    expect(await screen.findByRole('dialog', { name: 'Adicionar serviço' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Serviços e preços' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('Preço (R$)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(f.professional.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Editar perfil profissional' })).toBeVisible();
  });
  it('separa edição do primeiro cadastro, mantém três abas principais e não mostra dados privados', async () => {
    open();
    expect(await screen.findByLabelText('Bio')).toHaveValue('Bio salva');
    expect(screen.getByRole('heading', { name: 'Editar perfil profissional' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('CNPJ')).not.toBeInTheDocument();
    expect(screen.queryByText('Privado')).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
  });
  it('mostra somente dados gravados na prévia até salvar; salva sem criar nem publicar', async () => {
    const f = open();
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'Bio em edição' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await screen.findByText('Bio salva')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Prévia dos dados salvos' })).queryByText('Bio em edição')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar perfil' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText(/Alterações salvas\./);
    expect(f.professional.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ description: 'Bio em edição' }));
    expect(f.professional.saveDraft.mock.calls[0]![1]).not.toHaveProperty('status');
    expect(f.professional.createDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await within(screen.getByRole('region', { name: 'Prévia dos dados salvos' })).findByText('Bio em edição')).toBeVisible();
    expect(screen.getByText(/Rascunho privado/)).toBeVisible();
  });
  it('preserva dados empresariais privados sem exibi-los no editor público', async () => {
    const f = open('', false, true);
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'Empresa atualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText(/Alterações salvas\./);
    expect(f.professional.saveDraft).toHaveBeenCalledWith(bid, expect.objectContaining({ type: 'empresa', legalName: 'Privado', taxId: '12345678000199' }));
    expect(screen.queryByText('Privado')).not.toBeInTheDocument();
  });
  it('cancelar restaura os valores sem escrever; as abas preservam o texto em edição', async () => {
    const f = open();
    fireEvent.change(await screen.findByLabelText('Nome profissional'), { target: { value: 'Não salvo' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Atendimento' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    expect(screen.getByLabelText('Nome profissional')).toHaveValue('Não salvo');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alterações' }));
    expect(screen.getByLabelText('Nome profissional')).toHaveValue('Perfil salvo');
    expect(f.professional.saveDraft).not.toHaveBeenCalled();
  });
  it('protege saída por links e recarga com alterações; permite continuar editando', async () => {
    const f = open();
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'Não perder' } });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à Conta' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Descartar alterações');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByLabelText('Bio')).toHaveValue('Não perder');
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à Conta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    expect(await screen.findByRole('heading', { name: 'Meu perfil' })).toBeInTheDocument();
    expect(f.professional.saveDraft).not.toHaveBeenCalled();
  });
  it('falha preserva edição e prévia antiga; cliques repetidos não duplicam gravação', async () => {
    const f = open(); let reject!: (error: Error) => void;
    f.professional.saveDraft.mockImplementationOnce(() => new Promise<void>((_resolve, no) => { reject = no; }));
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'Preservar esta edição' } });
    const form = (screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement).form!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(f.professional.saveDraft).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toHaveValue('Preservar esta edição');
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await screen.findByText('Bio salva')).toBeVisible();
  });
  it('gerencia serviços na central sem abrir outra rota ou submeter os dados do perfil', async () => {
    const f = open('?secao=conteudo');
    const save = vi.spyOn(f.work, 'saveService');
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    expect(document.querySelector('form form')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Novo serviço na central' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'eletrica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    expect(await screen.findByRole('heading', { name: 'Novo serviço na central' })).toBeInTheDocument();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]![0]).toBe(bid);
    expect(f.professional.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Editar perfil profissional' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voltar a editar perfil' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir serviço Novo serviço na central' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: 'Novo serviço na central' })).toBeInTheDocument();
  });
  it('abre e cancela foto de trabalho na central preservando edições textuais', async () => {
    const NativeURL = URL;
    vi.stubGlobal('URL', class extends NativeURL { static createObjectURL() { return 'blob:synthetic'; } static revokeObjectURL() {} });
    const f = open();
    const upload = vi.spyOn(f.work, 'uploadPhoto');
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'Bio não salva' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Conteúdo' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Fotos de trabalhos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar foto de trabalho' }));
    expect(document.querySelector('form form')).toBeNull();
    expect(screen.getByLabelText('Fotografia do trabalho')).toHaveAttribute('type', 'file');
    fireEvent.change(screen.getByLabelText('Fotografia do trabalho'), { target: { files: [new File(['synthetic'], 'synthetic.png', { type: 'image/png' })] } });
    expect(await screen.findByAltText('Prévia da fotografia selecionada')).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    expect(screen.getByLabelText('Bio')).toHaveValue('Bio não salva');
    expect(f.professional.saveDraft).not.toHaveBeenCalled();
  });
  it('abre o editor de publicações e cancela dentro da central', async () => {
    open('?secao=conteudo&conteudo=publicacoes');
    fireEvent.click(await screen.findByRole('button', { name: 'Nova publicação' }));
    expect(document.querySelector('form form')).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('tab', { name: 'Publicações' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Editar perfil profissional' })).toBeInTheDocument();
  });
  it.each([['servicos', 'servicos'], ['trabalhos', 'fotos'], ['publicacoes', 'publicacoes']])('mantém link antigo /%s e retorna ao gerenciador do mesmo negócio', async (path, manager) => {
    open('', false, false, `/conta/profissional/${bid}/${path}`);
    const link = await screen.findByRole('link', { name: 'Voltar a editar perfil' });
    expect(link).toHaveAttribute('href', `/conta/profissional/${bid}/editar?secao=conteudo&conteudo=${manager}`);
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Editar perfil profissional' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Conteúdo' })).toHaveAttribute('aria-selected', 'true');
  });
  it('redireciona visitante sem consultar o negócio, preservando o destino', async () => {
    const f = open('', true);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(f.professional.getEditable).not.toHaveBeenCalled();
  });
  it('não mostra formulário quando a conta não gerencia o negócio', async () => {
    const f = open();
    f.professional.getEditable.mockRejectedValue({ code: '42501' });
    // The asynchronous auth boundary has not loaded the route yet.
    expect(await screen.findByRole('alert')).toHaveTextContent('permissão');
    expect(screen.queryByLabelText('Bio')).not.toBeInTheDocument();
  });
});
