import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../app/routes';

export const homeBanners = [
  {id:'find',src:'/images/banners/encontrar-profissionais.webp',to:routes.search,alt:'O profissional que você precisa está aqui. Encontre serviços na sua região.'},
  {id:'offer',src:'/images/banners/divulgar-negocio.webp',to:'/conta/profissional',alt:'Profissional, divulgue seu trabalho. Cadastrar meu negócio.'},
] as const;

export function HomeBannerCarousel() {
  const track=useRef<HTMLDivElement>(null),position=useRef(0);
  const gesture=useRef<{x:number;y:number;scroll:number;mouse:boolean}|null>(null),swiped=useRef(false);
  const [active,setActive]=useState(0),[interacting,setInteracting]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const [visible,setVisible]=useState(()=>document.visibilityState!=='hidden');
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  const move=useCallback((next:number)=>{
    const index=(next+homeBanners.length)%homeBanners.length;
    position.current=index;setActive(index);
    track.current?.scrollTo?.({left:index*track.current.clientWidth,behavior:reduced?'auto':'smooth'});
  },[reduced]);
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion=()=>setReduced(media?.matches??false),visibility=()=>setVisible(document.visibilityState!=='hidden');
    media?.addEventListener?.('change',motion);document.addEventListener('visibilitychange',visibility);
    return()=>{media?.removeEventListener?.('change',motion);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{
    if(reduced||interacting||hovered||focused||!visible)return;
    const timer=window.setTimeout(()=>move(position.current+1),6000);
    return()=>window.clearTimeout(timer);
  },[active,reduced,interacting,hovered,focused,visible,move]);
  useEffect(()=>{
    const element=track.current;if(!element||!window.ResizeObserver)return;
    const observer=new ResizeObserver(()=>element.scrollTo?.({left:position.current*element.clientWidth,behavior:'auto'}));
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  function endGesture(){gesture.current=null;setInteracting(false);}
  return <section className="home-banners" aria-label="Destaques do PEREIRÃO" aria-roledescription="carrossel"
    onPointerEnter={e=>{if(e.pointerType==='mouse')setHovered(true);}}
    onPointerLeave={e=>{if(e.pointerType==='mouse'){setHovered(false);if(!e.currentTarget.hasPointerCapture?.(e.pointerId))endGesture();}}}
    onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false);}}>
    <div className="home-banners__track" ref={track} data-interacting={interacting||undefined}
      onKeyDown={e=>{swiped.current=false;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(position.current+(e.key==='ArrowRight'?1:-1)+homeBanners.length)%homeBanners.length;move(next);(e.currentTarget.children[next] as HTMLElement)?.focus();}}}
      onPointerDown={e=>{swiped.current=false;gesture.current={x:e.clientX,y:e.clientY,scroll:e.currentTarget.scrollLeft,mouse:e.pointerType==='mouse'};setInteracting(true);}}
      onPointerMove={e=>{const g=gesture.current;if(!g)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.abs(dx)>10||Math.abs(dy)>10)swiped.current=true;
        if(g.mouse&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){e.currentTarget.setPointerCapture?.(e.pointerId);e.currentTarget.scrollLeft=g.scroll-dx;e.preventDefault();}}}
      onPointerUp={endGesture} onPointerCancel={()=>{swiped.current=true;endGesture();}}
      onLostPointerCapture={endGesture}
      onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false;}}}
      onScroll={e=>{const element=e.currentTarget;if(gesture.current&&Math.abs(element.scrollLeft-gesture.current.scroll)>10)swiped.current=true;
        if(element.clientWidth){const next=Math.max(0,Math.min(homeBanners.length-1,Math.round(element.scrollLeft/element.clientWidth)));position.current=next;setActive(next);}}}>
      {homeBanners.map((banner,index)=><Link className="home-banners__slide" key={banner.id} to={banner.to} tabIndex={index===active?0:-1} aria-hidden={index!==active||undefined} draggable={false}>
        <img src={banner.src} alt={banner.alt} width={2172} height={724} loading="eager" fetchPriority={index===0?'high':'low'} decoding="async" draggable={false}/>
      </Link>)}
    </div>
    <div className="home-banners__indicators" role="group" aria-label="Escolher banner">
      {homeBanners.map((banner,index)=><button key={banner.id} type="button" aria-label={`Mostrar banner ${index+1}: ${index===0?'Encontrar profissionais':'Divulgar meu trabalho'}`} aria-current={index===active?'true':undefined} onClick={()=>{swiped.current=false;move(index);}}><span/></button>)}
    </div>
  </section>;
}
