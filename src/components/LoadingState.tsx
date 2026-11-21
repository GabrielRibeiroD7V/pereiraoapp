import type { ReactNode } from 'react';
export function LoadingState({ children }: { children: ReactNode }) {
  return <div className="loading-state" role="status"><span>{children}</span><div className="loading-state__bars" aria-hidden="true"><i /><i /><i /></div></div>;
}
