import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {HomeBannerCarousel} from './HomeBannerCarousel';
const originalPointer=window.PointerEvent;
let reduced=false;
const add=vi.fn(),remove=vi.fn();
beforeEach(()=>{vi.useFakeTimers();window.PointerEvent=MouseEvent as typeof PointerEvent;vi.stubGlobal('matchMedia',vi.fn(()=>({matches:reduced,addEventListener:add,removeEventListener:remove})));});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();window.PointerEvent=originalPointer;reduced=false;});
function Route(){const location=useLocation();return <output aria-label="Destino">{location.pathname}</output>;}
function open(){render(<MemoryRouter><HomeBannerCarousel/><Route/></MemoryRouter>);const track=document.querySelector('.home-banners__track') as HTMLDivElement;Object.defineProperty(track,'clientWidth',{value:300});track.scrollTo=vi.fn();document.querySelectorAll('.home-banners img').forEach(img=>fireEvent.load(img));return track;}
it('uses the whole original image as a public-search link and reserves its dimensions',()=>{
 open();const link=screen.getByRole('link',{name:/O profissional que você precisa/});expect(link).toHaveAttribute('href','/buscar');
 const image=link.querySelector('img')!;expect(image).toHaveAttribute('width','2172');expect(image).toHaveAttribute('height','724');expect(image).toHaveAttribute('fetchpriority','high');
 expect(document.querySelectorAll('img[loading=eager]')).toHaveLength(2);
 fireEvent.click(link);expect(screen.getByLabelText('Destino')).toHaveTextContent('/buscar');
});
it('advances at six seconds, wraps, and cancels timers/listeners when unmounted',()=>{
 const track=open();act(()=>vi.advanceTimersByTime(5999));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
 act(()=>vi.advanceTimersByTime(1));expect(screen.getByRole('button',{name:/Mostrar banner 2/})).toHaveAttribute('aria-current','true');expect(track.scrollTo).toHaveBeenLastCalledWith({left:300,behavior:'smooth'});
 act(()=>vi.advanceTimersByTime(6000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');cleanup();expect(vi.getTimerCount()).toBe(0);expect(remove).toHaveBeenCalledWith('change',expect.any(Function));
});
it('pauses while interacting and restarts the full interval after release',()=>{
 const track=open();fireEvent.pointerDown(track,{clientX:250,clientY:30});act(()=>vi.advanceTimersByTime(20000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
 fireEvent.pointerUp(track);act(()=>vi.advanceTimersByTime(5999));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');act(()=>vi.advanceTimersByTime(1));expect(screen.getByRole('button',{name:/Mostrar banner 2/})).toHaveAttribute('aria-current','true');
});
it('suppresses a swipe click and permits the next deliberate tap',()=>{
 const track=open(),link=screen.getByRole('link',{name:/O profissional que você precisa/});
 fireEvent.pointerDown(track,{clientX:250,clientY:30});fireEvent.pointerMove(track,{clientX:70,clientY:35});fireEvent.pointerUp(track);fireEvent.click(link);expect(screen.getByLabelText('Destino')).toHaveTextContent('/');
 fireEvent.pointerDown(track,{clientX:150,clientY:30});fireEvent.pointerUp(track);fireEvent.click(link);expect(screen.getByLabelText('Destino')).toHaveTextContent('/buscar');
});
it('reflects native scrolling in either direction and offers keyboard/dot navigation',()=>{
 const track=open();track.scrollLeft=300;fireEvent.scroll(track);expect(screen.getByRole('button',{name:/Mostrar banner 2/})).toHaveAttribute('aria-current','true');track.scrollLeft=0;fireEvent.scroll(track);expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
 fireEvent.keyDown(track,{key:'ArrowRight'});expect(screen.getByRole('link',{name:/Profissional, divulgue/})).toHaveFocus();fireEvent.click(screen.getByRole('button',{name:/Mostrar banner 1/}));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
});
it('disables automatic movement with reduced motion while preserving manual access',()=>{
 reduced=true;const track=open();act(()=>vi.advanceTimersByTime(30000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');fireEvent.click(screen.getByRole('button',{name:/Mostrar banner 2/}));expect(track.scrollTo).toHaveBeenLastCalledWith({left:300,behavior:'auto'});expect(screen.getByRole('link',{name:/Profissional, divulgue/})).toHaveAttribute('href','/conta/profissional');
});
it('pauses in background and while keyboard focus remains in the carousel',()=>{
 open();Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});fireEvent(document,new Event('visibilitychange'));act(()=>vi.advanceTimersByTime(12000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});fireEvent(document,new Event('visibilitychange'));fireEvent.focus(screen.getByRole('button',{name:/Mostrar banner 1/}));act(()=>vi.advanceTimersByTime(12000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
});

it('keeps paused after native pointercancel until the finger is actually released',()=>{
 const track=open();fireEvent.touchStart(track,{touches:[{clientX:250,clientY:30}]});fireEvent.pointerDown(track,{clientX:250,clientY:30});fireEvent.pointerCancel(track);act(()=>vi.advanceTimersByTime(12000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');
 fireEvent.touchEnd(track,{touches:[]});act(()=>vi.advanceTimersByTime(6000));expect(screen.getByRole('button',{name:/Mostrar banner 2/})).toHaveAttribute('aria-current','true');
});

it('waits for both images before starting automatic rotation on a slow connection',()=>{
 render(<MemoryRouter><HomeBannerCarousel/></MemoryRouter>);const imgs=document.querySelectorAll('.home-banners img');fireEvent.load(imgs[0]!);act(()=>vi.advanceTimersByTime(12000));expect(screen.getByRole('button',{name:/Mostrar banner 1/})).toHaveAttribute('aria-current','true');fireEvent.load(imgs[1]!);act(()=>vi.advanceTimersByTime(6000));expect(screen.getByRole('button',{name:/Mostrar banner 2/})).toHaveAttribute('aria-current','true');
});
