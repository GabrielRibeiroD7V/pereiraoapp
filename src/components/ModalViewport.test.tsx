import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Modal} from './Modal';
afterEach(()=>vi.unstubAllGlobals());
it('acompanha viewport visual e mantém fechar e conteúdo alcançáveis com teclado simulado',()=>{
 const viewport=Object.assign(new EventTarget(),{width:320,height:620,offsetTop:0,offsetLeft:0});vi.stubGlobal('visualViewport',viewport);
 const close=vi.fn(),view=render(<Modal title="Menu de teste" onClose={close}><button>Adicionar publicação</button></Modal>);
 const dialog=screen.getByRole('dialog');expect(dialog.style.getPropertyValue('--visual-width')).toBe('320px');
 act(()=>{viewport.height=280;viewport.offsetTop=100;viewport.dispatchEvent(new Event('resize'));});
 expect(dialog.style.getPropertyValue('--visual-height')).toBe('280px');expect(dialog.style.getPropertyValue('--visual-top')).toBe('100px');
 expect(screen.getByRole('button',{name:'Adicionar publicação'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Fechar'}));expect(close).toHaveBeenCalledOnce();view.unmount();
});
