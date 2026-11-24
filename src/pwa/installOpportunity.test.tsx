import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Link } from 'react-router-dom';
import { InstallInvitation, PwaProvider } from './PwaProvider';
import { pwaFixture, installEvent } from '../test/pwaFixtures';
import { INSTALL_COOLDOWN_MS, INSTALL_DELAY_MS, INSTALL_DISMISS_KEY, installDismissed } from './installPolicy';

afterEach(() => vi.useRealTimers());
function mount(path = '/', ios = false) {
  vi.useFakeTimers();
  const f = pwaFixture({ ios });
  if (!ios) f.browser.dispatchEvent(installEvent());
  render(<MemoryRouter initialEntries={[path]}><PwaProvider controller={f.controller}>
    <Link to="/conta">Conta privada</Link><Link to="/buscar">Busca pública</Link>
    <main><button>Ação importante</button><label>Pesquisa<input /></label></main><InstallInvitation />
  </PwaProvider></MemoryRouter>);
  return f;
}
const invitation = () => screen.queryByRole('region', { name: 'Instalar PEREIRÃO' });
describe('convite contextual de instalação', () => {
  it('aguarda 45 segundos e interação, sem aparecer imediatamente na primeira visita', () => {
    const f = mount();
    expect(invitation()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS));
    expect(invitation()).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(invitation()).toBeVisible();
    expect(f.controller.getSnapshot().installed).toBe(false);
    f.controller.dispose();
  });
  it('preserva o atraso mesmo quando há interação imediata e oculta durante edição', () => {
    const f = mount();
    fireEvent.pointerDown(document.body);
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS - 1));
    expect(invitation()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(invitation()).toBeVisible();
    act(() => screen.getByLabelText('Pesquisa').focus());
    expect(invitation()).not.toBeInTheDocument();
    act(() => screen.getByLabelText('Pesquisa').blur());
    expect(invitation()).toBeVisible();
    act(() => screen.getByRole('button', { name: 'Ação importante' }).focus());
    expect(invitation()).not.toBeInTheDocument();
    act(()=>vi.advanceTimersByTime(3001));
    expect(invitation()).toBeVisible();
    f.controller.dispose();
  });
  it('oferece também na Conta autenticada, mas não em cadastro ou edição', () => {
    const f = mount('/conta', true);
    fireEvent.pointerDown(document.body);
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS));
    expect(invitation()).toBeVisible();
    f.controller.dispose();
  });
  it('aplica dispensa por 14 dias entre sessões e tolera valores inválidos', () => {
    const now = Date.now();
    const preference = (value: string | null) => ({ getItem: () => value });
    expect(installDismissed(preference(String(now - 1000)), now)).toBe(true);
    expect(installDismissed(preference(String(now - INSTALL_COOLDOWN_MS)), now)).toBe(false);
    expect(installDismissed(preference(null), now)).toBe(false);
    expect(installDismissed(preference('inválido'), now)).toBe(false);
    expect(installDismissed(preference(String(now + 1000)), now)).toBe(false);
    const f = mount('/', true);
    fireEvent.pointerDown(document.body);
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar convite de instalação' }));
    expect(f.storage.get(INSTALL_DISMISS_KEY)).toBe(String(Date.now()));
    expect(invitation()).not.toBeInTheDocument();
    f.controller.dispose();
  });
});
