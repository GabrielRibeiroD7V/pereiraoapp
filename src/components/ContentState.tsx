import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ContentStateProps {
  title: string;
  children: ReactNode;
  icon: LucideIcon;
}

export function ContentState({ title, children, icon: Icon }: ContentStateProps) {
  return (
    <section className="content-state" aria-label={title}>
      <span className="content-state__icon"><Icon size={24} aria-hidden="true" /></span>
      <div><h2>{title}</h2><p>{children}</p></div>
    </section>
  );
}
