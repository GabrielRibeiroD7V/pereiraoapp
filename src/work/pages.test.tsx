import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { createWorkFixtures, fixtureBusinessId } from '../test/workFixtures';
import { optimizeImage } from './images';
vi.mock('./images', async (original) => ({ ...await original<typeof import('./images')>(), optimizeImage: vi.fn(async () => new Blob(['optimized'], { type: 'image/webp' })) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function open(kind = 'servicos', visitor = false) {
  const fixtures = createWorkFixtures(false, visitor);
  render(<MemoryRouter initialEntries={[`/conta/profissional/${fixtureBusinessId}/${kind}`]}><App authGateway={fixtures.gateway} professionalRepository={fixtures.professional} workRepository={fixtures.work} /></MemoryRouter>);
  return fixtures;
}
describe('gerenciamento de serviços e fotografias', () => {
  it('mantém três abas e salva preço fixo pelo negócio selecionado', async () => {
    const fixtures = open(); const save = vi.spyOn(fixtures.work, 'saveService');
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Serviço novo' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'eletrica' } });
    fireEvent.change(screen.getByLabelText('Tipo de preço'), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '150,99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    expect(await screen.findByRole('heading', { name: 'Serviço novo' })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(fixtureBusinessId, expect.any(String), expect.objectContaining({ price: '150,99', pricingType: 'fixed' }), true);
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('link')).toHaveLength(3);
  });
  it('exige confirmação para excluir serviço e mantém as fotografias', async () => {
    const fixtures = open(); const remove = vi.spyOn(fixtures.work, 'deleteService');
    fireEvent.click(await screen.findByRole('button', { name: /Excluir serviço Instalação/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Excluir serviço Instalação/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(fixtures.snapshot().photos).toHaveLength(2); expect(fixtures.snapshot().photos.every((row) => row.service_id === null)).toBe(true);
  });
  it('bloqueia submissões repetidas do serviço enquanto a resposta não chega', async () => {
    const fixtures = open(); let resolve!: () => void;
    const save = vi.spyOn(fixtures.work, 'saveService').mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar serviço' }));
    fireEvent.change(screen.getByLabelText('Nome do serviço'), { target: { value: 'Serviço sob orçamento' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'eletrica' } });
    const form = screen.getByRole('button', { name: 'Salvar serviço' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(save).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    resolve(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('mostra prévia antes de enviar e libera a URL local ao fechar', async () => {
    const NativeURL = URL, revoke = vi.fn();
    vi.stubGlobal('URL', class extends NativeURL { static createObjectURL() { return 'blob:local-only'; } static revokeObjectURL = revoke; });
    const fixtures = open('trabalhos'); const upload = vi.spyOn(fixtures.work, 'uploadPhoto');
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar foto de trabalho' }));
    fireEvent.change(screen.getByLabelText('Fotografia do trabalho'), { target: { files: [new File(['local'], 'foto.png', { type: 'image/png' })] } });
    expect(await screen.findByAltText('Prévia da fotografia selecionada')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled(); expect(optimizeImage).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Legenda (opcional)'), { target: { value: 'Nova foto local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar fotografia' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Nova foto local')).toBeInTheDocument(); expect(upload).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:local-only');
  });
  it('não oferece fotos de trabalhos como retrato automaticamente', async () => {
    open('trabalhos');
    expect(await screen.findByText('Instalação residencial')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar como foto principal' })).not.toBeInTheDocument();
    expect(screen.getByText(/Estas fotos são trabalhos realizados/)).toBeInTheDocument();
  });
  it('mantém a confirmação e os dados quando excluir fotografia falha', async () => {
    const fixtures = open('trabalhos'); const remove = vi.spyOn(fixtures.work, 'deletePhoto').mockRejectedValueOnce(new Error('local failure'));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir fotografia Instalação residencial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pendente');
    expect(fixtures.snapshot().photos).toHaveLength(2); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(remove).toHaveBeenCalledOnce();
  });
  it('redireciona visitante preservando a rota privada sem consultar negócios', async () => {
    const fixtures = open('trabalhos', true); const list = vi.spyOn(fixtures.work, 'list');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', `/criar-conta?next=${encodeURIComponent(`/conta/profissional/${fixtureBusinessId}/trabalhos`)}`);
    expect(list).not.toHaveBeenCalled();
  });
});
