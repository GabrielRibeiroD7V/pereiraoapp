import { Armchair, Brush, HardHat, PaintRoller, Snowflake, Zap } from 'lucide-react';
import type { CategoryId } from '../types/domain';

const icons = { climatizacao: Snowflake, pintura: PaintRoller, construcao: HardHat, eletrica: Zap, marcenaria: Armchair, limpeza: Brush };
export function CategoryIcon({ id, size = 21 }: { id: CategoryId; size?: number }) {
  const Icon = icons[id];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
