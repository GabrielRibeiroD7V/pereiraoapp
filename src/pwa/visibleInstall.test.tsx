import {App} from '../app/App';
import {createWorkFixtures} from '../test/workFixtures';
import {fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,it} from 'vitest';
import {HomePage} from '../pages/HomePage';
import {PwaProvider} from './PwaProvider';
import {pwaFixture} from '../test/pwaFixtures';
import {INSTALL_DISMISS_KEY} from './installPolicy';
it('Home oferece orientação imediatamente mesmo com convite dispensado, sem modal automático',()=>{const f=pwaFixture({ios:true,storage:new Map([[INSTALL_DISMISS_KEY,String(Date.now())]])});render(<MemoryRouter><PwaProvider controller={f.controller}><HomePage/></PwaProvider></MemoryRouter>);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Adicionar à Tela de Início'}));expect(screen.getByRole('dialog',{name:'Adicionar à Tela de Início'})).toBeVisible();expect(screen.getByText('Compartilhar')).toBeVisible();f.controller.dispose();});

it('Conta autenticada oferece orientação inline logo após carregar a sessão',async()=>{const f=pwaFixture({ios:true}),work=createWorkFixtures();render(<MemoryRouter initialEntries={['/conta']}><PwaProvider controller={f.controller}><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work}/></PwaProvider></MemoryRouter>);expect(await screen.findByRole('button',{name:'Adicionar à Tela de Início'})).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Adicionar à Tela de Início'}));expect(screen.getByRole('dialog',{name:'Adicionar à Tela de Início'})).toBeVisible();f.controller.dispose();});
