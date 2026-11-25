import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Link } from 'react-router-dom';
import { InstallInvitation, PwaProvider } from './PwaProvider';
import { pwaFixture, installEvent } from '../test/pwaFixtures';
import { INSTALL_DELAY_MS } from './installPolicy';

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
  it('aparece automaticamente poucos segundos após a entrada', () => {
    const f = mount();
    expect(invitation()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS));
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
  it('dispensa somente a visita atual e não grava bloqueio longo', () => {
    const f = mount('/', true);
    fireEvent.pointerDown(document.body);
    act(() => vi.advanceTimersByTime(INSTALL_DELAY_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar convite de instalação' }));
    expect(f.storage.size).toBe(0);
    expect(invitation()).not.toBeInTheDocument();
    f.controller.dispose();
  });
});
