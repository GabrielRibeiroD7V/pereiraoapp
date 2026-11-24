import {beforeEach} from 'vitest';
import {profileViews,profileBusinessSelections} from '../posts/postReturn';
beforeEach(()=>{profileViews.clear();profileBusinessSelections.clear();});
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { AuthGateway } from '../auth/types';
import type { BusinessRow } from '../lib/database.types';
import type { ProfessionalRepository } from '../professional/types';
import type { WorkRepository } from '../work/types';
import type { ManagedPosts } from '../posts/types';
import { emptyRegistration } from '../professional/validation';

const first: BusinessRow = { id: '00000000-0000-4000-8000-000000000001', name: 'Autônomo de demonstração', type: 'autonomo', category_id: 'eletrica', city_id: 'mundo-novo-ms', status: 'draft', slug: 'demo', description: null, whatsapp: null, instagram: null, avatar_path: null, created_at: '', updated_at: '' };
const second: BusinessRow = { ...first, id: '00000000-0000-4000-8000-000000000002', name: 'Empresa de demonstração', type: 'empresa' };
function setup(path = '/conta', rows = [first, second], savedBusiness?: string, workRepository?: WorkRepository, managedPosts?: ManagedPosts) {
  let name = 'Nome cadastrado';
  const gateway: AuthGateway = {
    getSession: vi.fn(async () => ({ user: { id: 'local-user', email: 'demo@example.invalid', displayName: 'Nome antigo' } })),
    subscribe: () => () => {}, signIn: vi.fn(), signUp: vi.fn(), requestReset: vi.fn(), updatePassword: vi.fn(), signOut: vi.fn(), completeCallback: vi.fn(),
    getProfile: vi.fn(async () => ({ displayName: name, avatarUrl: null })),
    updateProfile: vi.fn(async (value) => { name = value; }),
  };
  const repository: ProfessionalRepository = { listMine: vi.fn(async () => rows), getCatalog: vi.fn(async () => ({ categories: [{ id: 'eletrica' as const, name: 'Elétrica' }], cities: [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }] })), getEditable: vi.fn(async (id: string) => ({ business: rows.find((row) => row.id === id)!, input: { ...emptyRegistration, name: rows.find(row => row.id === id)!.name, categoryId: 'eletrica' as const, cityId: 'mundo-novo-ms' } })), createDraft: vi.fn(), saveDraft: vi.fn() };
  render(<MemoryRouter initialEntries={[{ pathname: path, state: { businessId: savedBusiness } }]}><App authGateway={gateway} professionalRepository={repository} workRepository={workRepository} managedPosts={managedPosts} /></MemoryRouter>);
  return { gateway, repository };
}

describe('experiência pessoal e profissional', () => {
  it('abre o próprio perfil na aba Conta, com Direct e opções privadas', async () => {
    setup();
    expect(await screen.findByText('Conta de Nome cadastrado')).toBeInTheDocument();
    expect(screen.queryByText('Nome antigo')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir mensagens' })).toHaveAttribute('href', '/mensagens');
    expect(screen.getByLabelText('Perfil que você está vendo')).toHaveValue(first.id);
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', `/conta/profissional/${first.id}/editar`);
    expect(screen.queryByRole('link', { name: 'Fotos e trabalhos' })).not.toBeInTheDocument();
    fireEvent.click(document.querySelector('.owner-settings summary')!);
    expect(screen.getByRole('link', { name: /Cadastrar outro negócio/ })).toHaveAttribute('href', '/conta/profissional/cadastro');
    expect(screen.getAllByRole('link', { name: 'Editar perfil' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Aplicativo PEREIRÃO' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('link', { name: /Dados da conta/ })).toHaveAttribute('href', '/conta/dados');
    expect(screen.getByRole('link', { name: /Gratuidade e assinatura/ })).toHaveAttribute('href', '/conta/assinaturas');
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(4);
  });

  it('abre a orientação diretamente em Opções da conta, sem âncora nem segundo toque', async () => {
    setup();
    await screen.findByText('Conta de Nome cadastrado');
    fireEvent.click(document.querySelector('.owner-settings summary')!);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicativo PEREIRÃO' }));
    expect(screen.getByRole('dialog', { name: 'Instalar aplicativo' })).toBeVisible();
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Conta de Nome cadastrado')).toBeVisible();
  });

  it('edita o nome pessoal e o recupera ao voltar à conta', async () => {
    const { gateway } = setup();
    await screen.findByText('Conta de Nome cadastrado');
    fireEvent.click(document.querySelector('.owner-settings summary')!);
    fireEvent.click(await screen.findByRole('link', { name: /Dados da conta/ }));
    expect(await screen.findByRole('heading', { name: 'Dados da conta' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir meu perfil profissional' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Seu nome')).toHaveValue('Nome cadastrado'));
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Novo nome' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meus dados' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Seus dados foram salvos');
    expect(gateway.updateProfile).toHaveBeenCalledWith('Novo nome');
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à conta' }));
    expect(await screen.findByText('Conta de Novo nome')).toBeInTheDocument();
  });

  it('troca de perfil no próprio topo sem misturar dados dos negócios', async () => {
    const { repository } = setup();
    await screen.findByRole('heading', { name: first.name });
    fireEvent.change(screen.getByLabelText('Perfil que você está vendo'), { target: { value: second.id } });
    await waitFor(() => expect(repository.getEditable).toHaveBeenCalledWith(second.id));
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', `/conta/profissional/${second.id}/editar`);
    expect(screen.queryByRole('link', { name: 'Fotos e trabalhos' })).not.toBeInTheDocument();
  });

  it('mostra projetos do negócio apenas ao dono e mantém o rascunho privado', async () => {
    const posts = { get:async()=>({id:'post-1',business_id:first.id,title:'Reforma da cozinha',description:'Projeto concluído',status:'draft',images:[]}), load: vi.fn(async () => ({ business: { id: first.id, name: first.name, status: 'draft' }, posts: { items: [{ id: 'post-1', title: 'Reforma da cozinha', description: 'Projeto concluído', status: 'draft', images: [] }], next: null } })) } as unknown as ManagedPosts;
    setup('/conta', [first], undefined, undefined, posts);
    const cover = await screen.findByRole('link', { name: 'Abrir publicação Reforma da cozinha' });
    expect(cover).toHaveTextContent('Rascunho — só você vê');
    fireEvent.click(cover);
    expect(await screen.findByRole('article', { name: 'Reforma da cozinha' })).toHaveTextContent('Projeto concluído');
    expect(screen.getByRole('button', { name: 'Editar publicação' })).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Opções da publicação' }));
    expect(screen.getByRole('button', { name: 'Editar publicação' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Conversar' })).not.toBeInTheDocument();
    expect(screen.getByText('Rascunho — só você vê')).toBeInTheDocument();
    expect(posts.load).toHaveBeenCalledWith(first.id, 1);
  });

  it('volta do post para o mesmo negócio selecionado na Conta',async()=>{
    const post={id:'00000000-0000-4000-8000-000000009971',business_id:second.id,title:'Projeto de segundo perfil',description:'Conteúdo de teste local',status:'draft',images:[]};
    const posts={get:async()=>post,load:async(bid:string)=>({business:{id:bid,name:second.name,status:'draft'},posts:{items:bid===second.id?[post]:[],page:1,hasNext:false}})} as unknown as ManagedPosts;
    setup('/conta',[first,second],undefined,undefined,posts);
    await screen.findByRole('heading',{name:first.name});
    fireEvent.change(screen.getByLabelText('Perfil que você está vendo'),{target:{value:second.id}});
    fireEvent.click(await screen.findByRole('link',{name:'Abrir publicação Projeto de segundo perfil'}));
    await screen.findByRole('heading',{level:1,name:post.title});
    fireEvent.click(screen.getByRole('button',{name:'Voltar'}));
    await screen.findByRole('heading',{name:second.name});
    expect(screen.getByLabelText('Perfil que você está vendo')).toHaveValue(second.id);
    expect(screen.getByRole('link',{name:'Editar perfil'})).toHaveAttribute('href',`/conta/profissional/${second.id}/editar`);
  });

  it('oferece recuperação existente no contexto pessoal', async () => {
    setup('/conta/seguranca');
    const link = await screen.findByRole('link', { name: /Recuperar senha/ });
    expect(link).toHaveAttribute('href', '/recuperar-senha?next=%2Fconta%2Fseguranca');
  });

  it('abre a vitrine do negócio escolhido, com ações e serviços evidentes', async () => {
    setup('/conta', [first,second]);
    await screen.findByRole('heading', { name: first.name });
    fireEvent.change(screen.getByLabelText('Perfil que você está vendo'), { target: { value: second.id } });
    expect(await screen.findByRole('heading', { name: second.name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', `/conta/profissional/${second.id}/editar`);
    expect(screen.getByRole('link', { name: 'Gerenciar serviços' })).toHaveAttribute('href', `/conta/profissional/${second.id}/servicos`);
    expect(screen.getByRole('link', { name: 'Abrir mensagens' })).toHaveAttribute('href', '/mensagens');
    expect(document.querySelectorAll('a[href="/mensagens"]')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Serviços e preços' })).toBeVisible();
  });

  it('mostra bio e contato na prévia privada de um rascunho, sem publicar', async () => {
    const { repository } = setup(`/conta/profissional/${first.id}/perfil`, [first]);
    vi.mocked(repository.getEditable).mockResolvedValueOnce({ business: first, input: { ...emptyRegistration, name: first.name, description: 'Pintura residencial e comercial.', categoryId: 'eletrica', cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], whatsapp: '5567999991234', legalName: 'Dado privado' } });
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();
    expect(screen.getByText('Pintura residencial e comercial.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp de/ })).toHaveAttribute('href', expect.stringContaining('5567999991234'));
    expect(screen.getByText(/Só você pode ver este perfil/)).toBeInTheDocument();
    expect(screen.queryByText('Dado privado')).not.toBeInTheDocument();
  });

  it('mostra perfil compacto sem números de páginas parciais', async () => {
    const work = { list: vi.fn(async () => ({ services: [{ id: 'servico', active: true }], photos: [{ id: 'foto', media_state: 'ready', storage_path: `${first.id}/portfolio/foto.webp` }] })), imageUrl: vi.fn(async () => 'https://example.invalid/foto.webp') } as unknown as WorkRepository;
    const { repository } = setup(`/conta/profissional/${first.id}/previa`, [first], undefined, work);
    vi.mocked(repository.getEditable).mockResolvedValueOnce({ business: first, input: { ...emptyRegistration, name: first.name, description: 'Atendimento na região.', categoryId: 'eletrica' as const, cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'] } });
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Resumo do perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fotos e trabalhos' })).not.toBeInTheDocument();
    expect(screen.getByText('Atendimento na região.')).toBeInTheDocument();
  });

  it('edita dados empresariais somente na área privada da Conta', async () => {
    const { repository } = setup(`/conta/profissional/${second.id}/dados-empresariais`, [second]);
    const value = { business: second, input: { ...emptyRegistration, type: 'empresa' as const, name: second.name, categoryId: 'eletrica' as const, cityId: 'mundo-novo-ms', description: 'Bio pública preservada', legalName: 'Razão privada', taxId: '12345678000199' } };
    vi.mocked(repository.getEditable).mockResolvedValue(value);
    expect(await screen.findByLabelText('Razão social')).toHaveValue('Razão privada');
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Descartar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Razão social')).toHaveValue('Razão privada');
    expect(repository.saveDraft).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Razão atualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados empresariais' }));
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledWith(second.id, expect.objectContaining({ legalName: 'Razão atualizada', description: 'Bio pública preservada' })));
    expect(screen.queryByLabelText('Bio')).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', `/conta/profissional/${second.id}/editar`);
  });
});
