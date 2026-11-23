import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PresentationEditor } from './PresentationEditor';
import { PresentationIdentity } from './PresentationIdentity';
import { PresentationProvider } from './PresentationProvider';
import { emptyPresentation, linkedinUrl, validatePresentation } from './model';
import type { Presentation, PresentationRepository } from './model';
function fixture(identityAvailable=true) {
 let saved: Presentation={...emptyPresentation,headline:'Título salvo'};
 const repository: PresentationRepository={get:vi.fn(async()=>({available:true,identityAvailable,data:{...saved}})),save:vi.fn(async(_id,value)=>{saved={...value};})};
 return repository;
}
function open(repository:PresentationRepository,company=false) { return render(<MemoryRouter><PresentationProvider value={repository}><PresentationEditor businessId="synthetic-business" company={company} onSaved={vi.fn()}/></PresentationProvider></MemoryRouter>); }
describe('profissão declarada e LinkedIn',()=>{
 it('salva profissão distinta do título e recupera somente os dados salvos',async()=>{
  const repo=fixture();const view=open(repo);await waitFor(()=>expect(screen.getByLabelText('Título profissional')).toHaveValue('Título salvo'));
  fireEvent.change(screen.getByLabelText('Profissão declarada'),{target:{value:'Engenheiro'}});
  fireEvent.change(screen.getByLabelText('LinkedIn (opcional)'),{target:{value:'https://linkedin.com/in/exemplo-sintetico'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar apresentação'}));await screen.findByText(/Apresentação salva/);
  expect(repo.save).toHaveBeenCalledWith('synthetic-business',expect.objectContaining({profession:'Engenheiro',headline:'Título salvo',linkedin_url:'https://www.linkedin.com/in/exemplo-sintetico'}));
  view.unmount();open(repo);await waitFor(()=>expect(screen.getByLabelText('Profissão declarada')).toHaveValue('Engenheiro'));
 });
 it('antes da expansão desabilita apenas campos novos e mantém o título editável',async()=>{
  const repo=fixture(false);open(repo);await waitFor(()=>expect(screen.getByLabelText('Título profissional')).toHaveValue('Título salvo'));
  expect(screen.getByLabelText('Profissão declarada')).toBeDisabled();expect(screen.getByLabelText('LinkedIn (opcional)')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Título profissional'),{target:{value:'Título atualizado'}});fireEvent.click(screen.getByRole('button',{name:'Salvar apresentação'}));await screen.findByText(/Apresentação salva/);expect(repo.save).toHaveBeenCalledOnce();
 });
 it('separa atuação da empresa de profissão pessoal e nunca oferece selo verificado',async()=>{
  open(fixture(),true);await waitFor(()=>expect(screen.getByLabelText('Título da empresa')).toHaveValue('Título salvo'));
  expect(screen.getByLabelText('Atuação declarada da empresa')).toBeEnabled();expect(screen.queryByLabelText('Profissão declarada')).not.toBeInTheDocument();
  expect(screen.getByText(/não atribui profissão ou registro a uma pessoa/)).toBeVisible();
 });
 it('apresenta link seguro e declaração sem credencial automática',()=>{
  const view=render(<PresentationIdentity data={{...emptyPresentation,profession:'Engenheiro',linkedin_url:'https://linkedin.com/in/exemplo'}}/>);
  expect(screen.getByText(/Não verificada pelo PEREIRÃO/)).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href','https://www.linkedin.com/in/exemplo');expect(screen.getByRole('link')).toHaveAttribute('rel','noopener noreferrer');
  view.rerender(<PresentationIdentity data={{...emptyPresentation,linkedin_url:'javascript:alert(1)'}}/>);expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
 it.each(['javascript:alert(1)','http://linkedin.com/in/exemplo','https://linkedin.com.evil.test/in/x','https://u:p@linkedin.com/in/x','https://www.linkedin.com/in/x?url=evil','https://www.linkedin.com/in/x#dados','https://www.linkedin.com/in/x?','https://www.linkedin.com/feed/','https://www.linkedin.com:444/in/x','https://www.linkedin.com/in/x%2Fy'])('rejeita endereço não permitido: %s',url=>{expect(linkedinUrl(url)).toBeNull();expect(validatePresentation({...emptyPresentation,linkedin_url:url})).not.toBe('');});
});
