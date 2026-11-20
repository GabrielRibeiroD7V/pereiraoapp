import type { Category, CategoryId } from '../types/domain';

// Fotos só serão associadas após o recebimento dos arquivos oficiais.
// null não deve ser substituído por foto de prestador ou imagem externa.
export const categories = [
  { id: 'climatizacao', name: 'Climatização', officialImage: null },
  { id: 'pintura', name: 'Pintura', officialImage: null },
  { id: 'construcao', name: 'Construção', officialImage: null },
  { id: 'eletrica', name: 'Elétrica', officialImage: null },
  { id: 'marcenaria', name: 'Marcenaria', officialImage: null },
  { id: 'limpeza', name: 'Limpeza', officialImage: null },
] as const satisfies readonly Category[];

export const categoryById: Readonly<Record<CategoryId, Category>> = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<CategoryId, Category>;
