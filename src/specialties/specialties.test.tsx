import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SpecialtyPicker } from './SpecialtyPicker';
import { emptyRegistration, normalizeRegistration, professionalError, validateRegistration } from '../professional/validation';
const categories = [{ id: 'construcao' as const, name: 'Construção' }, { id: 'pintura' as const, name: 'Pintura' }, { id: 'eletrica' as const, name: 'Elétrica' }];
function Picker({ initial = [] }: { initial?: string[] }) { const [ids,setIds] = useState(initial); return <SpecialtyPicker categories={categories} primaryId="construcao" selected={ids} onChange={setIds} />; }
describe('especialidades adicionais', () => {
  it('seleciona e remove adicionais, mantendo a principal distinta', () => {
    render(<Picker />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pintura' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elétrica' }));
    expect(screen.getByRole('list', { name: 'Especialidades selecionadas' })).toHaveTextContent('ConstruçãoPrincipalPinturaElétrica');
    expect(screen.queryByRole('checkbox', { name: 'Construção' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover especialidade Pintura' }));
    expect(screen.getByRole('checkbox', { name: 'Pintura' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Elétrica' })).toBeChecked();
  });
  it('permite remover uma categoria que saiu do catálogo ativo, sem ocultar a escolha anterior', () => {
    render(<Picker initial={['inativa']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover especialidade Indisponível (inativa)' }));
    expect(screen.queryByText('Indisponível (inativa)')).not.toBeInTheDocument();
  });
  it('normaliza sem duplicatas, valida catálogo ativo e não perde o snapshot original', () => {
    const snapshot = { primaryId: 'construcao', additionalIds: ['pintura'] };
    const input = { ...emptyRegistration, name: 'Teste', cityId: 'mundo-novo-ms', categoryId: 'construcao' as const, additionalCategoryIds: ['pintura','pintura','construcao'], expectedSpecialties: snapshot };
    expect(normalizeRegistration(input)).toMatchObject({ additionalCategoryIds: ['pintura'], expectedSpecialties: snapshot });
    expect(validateRegistration({ ...input, additionalCategoryIds: ['inativa'] }, { categories, cities: [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }] }, 3)).toContain('indisponíveis');
    expect(professionalError({ code: '40001', message: 'private detail' })).toMatch(/Outro responsável/);
    expect(professionalError({ code: '40001', message: 'private detail' })).not.toContain('private detail');
  });
});
