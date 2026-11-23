import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfilePhotoFraming } from './ProfilePhotoFraming';
import { initialProfileCrop } from './profileCrop';
function setup(disabled=false) {
 const change=vi.fn(),ready=vi.fn(); render(<ProfilePhotoFraming src="blob:synthetic" value={initialProfileCrop} onChange={change} onReady={ready} disabled={disabled}/>);
 const image=screen.getByAltText('Prévia da nova foto principal');
 Object.defineProperties(image,{naturalWidth:{value:900},naturalHeight:{value:1600}});fireEvent.load(image);
 return {change,ready};
}
describe('prévia circular e controles de enquadramento',()=>{
 it('aguarda a imagem e oferece zoom/posição acessíveis',()=>{
  const f=setup();expect(f.ready).toHaveBeenCalledWith(true);
  fireEvent.change(screen.getByLabelText('Zoom da foto'),{target:{value:'2'}});expect(f.change).toHaveBeenCalledWith({x:.5,y:.5,zoom:2});
  fireEvent.change(screen.getByLabelText('Posição vertical'),{target:{value:'0'}});expect(f.change).toHaveBeenCalledWith({x:.5,y:0,zoom:1});
 });
 it('a prévia usa as mesmas coordenadas do recorte 9:16',()=>{
  setup();const image=screen.getByAltText('Prévia da nova foto principal');
  expect(image.style.width).toBe('100%');expect(parseFloat(image.style.top)).toBeCloseTo(-350/900*100);
  expect(screen.getByRole('group',{name:'Prévia circular do enquadramento'})).toBeVisible();
 });
 it('arraste desloca a foto e respeita o sentido do gesto',()=>{
  const f=setup();const circle=screen.getByRole('group',{name:'Prévia circular do enquadramento'});
  vi.spyOn(circle,'getBoundingClientRect').mockReturnValue({width:200} as DOMRect);
  fireEvent.pointerDown(circle,{pointerId:1,button:0,clientX:100,clientY:100});
  fireEvent.pointerMove(circle,{pointerId:1,clientX:100,clientY:120});
  expect(f.change).toHaveBeenCalledWith({x:.5,y:expect.closeTo(.5-20*900/(200*700)),zoom:1});
 });
 it('bloqueia edição durante envio para não mudar a foto confirmada',()=>{
  setup(true);expect(screen.getByLabelText('Zoom da foto')).toBeDisabled();expect(screen.getByRole('button',{name:'Redefinir enquadramento'})).toBeDisabled();
 });
});
