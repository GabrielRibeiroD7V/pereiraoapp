import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import './styles/main.scss';
import {PwaController}from'./pwa/controller';
import {PwaProvider,PwaGate}from'./pwa/PwaProvider';
import {RestoreLastPage} from './pwa/RestoreLastPage';

const pwa=new PwaController(window,navigator,import.meta.env.PROD);
pwa.start();

// Métrica local sem telemetria, identidade ou dados de sessão.
performance.mark('pereirao:react-start');
function ReactMountMetric() {
  useLayoutEffect(() => {
    if (!performance.getEntriesByName('pereirao:react-mount').length) {
      performance.mark('pereirao:react-commit');
      performance.measure('pereirao:react-mount', 'pereirao:react-start', 'pereirao:react-commit');
    }
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactMountMetric />
    <BrowserRouter>
      <RestoreLastPage />
      <PwaProvider controller={pwa}><PwaGate><App /></PwaGate></PwaProvider>
    </BrowserRouter>
  </StrictMode>,
);
