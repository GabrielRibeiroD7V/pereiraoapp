import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { createWorkFixtures, fixtureBusinessId as bid } from '../test/workFixtures';
import type { EditableBusiness, RegistrationInput } from '../professional/types';
import { postsFixtures } from '../test/postsFixtures';
import { emptyRegistration } from '../professional/validation';

function open(section = '', visitor = false, company = false) {
  const f = createWorkFixtures(false, visitor);
  let input: RegistrationInput = { ...emptyRegistration, type: company ? 'empresa' : 'autonomo', name: 'Perfil salvo', description: 'Bio salva', categoryId: 'climatizacao', cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], legalName: 'Privado', taxId: '12345678000199' };
  const business = { id: bid, name: input.name, type: input.type, slug: 'local', city_id: input.cityId, category_id: 'climatizacao' as const, status: 'draft' as const, description: input.description, whatsapp: null, instagram: null, avatar_path: null, created_at: '', updated_at: '' };
  const professional = { ...f.professional, getEditable: vi.fn(async (id: string): Promise<EditableBusiness> => {
    if (id !== bid) throw { code: 'NOT_MANAGER' };
    return { business: { ...business, name: input.name, description: input.description, type: input.type }, input: { ...input } };
  }), createDraft: vi.fn(), saveDraft: vi.fn(async (_id: string, value: RegistrationInput) => { input = { ...value }; }) };
  render(<MemoryRouter initialEntries={[`/conta/profissional/${bid}/editar${section}`]}><App authGateway={f.gateway} professionalRepository={professional} workRepository={f.work} managedPosts={postsFixtures('draft', true).managed} /></MemoryRouter>);
  return { ...f, professional };
}
describe('área central do perfil existente', () => {
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
    const form = screen.getByRole('button', { name: 'Salvar alterações' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(f.professional.saveDraft).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toHaveValue('Preservar esta edição');
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    expect(await screen.findByText('Bio salva')).toBeVisible();
  });
  it.each(['servicos', 'trabalhos', 'publicacoes'])('retorna de %s à central do mesmo negócio sem cadastro em etapas', async page => {
    open('?secao=conteudo');
    fireEvent.click(await screen.findByRole('link', { name: page === 'servicos' ? /Meus serviços/ : page === 'trabalhos' ? /Adicionar foto de trabalho/ : /Publicações de trabalhos/ }));
    const back = await screen.findByRole('link', { name: 'Voltar a editar perfil' });
    expect(back).toHaveAttribute('href', `/conta/profissional/${bid}/editar?secao=conteudo`);
    if (page === 'trabalhos') expect(await screen.findByRole('button', { name: 'Adicionar foto de trabalho' })).toBeInTheDocument();
    fireEvent.click(back);
    expect(await screen.findByRole('tab', { name: 'Conteúdo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
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
