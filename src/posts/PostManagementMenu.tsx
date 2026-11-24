import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
/** Somente a apresentação de ações autorizadas; o servidor continua verificando o vínculo. */
export function PostManagementMenu({children}:{children:ReactNode}) {
  return <details className="post-management"><summary role="button" aria-label="Opções da publicação"><Ellipsis size={20} aria-hidden="true"/></summary><nav aria-label="Gerenciar publicação">{children}</nav></details>;
}
