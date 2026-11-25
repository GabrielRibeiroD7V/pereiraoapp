import { useState } from 'react';
import { BrushCleaning, Hammer, HardHat, PaintRoller, Snowflake, Zap, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Category, CategoryId } from '../types/domain';
import type { LucideIcon } from 'lucide-react';
import { routes } from '../app/routes';

const icons: Record<CategoryId, LucideIcon> = {
  climatizacao: Snowflake, pintura: PaintRoller, construcao: HardHat,
  eletrica: Zap, marcenaria: Hammer, limpeza: BrushCleaning,
};

export function CategoryTile({ category }: { category: Category }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const Icon = icons[category.id] ?? Wrench;
  const image = category.officialImage;
  return (
    <Link className={`category-tile category-tile--${category.id}`} to={`${routes.search}?${new URLSearchParams({ categoria: category.id })}`}>
      <span className="category-tile__visual" aria-hidden="true">
        {image && failedImage !== image.src ? (
          <img src={image.src} alt="" width={image.width} height={image.height}
            loading="lazy" decoding="async" onError={() => setFailedImage(image.src)} />
        ) : <Icon size={28} strokeWidth={1.8} />}
      </span>
      <span>{category.name}</span>
    </Link>
  );
}
