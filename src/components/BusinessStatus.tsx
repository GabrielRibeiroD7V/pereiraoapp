import type { BusinessRow } from '../lib/database.types';

const labels: Record<BusinessRow['status'], string> = { draft: 'Rascunho', published: 'Publicado', unpublished: 'Não publicado' };
export function BusinessStatus({ status }: { status: BusinessRow['status'] }) {
  return <span className={`business-status business-status--${status}`}><span aria-hidden="true" />{labels[status]}</span>;
}
