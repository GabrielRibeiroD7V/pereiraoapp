import type { Category, CategoryId, OfficialCategoryImage } from '../types/domain';

// Ilustrações SVG originais do PEREIRÃO; nunca representam trabalhos de prestadores.
export const categories = [
  { id: 'climatizacao', name: 'Climatização', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/climatizacao.svg', alt: '', width: 160, height: 112 } },
  { id: 'pintura', name: 'Pintura', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/pintura.svg', alt: '', width: 160, height: 112 } },
  { id: 'construcao', name: 'Construção', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/construcao.svg', alt: '', width: 160, height: 112 } },
  { id: 'eletrica', name: 'Elétrica', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/eletrica.svg', alt: '', width: 160, height: 112 } },
  { id: 'marcenaria', name: 'Marcenaria', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/marcenaria.svg', alt: '', width: 160, height: 112 } },
  { id: 'limpeza', name: 'Limpeza', officialImage: { kind: 'official-category', src: '/images/categories/illustrations/limpeza.svg', alt: '', width: 160, height: 112 } },
] as const satisfies readonly Category[];

export const categoryById: Readonly<Record<CategoryId, Category>> = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<CategoryId, Category>;

// Apenas identidade visual. Nomes e opções vêm do catálogo, nunca desta lista.
export function categoryImage(id:string):OfficialCategoryImage|null {
  const popular=categories.find(item=>item.id===id);
  if(popular)return popular.officialImage;
  if(!['serralheria-metalurgica','mecanica-automotivo','jardinagem-paisagismo','beleza-estetica'].includes(id))return null;
  return {kind:'official-category',src:`/images/categories/illustrations/${id}.svg`,alt:'',width:160,height:112};
}
