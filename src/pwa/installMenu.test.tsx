import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { InstallAppAccess, PwaProvider } from './PwaProvider';
import { pwaFixture, installEvent } from '../test/pwaFixtures';

function mount(f = pwaFixture({ ios: true })) {
  render(<MemoryRouter initialEntries={['/conta']}><PwaProvider controller={f.controller}><details open><summary>Opções da conta</summary><nav><InstallAppAccess menu /></nav></details></PwaProvider></MemoryRouter>);
  return f;
}
describe('instalação diretamente no menu da Conta', () => {
  it('um único toque abre Compartilhar → Adicionar à Tela de Início no Safari, mesmo dispensado', () => {
    const f = pwaFixture({ ios: true });
    f.controller.dismiss();
    const before = [...f.storage];
    mount(f);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicativo PEREIRÃO' }));
    expect(screen.getByRole('dialog', { name: 'Adicionar à Tela de Início' })).toBeVisible();
    expect(screen.getByRole('dialog').closest('nav')).toBeNull();
    expect(screen.getByText('Compartilhar')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect([...f.storage]).toEqual(before);
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.controller.dispose();
  });
  it('o mesmo item usa prompt nativo diretamente, sem navegação intermediária', async () => {
    const f = pwaFixture(); const event = installEvent();
    f.browser.dispatchEvent(event); mount(f);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicativo PEREIRÃO' }));
    expect(event.prompt).toHaveBeenCalledOnce();
    await act(async () => { await event.userChoice; });
    expect(f.controller.getSnapshot().installed).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    f.controller.dispose();
  });
  it('mostra o estado instalado no menu sem solicitar reinstalação', () => {
    const f = mount(pwaFixture({ ios: true, installed: true }));
    expect(screen.getByRole('status')).toHaveTextContent('aplicativo instalado');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    f.controller.dispose();
  });
});
