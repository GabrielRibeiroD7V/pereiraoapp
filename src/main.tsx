import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import './styles/main.scss';
import {PwaController}from'./pwa/controller';
import {PwaProvider,PwaGate}from'./pwa/PwaProvider';

const pwa=new PwaController(window,navigator,import.meta.env.PROD);
pwa.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PwaProvider controller={pwa}><PwaGate><App /></PwaGate></PwaProvider>
    </BrowserRouter>
  </StrictMode>,
);
