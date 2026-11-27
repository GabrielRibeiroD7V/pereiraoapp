import { Armchair, Brush, HardHat, PaintRoller, Snowflake, Zap, Wrench } from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type { CategoryId } from '../types/domain';
import { categoryImage } from '../config/categories';

const icons:Record<string,LucideIcon> = { climatizacao: Snowflake, pintura: PaintRoller, construcao: HardHat, eletrica: Zap, marcenaria: Armchair, limpeza: Brush };
export function CategoryIcon({ id, size = 21 }: { id: CategoryId; size?: number }) {
  const image=!icons[id] ? categoryImage(id) : null;
  if(image)return <img src={image.src} width={size} height={size} alt="" aria-hidden="true" />;
  const Icon = icons[id] ?? Wrench;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
