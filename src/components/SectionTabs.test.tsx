import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SectionTabs } from './SectionTabs';
it('mantém dados dos painéis e oferece navegação completa por teclado', () => {
  render(<SectionTabs label="Perfil" sections={[
    { id: 'works', label: 'Trabalhos', content: <input aria-label="Dado preservado" defaultValue="Rascunho" /> },
    { id: 'services', label: 'Serviços', content: <p>Serviços do prestador</p> },
    { id: 'about', label: 'Sobre', content: <p>Área de atendimento</p> },
  ]} />);
  const works = screen.getByRole('tab', { name: 'Trabalhos' });
  fireEvent.change(screen.getByLabelText('Dado preservado'), { target: { value: 'Dado editado' } });
  fireEvent.keyDown(works, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Serviços' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Serviços');
  expect(screen.getByLabelText('Dado preservado')).not.toBeVisible();
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Sobre' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(works).toHaveFocus();
  expect(screen.getByLabelText('Dado preservado')).toHaveValue('Dado editado');
  fireEvent.keyDown(works, { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Sobre' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(works).toHaveFocus();
});
