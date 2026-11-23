import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { createWorkFixtures, fixtureBusinessId as bid } from '../test/workFixtures';
import { WorkProvider } from './WorkProvider';
import { optimizeImage } from './images';
vi.mock('./images', async original => ({ ...await original<typeof import('./images')>(), optimizeImage: vi.fn(async () => new Blob(['optimized'], { type: 'image/webp' })) }));
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:profile-only') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); vi.mocked(optimizeImage).mockReset().mockResolvedValue(new Blob(['optimized'], { type: 'image/webp' })); });
function setup(path: string | null = null) {
  const fixtures = createWorkFixtures(), onSaved = vi.fn();
  const upload = vi.spyOn(fixtures.work, 'uploadProfilePhoto');
  const portfolio = vi.spyOn(fixtures.work, 'uploadPhoto');
  render(<WorkProvider repository={fixtures.work}><ProfilePhotoPicker businessId={bid} path={path} repository={fixtures.work} onSaved={onSaved} /></WorkProvider>);
  return { fixtures, onSaved, upload, portfolio };
}
function select() { fireEvent.change(screen.getByLabelText('Selecionar foto principal'), { target: { files: [new File(['photo'], 'my-photo.png', { type: 'image/png' })] } }); }
describe('retrato direto com confirmação, sem portfólio', () => {
  it('ambos os botões invocam o seletor no mesmo gesto, sem navegação intermediária', () => {
    const { upload } = setup();
    const input = screen.getByLabelText('Selecionar foto principal');
    const click = vi.spyOn(input as HTMLInputElement, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar foto principal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar fotografia' }));
    expect(click).toHaveBeenCalledTimes(2); expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('mostra prévia sem enviar e cancelar não altera dados', async () => {
    const { upload, onSaved, fixtures } = setup(); select();
    expect(await screen.findByAltText('Prévia da nova foto principal')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(upload).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(fixtures.snapshot().photos).toHaveLength(2);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-only'));
  });
  it('confirma uma única vez e não mistura retrato com fotografias de trabalhos', async () => {
    const { upload, portfolio, onSaved, fixtures } = setup(); select();
    await screen.findByAltText('Prévia da nova foto principal');
    const confirm = screen.getByRole('button', { name: 'Confirmar e enviar foto' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(upload).toHaveBeenCalledOnce(); expect(portfolio).not.toHaveBeenCalled();
    expect(fixtures.snapshot().photos).toHaveLength(2);
    expect(onSaved.mock.calls[0]?.[0]).toContain('/profile/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('falha mantém prévia e foto anterior; nova tentativa usa o mesmo ID', async () => {
    const { upload, onSaved } = setup(); upload.mockRejectedValueOnce({ code: '08006' }); select();
    await screen.findByAltText('Prévia da nova foto principal');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(upload.mock.calls[0]?.[1]).toBe(upload.mock.calls[1]?.[1]);
  });
  it('arquivo inválido não chega ao repositório', async () => {
    vi.mocked(optimizeImage).mockRejectedValueOnce(new Error('Imagem inválida'));
    const { upload } = setup(); select();
    expect(await screen.findByRole('alert')).toHaveTextContent('Imagem inválida');
    expect(upload).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Confirmar e enviar foto' })).toBeDisabled();
  });
  it('resposta tardia de um negócio não atualiza o perfil depois de desmontar', async () => {
    const fixtures = createWorkFixtures(), saved = vi.fn();
    let resolve!: (path: string) => void;
    vi.spyOn(fixtures.work, 'uploadProfilePhoto').mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = render(<WorkProvider repository={fixtures.work}><ProfilePhotoPicker businessId={bid} path={null} repository={fixtures.work} onSaved={saved} /></WorkProvider>);
    select(); await screen.findByAltText('Prévia da nova foto principal');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    view.unmount(); resolve(`${bid}/profile/new.webp`);
    await waitFor(() => expect(saved).not.toHaveBeenCalled());
  });
  it('cancelamento do seletor não abre diálogo nem envia', () => {
    const { upload } = setup(); fireEvent.change(screen.getByLabelText('Selecionar foto principal'), { target: { files: [] } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(upload).not.toHaveBeenCalled();
  });
  it('cancelar durante a otimização ignora o resultado tardio', async () => {
    let resolve!: (blob: Blob) => void;
    vi.mocked(optimizeImage).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const { upload } = setup(); select();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    resolve(new Blob(['x'], { type: 'image/webp' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(upload).not.toHaveBeenCalled();
  });
  it('falha antes de upload preserva o retrato anterior e oferece outro seletor', async () => {
    const previous = `${bid}/profile/00000000-0000-4000-8000-000000000099.webp`;
    vi.mocked(optimizeImage).mockRejectedValueOnce(new Error('A conversão compatível desta foto não pôde ser concluída.'));
    const { upload, onSaved } = setup(previous); select();
    expect(await screen.findByRole('alert')).toHaveTextContent('conversão compatível');
    expect(screen.getByRole('button', { name: 'Confirmar e enviar foto' })).toBeDisabled();
    expect(upload).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Selecionar foto principal') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra foto' }));
    expect(click).toHaveBeenCalledOnce(); expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

});
