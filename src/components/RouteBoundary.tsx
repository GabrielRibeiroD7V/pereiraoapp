import { Component } from 'react';
import type { ReactNode } from 'react';

// Uma falha de download de rota não apaga a navegação nem provoca recargas automáticas.
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="content-state">
      <div><h1 id="page-title" tabIndex={-1}>Não foi possível abrir esta página</h1>
        <p>Confira sua conexão. Recarregar pode descartar alterações ainda não salvas.</p>
        <button type="button" className="button button--secondary" onClick={() => window.location.reload()}>Recarregar página</button>
        <a className="text-link" href="/">Voltar ao início</a>
      </div>
    </section>;
  }
}
