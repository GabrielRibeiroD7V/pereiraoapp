import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {OwnerPublication} from './OwnerPublication';
import {createWorkFixtures,fixtureBusinessId} from '../test/workFixtures';
function open(f=createWorkFixtures()){const business={id:fixtureBusinessId,name:'Fixture',status:'draft'};const publication=vi.fn(async()=>{});f.professional.publication=publication;const changed=vi.fn();render(<MemoryRouter><OwnerPublication business={business as never} repository={f.professional} onChanged={changed}/></MemoryRouter>);return {publication,changed};}
describe('owner publication decisions',()=>{
 it('requires explicit confirmation and keeps draft posts separate',async()=>{const f=open();fireEvent.click(screen.getByRole('button',{name:'Publicar meu perfil'}));expect(screen.getByText(/Seus posts em rascunho continuam privados/)).toBeVisible();expect(f.publication).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(f.publication).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Publicar meu perfil'}));fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));await waitFor(()=>expect(f.changed).toHaveBeenCalledOnce());expect(f.publication).toHaveBeenCalledWith(fixtureBusinessId,'publish','draft');});
 it('email refusal preserves the decision and profile',async()=>{const f=open();f.publication.mockRejectedValueOnce({code:'42501',message:'EMAIL_CONFIRMATION_REQUIRED'});fireEvent.click(screen.getByRole('button',{name:'Publicar meu perfil'}));fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));expect(await screen.findByRole('alert')).toHaveTextContent('Confirme seu e-mail');expect(f.changed).not.toHaveBeenCalled();});
});
