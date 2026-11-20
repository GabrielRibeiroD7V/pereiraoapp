import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1 id="page-title" tabIndex={-1}>{title}</h1>
      {children && <div className="page-header__description">{children}</div>}
    </header>
  );
}
