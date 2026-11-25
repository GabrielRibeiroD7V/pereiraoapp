import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

export function PhotoCarousel({items,label='Fotografias da publicação'}:{items:{id:string;content:ReactNode}[];label?:string}){
 const track=useRef<HTMLDivElement>(null),[active,setActive]=useState(0),gesture=useRef<{x:number;y:number;swiped:boolean}|null>(null);
 const count=items.length,index=Math.min(active,Math.max(0,count-1)),ids=items.map(i=>i.id).join(':');
 const position=useRef(index);position.current=index;
 function move(next:number){const value=Math.max(0,Math.min(count-1,next));setActive(value);track.current?.scrollTo?.({left:value*track.current.clientWidth,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 useEffect(()=>{setActive(0);track.current?.scrollTo?.({left:0,behavior:'auto'});},[ids]);
 useEffect(()=>{const element=track.current;if(!element||!window.ResizeObserver)return;const observer=new ResizeObserver(()=>element.scrollTo?.({left:position.current*element.clientWidth,behavior:'auto'}));observer.observe(element);return()=>observer.disconnect();},[]);
 if(!count)return <p>Esta publicação ainda não tem fotos.</p>;
 return <section className="photo-carousel" aria-label={label} aria-roledescription="carrossel">
  {count>1&&<span className="photo-carousel__position" aria-hidden="true">{index+1} / {count}</span>}
  <div className="photo-carousel__track" ref={track} tabIndex={count>1?0:-1} aria-label="Fotos; deslize para os lados ou use as setas do teclado"
   onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(index+(e.key==='ArrowRight'?1:-1));}}}
   onPointerDown={e=>{gesture.current={x:e.clientX,y:e.clientY,swiped:false};}}
   onPointerMove={e=>{const g=gesture.current;if(g&&Math.abs(e.clientX-g.x)>10&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y))g.swiped=true;}}
   onClickCapture={e=>{if(gesture.current?.swiped){e.preventDefault();e.stopPropagation();gesture.current=null;}}}
   onScroll={e=>{const el=e.currentTarget;if(el.clientWidth)setActive(Math.min(count-1,Math.max(0,Math.round(el.scrollLeft/el.clientWidth))));}}>
   {items.map((item,i)=><figure className="photo-carousel__slide" key={item.id} aria-label={`Foto ${i+1} de ${count}`}>
    {item.content}<figcaption className="visually-hidden">Foto {i+1} de {count}</figcaption>
   </figure>)}
  </div>
  {count>1&&<div className="photo-carousel__controls">
   <button type="button" aria-label="Foto anterior" disabled={index===0} onClick={()=>move(index-1)}><ChevronLeft size={18} aria-hidden="true"/></button>
   <div className="photo-carousel__dots" role="group" aria-label="Escolher foto">{items.map((item,i)=><button type="button" key={item.id} aria-label={`Ir para foto ${i+1} de ${count}`} aria-current={i===index?'true':undefined} onClick={()=>move(i)}><span/></button>)}</div>
   <span className="visually-hidden" aria-live="polite">{index+1} / {count}</span>
   <button type="button" aria-label="Próxima foto" disabled={index===count-1} onClick={()=>move(index+1)}><ChevronRight size={18} aria-hidden="true"/></button>
  </div>}
 </section>;
}
