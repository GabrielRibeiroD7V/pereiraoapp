import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { createWorkFixtures, fixtureBusinessId as bid } from '../test/workFixtures';
import { WorkProvider } from './WorkProvider';
import { optimizeImage } from './images';
import { cropProfileImage } from './profileCrop';
vi.mock('./profileCrop', async original => ({ ...await original<typeof import('./profileCrop')>(), cropProfileImage: vi.fn(async () => new Blob(['cropped'], { type: 'image/webp' })) }));
vi.mock('./images', async original => ({ ...await original<typeof import('./images')>(), optimizeImage: vi.fn(async () => new Blob(['optimized'], { type: 'image/webp' })) }));
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:profile-only') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.mocked(cropProfileImage).mockReset().mockResolvedValue(new Blob(['cropped'], { type: 'image/webp' })); vi.restoreAllMocks(); vi.mocked(optimizeImage).mockReset().mockResolvedValue(new Blob(['optimized'], { type: 'image/webp' })); });
function setup(path: string | null = null) {
  const fixtures = createWorkFixtures(), onSaved = vi.fn();
  const upload = vi.spyOn(fixtures.work, 'uploadProfilePhoto');
  const portfolio = vi.spyOn(fixtures.work, 'uploadPhoto');
  render(<WorkProvider repository={fixtures.work}><ProfilePhotoPicker businessId={bid} path={path} repository={fixtures.work} onSaved={onSaved} /></WorkProvider>);
  return { fixtures, onSaved, upload, portfolio };
}
async function readyPreview() {
  const image = await screen.findByAltText('Prévia da nova foto principal');
  Object.defineProperties(image, { naturalWidth: { configurable: true, value: 900 }, naturalHeight: { configurable: true, value: 1600 } });
  fireEvent.load(image);
  return image;
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
    expect(await readyPreview()).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(upload).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(fixtures.snapshot().photos).toHaveLength(2);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-only'));
  });
  it('confirma uma única vez e não mistura retrato com fotografias de trabalhos', async () => {
    const { upload, portfolio, onSaved, fixtures } = setup(); select();
    await readyPreview();
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
    await readyPreview();
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
    select(); await readyPreview();
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

  it('envia o enquadramento escolhido, não a foto vertical inteira', async () => {
    const { upload } = setup(); select(); await readyPreview();
    fireEvent.click(screen.getByText('Ajustes'));
    fireEvent.change(screen.getByLabelText('Zoom da foto'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Posição vertical'), { target: { value: '0.1' } });
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    expect(cropProfileImage).toHaveBeenCalledWith(expect.any(Blob), { x: .5, y: .1, zoom: 2 });
    expect(await upload.mock.calls[0]![2].text()).toBe('cropped');
  });
  it('falha ao recortar não envia e permite reajustar preservando a foto atual', async () => {
    vi.mocked(cropProfileImage).mockRejectedValueOnce(new Error('Recorte indisponível'));
    const { upload, onSaved } = setup(); select(); await readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Recorte indisponível');
    expect(screen.getByLabelText('Zoom da foto')).toBeEnabled();
    expect(upload).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled();
  });
  it('após falha de upload mantém o mesmo recorte e ID para repetição segura', async () => {
    const { upload, onSaved } = setup(); upload.mockRejectedValueOnce({ code: '08006' }); select(); await readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Zoom da foto')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar foto' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(cropProfileImage).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]![1]).toBe(upload.mock.calls[1]![1]);
    expect(upload.mock.calls[0]![2]).toBe(upload.mock.calls[1]![2]);
  });

});
