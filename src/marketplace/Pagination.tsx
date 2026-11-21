export function Pagination({ page, hasNext, onChange, label }: { page: number; hasNext: boolean; onChange: (page: number) => void; label: string }) {
  if (page === 1 && !hasNext) return null;
  return <div className="public-pagination" role="group" aria-label={`Paginação de ${label}`}><button type="button" className="button button--secondary" aria-label={`Anterior — ${label}`} disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button--secondary" aria-label={`Próxima — ${label}`} disabled={!hasNext} onClick={() => onChange(page + 1)}>Próxima</button></div>;
}
