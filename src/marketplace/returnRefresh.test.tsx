import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useCallback,useState} from 'react';
import {it,expect,vi} from 'vitest';
import {usePublicQuery} from './usePublicQuery';
function Content(){const[tab,setTab]=useState('Publicações');return <><button onClick={()=>setTab('Fotos')}>Trocar seção</button><output>{tab}</output></>;}
it('mantém a seção pública montada durante a revalidação ao voltar à aba',async()=>{
 let resolve!:(v:{name:string})=>void;
 const fetcher=vi.fn().mockResolvedValueOnce({name:'Perfil'}).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 function Page(){const load=useCallback(()=>fetcher(),[]),state=usePublicQuery('public:profile',load,true);return state.data?<Content/>:<p>Carregando perfil</p>;}
 render(<Page/>);fireEvent.click(await screen.findByRole('button',{name:'Trocar seção'}));expect(screen.getByText('Fotos')).toBeInTheDocument();
 act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 expect(screen.getByText('Fotos')).toBeInTheDocument();
 await act(async()=>resolve({name:'Perfil'}));expect(screen.getByText('Fotos')).toBeInTheDocument();
});
it('não reutiliza o resultado anterior quando a identidade da consulta muda',async()=>{
 function Page({id}:{id:string}){const load=useCallback(()=>id==='a'?Promise.resolve('Perfil A'):new Promise<string>(()=>{}),[id]),q=usePublicQuery(id,load,true);return <p>{q.data??'Carregando'}</p>;}
 const view=render(<Page id="a"/>);await screen.findByText('Perfil A');view.rerender(<Page id="b"/>);expect(screen.queryByText('Perfil A')).not.toBeInTheDocument();
});
