export function QueryStatus({ loading, error, retry }: { loading: boolean; error?: boolean; retry: () => void }) {
  if (loading) return <p role="status" className="public-query-status">Carregando…</p>;
  if (error) return <div role="alert" className="form-error">Não foi possível carregar. Verifique sua conexão.<button type="button" className="text-link" onClick={retry}>Tentar novamente</button></div>;
  return null;
}
