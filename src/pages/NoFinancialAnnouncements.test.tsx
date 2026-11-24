import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect, it, vi} from 'vitest';
import {App} from '../app/App';
import {createWorkFixtures, fixtureBusinessId} from '../test/workFixtures';
import {postsFixtures} from '../test/postsFixtures';

const financialCopy = /fase inicial gratuita|90 dias|assinatura futura|sem cobrança|não há cobrança|cobrança automática|assinatura do PEREIRÃO|não inicia gratuidade/i;
it.each([
  ['/', 'O que você está procurando?', true],
  ['/criar-conta', 'Criar conta', true],
  ['/conta', 'Meu perfil', false],
  ['/conta/profissional/cadastro', 'Anunciar meus serviços', false],
  [`/conta/profissional/${fixtureBusinessId}/editar`, 'Editar perfil profissional', false],
  [`/conta/profissional/${fixtureBusinessId}/previa`, 'Negócio de demonstração local', false],
] as const)('não anuncia condições financeiras em %s', async (path, title, visitor) => {
  const f = createWorkFixtures(false, visitor);
  const accessStatus = vi.fn(async () => ({phase:'initial_free' as const,effectiveAt:'2026-11-24T16:30:00Z',trialClockRunning:false as const,checkoutAvailable:false as const,enforcementEnabled:false as const,automaticConversion:false as const}));
  render(<MemoryRouter initialEntries={[path]}><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} managedPosts={postsFixtures('draft', true).managed} subscriptionRepository={{accessStatus,list:async()=>({items:[],hasNext:false})}} /></MemoryRouter>);
  await waitFor(()=>expect(screen.queryByText(/Carregando página|Verificando sua sessão|Carregando seu perfil/)).not.toBeInTheDocument());
  await screen.findByRole('heading', {name:title});
  expect(document.querySelector('main')).not.toHaveTextContent(financialCopy);
  expect(document.querySelector('.account-page > .form-notice[aria-label="Fase inicial gratuita"]')).toBeNull();
  expect(screen.queryByRole('link',{name:'Gratuidade e assinatura'})).not.toBeInTheDocument();
  expect(accessStatus).not.toHaveBeenCalled();
  if(path==='/conta') {
    const toolbar=document.querySelector('.owner-toolbar')!;
    expect(toolbar.nextElementSibling).toHaveClass('owner-account-name');
    expect(await screen.findByRole('heading',{name:'Negócio de demonstração local'})).toBeInTheDocument();
  }
});
