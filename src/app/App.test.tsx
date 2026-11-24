import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { clearAuthReturn, readAuthReturn, rememberAuthReturn } from '../auth/flowState';

function open(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('navegação pública', () => {
  it('mantém somente três destinos principais e indica a página atual', () => {
    open();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Buscar' })).not.toHaveAttribute('aria-current');
  });

  it('navega sem login e transfere o foco para o título', () => {
    open();
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Buscar' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Buscar' })).toHaveFocus();
    expect(document.title).toBe('Buscar | PEREIRÃO');
    const nav = screen.getByRole('navigation');
    fireEvent.click(within(nav).getByRole('link', { name: 'Conta' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Minha conta' })).toHaveFocus();
    expect(within(nav).getByRole('link', { name: 'Buscar' })).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('link', { name: 'Continuar explorando' }));
    expect(screen.getByRole('heading', { level: 1, name: 'O que você está procurando?' })).toBeInTheDocument();
  });

  it.each(['/buscar', '/conta'])('permite acesso direto a %s', (path) => {
    open(path);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('img', { name: 'PEREIRÃO' })).toBeInTheDocument();
  });

  it('abre a Home pelo endereço do ícone sem consumir o retorno de autenticação', () => {
    rememberAuthReturn('/conta/profissional/cadastro');
    open('/?source=pwa');
    expect(screen.getByRole('heading', { level: 1, name: 'O que você está procurando?' })).toBeVisible();
    expect(readAuthReturn()).toBe('/conta/profissional/cadastro');
    clearAuthReturn();
  });

  it('oferece recuperação para rota desconhecida', () => {
    open('/nao-existe');
    expect(screen.getByRole('heading', { level: 1, name: 'Este caminho não existe' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao início' }));
    expect(document.title).toBe('Início | PEREIRÃO');
  });

  it('oferece atalho acessível para o conteúdo', () => {
    open();
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#main-content');
  });
});
