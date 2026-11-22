import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { BusinessRow } from '../lib/database.types';
import type { ProfessionalRepository } from '../professional/types';
import { emptyRegistration } from '../professional/validation';

const first: BusinessRow = { id: '00000000-0000-4000-8000-000000000001', name: 'Autônomo de demonstração', type: 'autonomo', category_id: 'eletrica', city_id: 'mundo-novo-ms', status: 'draft', slug: 'demo', description: null, whatsapp: null, instagram: null, avatar_path: null, created_at: '', updated_at: '' };
const second: BusinessRow = { ...first, id: '00000000-0000-4000-8000-000000000002', name: 'Empresa de demonstração', type: 'empresa' };
function setup(path = '/conta', rows = [first, second], savedBusiness?: string) {
  let name = 'Nome cadastrado';
  const gateway: AuthGateway = {
    getSession: vi.fn(async () => ({ user: { id: 'local-user', email: 'demo@example.invalid', displayName: 'Nome antigo' } })),
    subscribe: () => () => {}, signIn: vi.fn(), signUp: vi.fn(), requestReset: vi.fn(), updatePassword: vi.fn(), signOut: vi.fn(), completeCallback: vi.fn(),
    getProfile: vi.fn(async () => ({ displayName: name, avatarUrl: null })),
    updateProfile: vi.fn(async (value) => { name = value; }),
  };
  const repository: ProfessionalRepository = { listMine: vi.fn(async () => rows), getCatalog: vi.fn(async () => ({ categories: [{ id: 'eletrica' as const, name: 'Elétrica' }], cities: [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }] })), getEditable: vi.fn(async (id: string) => ({ business: rows.find((row) => row.id === id)!, input: { ...emptyRegistration, name: 'Nome existente', categoryId: 'eletrica' as const, cityId: 'mundo-novo-ms' } })), createDraft: vi.fn(), saveDraft: vi.fn() };
  render(<MemoryRouter initialEntries={[{ pathname: path, state: { businessId: savedBusiness } }]}><App authGateway={gateway} professionalRepository={repository} /></MemoryRouter>);
  return { gateway, repository };
}

describe('experiência pessoal e profissional', () => {
  it('separa conta de negócio, lê o nome cadastrado e mantém três abas', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Nome cadastrado' })).toBeInTheDocument();
    expect(screen.queryByText('Nome antigo')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Meu Espaço Profissional/ })).toHaveAttribute('href', '/conta/profissional');
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByText('Minha assinatura')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Configurações/ })).not.toBeInTheDocument();
  });

  it('edita o nome pessoal e o recupera ao voltar à conta', async () => {
    const { gateway } = setup();
    fireEvent.click(await screen.findByRole('link', { name: 'Editar meus dados pessoais' }));
    expect(await screen.findByRole('link', { name: 'Abrir meu perfil profissional' })).toHaveAttribute('href', '/conta/profissional');
    await waitFor(() => expect(screen.getByLabelText('Seu nome')).toHaveValue('Nome cadastrado'));
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Novo nome' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meus dados' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Seus dados foram salvos');
    expect(gateway.updateProfile).toHaveBeenCalledWith('Novo nome');
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à conta' }));
    expect(await screen.findByRole('heading', { name: 'Novo nome' })).toBeInTheDocument();
  });

  it('oferece recuperação existente no contexto pessoal', async () => {
    setup('/conta/seguranca');
    const link = await screen.findByRole('link', { name: /Recuperar senha/ });
    expect(link).toHaveAttribute('href', '/recuperar-senha?next=%2Fconta%2Fseguranca');
  });

  it('seleciona o negócio administrado e oferece a caixa de mensagens', async () => {
    setup('/conta/profissional');
    await screen.findByRole('heading', { name: first.name });
    fireEvent.change(screen.getByLabelText('Negócio que você quer gerenciar'), { target: { value: second.id } });
    expect(screen.getByRole('heading', { name: second.name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', `/conta/profissional/${second.id}/editar`);
    expect(screen.getByRole('link', { name: /Meu perfil/ })).toHaveAttribute('href', `/conta/profissional/${second.id}/editar`);
    expect(screen.getByRole('link', { name: 'Ver prévia do perfil' })).toHaveAttribute('href', `/conta/profissional/${second.id}/previa`);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Meus serviços/ })).toHaveAttribute('href', `/conta/profissional/${second.id}/servicos`);
    expect(screen.getByRole('link', { name: /Meus trabalhos/ })).toHaveAttribute('href', `/conta/profissional/${second.id}/trabalhos`);
    expect(screen.getByRole('link', { name: /^MensagensConversas com seus clientes/ })).toHaveAttribute('href', '/mensagens');
  });

  it('mostra bio e contato na prévia privada de um rascunho, sem publicar', async () => {
    const { repository } = setup('/conta/profissional', [first]);
    vi.mocked(repository.getEditable).mockResolvedValueOnce({ business: first, input: { ...emptyRegistration, name: first.name, description: 'Pintura residencial e comercial.', categoryId: 'eletrica', cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], whatsapp: '5567999991234', legalName: 'Dado privado' } });
    fireEvent.click(await screen.findByRole('link', { name: 'Ver prévia do perfil' }));
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();
    expect(screen.getByText('Pintura residencial e comercial.')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp: 5567999991234')).toBeInTheDocument();
    expect(screen.getByText(/Prévia privada/)).toBeInTheDocument();
    expect(screen.queryByText('Dado privado')).not.toBeInTheDocument();
  });

  it('oferece primeiro cadastro sem criar registros ao abrir o espaço vazio', async () => {
    const { repository } = setup('/conta/profissional', []);
    expect(await screen.findByRole('link', { name: 'Cadastrar meu negócio' })).toBeInTheDocument();
    expect(repository.createDraft).not.toHaveBeenCalled();
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('retorna ao negócio que acabou de ser salvo, sem escolher outro por engano', async () => {
    setup('/conta/profissional', [first, second], second.id);
    expect(await screen.findByRole('heading', { name: second.name })).toBeInTheDocument();
    expect(screen.getByLabelText('Negócio que você quer gerenciar')).toHaveValue(second.id);
  });
});
