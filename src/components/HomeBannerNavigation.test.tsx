import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import {App} from '../app/App';
import {createWorkFixtures,fixtureBusinessId} from '../test/workFixtures';
import {marketplaceFixture} from '../test/marketplaceFixtures';
import type {AuthListener,AuthSession} from '../auth/types';
import type {BusinessRow} from '../lib/database.types';
import {writeCheckpoint} from '../professional/checkpoint';
function Route(){const l=useLocation();return <output aria-label="Destino do banner">{l.pathname}{l.search}</output>;}
beforeEach(()=>sessionStorage.clear());
function setup(authenticated=false,status:'draft'|'published'|null=null){
 const f=createWorkFixtures();let current:AuthSession|null=authenticated?{user:{id:'local-user',email:'local@example.invalid',displayName:'Somente teste local'}}:null;
 let listener:AuthListener|null=null;const session={user:{id:'local-user',email:'local@example.invalid',displayName:'Somente teste local'}};
 const gateway={...f.gateway,getSession:async()=>current,subscribe:(fn:AuthListener)=>{listener=fn;return()=>{listener=null;};},signIn:vi.fn(async()=>{current=session;listener?.(session);}),signUp:vi.fn(async()=>{current=session;listener?.(session);return{confirmationRequired:false};})};
 const original=f.professional.getEditable;
 const business={id:fixtureBusinessId,name:'Negócio de demonstração local',status:status??'draft'};
 f.professional.listMine=vi.fn(async()=>status?[{...(await original(fixtureBusinessId)).business,status}]:[]);
 f.professional.createDraft=vi.fn();f.professional.saveDraft=vi.fn();
 render(<MemoryRouter><App authGateway={gateway} professionalRepository={f.professional} workRepository={f.work} marketplaceRepository={marketplaceFixture()}/><Route/></MemoryRouter>);
 return {...f,gateway,business};
}
function second(){fireEvent.click(screen.getByRole('button',{name:/Mostrar banner 2/}));fireEvent.click(screen.getByRole('link',{name:/Profissional, divulgue seu trabalho/}));}
function credentials(){fireEvent.change(screen.getByLabelText('E-mail'),{target:{value:'local@example.invalid'}});fireEvent.change(screen.getByLabelText('Senha',{exact:true}),{target:{value:'somente-teste-123'}});}
it('opens public search without requiring authentication',async()=>{const f=setup();fireEvent.click(screen.getByRole('link',{name:/O profissional que você precisa/}));expect(await screen.findByRole('heading',{name:'Buscar' })).toBeVisible();expect(f.gateway.signIn).not.toHaveBeenCalled();});
it('preserves the business destination through login and opens the existing first-registration form',async()=>{
 const f=setup();second();expect(await screen.findByRole('heading',{name:'Entrar'})).toBeVisible();expect(screen.getByLabelText('Destino do banner')).toHaveTextContent('/entrar?next=%2Fconta%2Fprofissional');
 credentials();fireEvent.click(screen.getByRole('button',{name:'Entrar'}));await screen.findByRole('radio',{name:'Empresa'});expect(screen.getByLabelText('Destino do banner')).toHaveTextContent('/conta/profissional/cadastro');expect(f.professional.createDraft).not.toHaveBeenCalled();
});
it('preserves the same destination when creating an account',async()=>{
 const f=setup();second();fireEvent.click(await screen.findByRole('link',{name:'Criar conta'}));expect(screen.getByLabelText('Destino do banner')).toHaveTextContent('/criar-conta?next=%2Fconta%2Fprofissional');
 fireEvent.change(screen.getByLabelText('Seu nome'),{target:{value:'Somente teste local'}});credentials();fireEvent.click(screen.getByRole('button',{name:'Criar conta'}));await screen.findByRole('radio',{name:'Empresa'});
 expect(f.gateway.signUp).toHaveBeenCalledWith('local@example.invalid','somente-teste-123','Somente teste local','/conta/profissional');expect(f.professional.createDraft).not.toHaveBeenCalled();
});
it('an authenticated person without a business goes straight to the existing form',async()=>{const f=setup(true);second();await screen.findByRole('radio',{name:'Empresa'});expect(f.professional.createDraft).not.toHaveBeenCalled();});
it.each(['draft','published'] as const)('opens the existing %s business without creating or saving anything',async status=>{const f=setup(true,status);second();await waitFor(()=>expect(screen.getByLabelText('Destino do banner')).toHaveTextContent(`/conta/profissional/${fixtureBusinessId}/perfil`));expect(await screen.findByRole('link',{name:'Editar perfil'})).toHaveAttribute('href',`/conta/profissional/${fixtureBusinessId}/editar`);expect(f.professional.createDraft).not.toHaveBeenCalled();expect(f.professional.saveDraft).not.toHaveBeenCalled();});
it('resumes the remembered draft instead of choosing a different business',async()=>{
 const f=setup(true,'draft');const original=await f.professional.getEditable(fixtureBusinessId),otherId='00000000-0000-4000-8000-000000000002';
 f.professional.listMine=vi.fn(async()=>[{...original.business,id:otherId},original.business] as BusinessRow[]);
 writeCheckpoint('local-user',{slug:'local-only',businessId:fixtureBusinessId});second();await waitFor(()=>expect(screen.getByLabelText('Destino do banner')).toHaveTextContent(`/conta/profissional/${fixtureBusinessId}/perfil`));expect(f.professional.createDraft).not.toHaveBeenCalled();
});
