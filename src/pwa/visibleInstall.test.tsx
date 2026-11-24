import {act, fireEvent, render, screen, cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import {InstallInvitation, InstallAppAccess, PwaProvider} from './PwaProvider';
import {pwaFixture, installEvent} from '../test/pwaFixtures';
import {INSTALL_DELAY_MS, INSTALL_SEEN_KEY, INSTALL_COOLDOWN_MS} from './installPolicy';
afterEach(()=>vi.useRealTimers());
function mount(path='/', storage=new Map<string,string>()) {
 vi.useFakeTimers(); const f=pwaFixture({ios:true,storage});
 render(<MemoryRouter initialEntries={[path]}><PwaProvider controller={f.controller}><InstallInvitation/><InstallAppAccess menu/></PwaProvider></MemoryRouter>);
 fireEvent.pointerDown(document.body);act(()=>vi.advanceTimersByTime(INSTALL_DELAY_MS));return f;
}
const invitation=()=>screen.queryByRole('region',{name:'Instalar PEREIRÃO'});
it('limita exposição a uma vez a cada 14 dias sem impedir o acesso manual',()=>{
 const storage=new Map<string,string>();let f=mount('/',storage);expect(invitation()).toBeVisible();expect(storage.has(INSTALL_SEEN_KEY)).toBe(true);f.controller.dispose();cleanup();
 f=mount('/conta',storage);expect(invitation()).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Aplicativo PEREIRÃO'}));expect(screen.getByRole('dialog')).toBeVisible();f.controller.dispose();
});
it('volta a oferecer depois de 14 dias, sem modal automático',()=>{
 const f=mount('/conta',new Map([[INSTALL_SEEN_KEY,String(Date.now()-INSTALL_COOLDOWN_MS)]]));expect(invitation()).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Como adicionar no iPhone'}));expect(screen.getByRole('dialog')).toBeVisible();f.controller.dispose();
});
it.each(['/entrar','/criar-conta','/conta/profissional/cadastro','/admin','/mensagens'])('não cobre o fluxo %s',path=>{const f=mount(path);expect(invitation()).not.toBeInTheDocument();f.controller.dispose();});
it('oculta convite quando um modal está aberto e quando fica instalado',async()=>{
 const f=mount('/conta');expect(invitation()).toBeVisible();const form=document.createElement('div');form.setAttribute('role','dialog');await act(async()=>document.body.append(form));expect(invitation()).not.toBeInTheDocument();await act(async()=>form.remove());expect(invitation()).toBeVisible();act(()=>f.browser.dispatchEvent(new Event('appinstalled')));expect(invitation()).not.toBeInTheDocument();f.controller.dispose();
});
it('aciona prompt nativo somente pelo toque; aceitar não significa instalado',async()=>{
 vi.useFakeTimers();const f=pwaFixture();const event=installEvent();f.browser.dispatchEvent(event);render(<MemoryRouter><PwaProvider controller={f.controller}><InstallInvitation/></PwaProvider></MemoryRouter>);fireEvent.pointerDown(document.body);act(()=>vi.advanceTimersByTime(INSTALL_DELAY_MS));expect(event.prompt).not.toHaveBeenCalled();await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Instalar PEREIRÃO'})));expect(event.prompt).toHaveBeenCalledOnce();expect(f.controller.getSnapshot().installed).toBe(false);f.controller.dispose();
});

it('sem armazenamento disponível não insiste, mas preserva instrução manual',()=>{
 vi.useFakeTimers();const f=pwaFixture({ios:true});vi.spyOn(f.browser.localStorage,'setItem').mockImplementation(()=>{throw new Error('blocked');});render(<MemoryRouter><PwaProvider controller={f.controller}><InstallInvitation/><InstallAppAccess menu/></PwaProvider></MemoryRouter>);fireEvent.pointerDown(document.body);act(()=>vi.advanceTimersByTime(INSTALL_DELAY_MS));expect(invitation()).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Aplicativo PEREIRÃO'}));expect(screen.getByRole('dialog')).toBeVisible();f.controller.dispose();
});
it('modo instalado não exibe convite mesmo depois de esperar e interagir',()=>{
 vi.useFakeTimers();const f=pwaFixture({ios:true,installed:true});render(<MemoryRouter><PwaProvider controller={f.controller}><InstallInvitation/><InstallAppAccess menu/></PwaProvider></MemoryRouter>);fireEvent.pointerDown(document.body);act(()=>vi.advanceTimersByTime(INSTALL_DELAY_MS));expect(invitation()).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent(/instalado/i);f.controller.dispose();
});
