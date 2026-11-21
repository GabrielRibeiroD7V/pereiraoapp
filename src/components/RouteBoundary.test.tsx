import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from './RouteBoundary';
function FailedChunk(): never { throw new Error('Failed to fetch dynamically imported module'); }
describe('falha de carregamento de rota', () => {
  it('oferece recuperação explícita sem revelar o erro técnico nem recarregar automaticamente', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<><nav>Navegação preservada</nav><RouteBoundary><FailedChunk /></RouteBoundary></>);
      expect(screen.getByRole('navigation')).toHaveTextContent('Navegação preservada');
      expect(screen.getByRole('alert')).toHaveTextContent('Confira sua conexão');
      expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    } finally { log.mockRestore(); }
  });
});
