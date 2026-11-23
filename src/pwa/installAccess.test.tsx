import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InstallAppAccess, InstallInvitation, PwaProvider } from './PwaProvider';
import { pwaFixture, installEvent } from '../test/pwaFixtures';
import { INSTALL_DISMISS_KEY } from './installPolicy';

function mount(f = pwaFixture({ ios: true })) {
  render(<MemoryRouter initialEntries={['/conta']}><PwaProvider controller={f.controller}>
    <InstallAppAccess /><InstallInvitation />
  </PwaProvider></MemoryRouter>);
  return f;
}
describe('acesso permanente à instalação na Conta', () => {
  it('abre instruções Safari imediatamente mesmo dispensado, sem alterar a preferência ou sessão', () => {
    const storage = new Map([[INSTALL_DISMISS_KEY, String(Date.now())], ['pereirao.install.dismissed', '1'], ['session-sentinel', 'preservada']]);
    const before = [...storage];
    const f = mount(pwaFixture({ ios: true, storage }));
    expect(screen.queryByRole('region', { name: 'Instalar PEREIRÃO' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à Tela de Início' }));
    expect(screen.getByRole('dialog', { name: 'Adicionar à Tela de Início' })).toBeVisible();
    expect(screen.getByText('Compartilhar')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect([...storage]).toEqual(before);
    act(() => { f.browser.dispatchEvent(new Event('focus')); f.browser.document.dispatchEvent(new Event('visibilitychange')); });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à Tela de Início' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.controller.dispose();
  });
  it('orienta abrir no Safari em outro navegador do iPhone', () => {
    const f = mount(pwaFixture({ ios: true, safari: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à Tela de Início' }));
    expect(screen.getByText(/Abra este mesmo endereço no Safari/)).toBeVisible();
    f.controller.dispose();
  });
  it('usa o evento nativo no mesmo toque mesmo com convite dispensado e só confirma por appinstalled', async () => {
    const f = pwaFixture();
    f.controller.dismiss();
    const event = installEvent();
    f.browser.dispatchEvent(event);
    mount(f);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar aplicativo' }));
    expect(event.prompt).toHaveBeenCalledOnce();
    await act(async () => { await event.userChoice; });
    expect(f.controller.getSnapshot().installed).toBe(false);
    expect(screen.queryByText(/aberto como aplicativo instalado/)).not.toBeInTheDocument();
    act(() => f.browser.dispatchEvent(new Event('appinstalled')));
    expect(screen.getByRole('status')).toHaveTextContent('PEREIRÃO aberto como aplicativo instalado');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it('não simula prompt sem evento e mantém orientação sem criar atalhos', () => {
    const f = mount(pwaFixture());
    fireEvent.click(screen.getByRole('button', { name: 'Instalar aplicativo' }));
    expect(screen.getByText(/não disponibilizou a instalação direta/)).toBeVisible();
    expect(screen.getByText(/Não é necessário criar outro atalho/)).toBeVisible();
    expect(f.controller.getSnapshot().installed).toBe(false);
    f.controller.dispose();
  });
  it('rejeição do prompt não é instalação e falha oferece orientação', async () => {
    const f = pwaFixture();
    const event = installEvent(vi.fn(async () => { throw new Error('unavailable'); }));
    f.browser.dispatchEvent(event);
    mount(f);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar aplicativo' }));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir a instalação');
    expect(f.controller.getSnapshot().installed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar aplicativo' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    f.controller.dispose();
  });
  it('standalone apresenta estado instalado e acompanha mudança de modo', () => {
    const f = mount(pwaFixture({ ios: true, installed: true }));
    expect(screen.getByRole('status')).toHaveTextContent('aplicativo instalado');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => { f.mode.matches = false; f.mode.dispatchEvent(new Event('change')); });
    expect(screen.getByRole('button', { name: 'Adicionar à Tela de Início' })).toBeVisible();
    f.controller.dispose();
  });
});
