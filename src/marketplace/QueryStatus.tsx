import { LoadingState } from '../components/LoadingState';
export function QueryStatus({ loading, error, retry }: { loading: boolean; error?: boolean; retry: () => void }) {
  if (loading) return <LoadingState>Carregando…</LoadingState>;
  if (error) return <div role="alert" className="form-error">Não foi possível carregar. Verifique sua conexão.<button type="button" className="text-link" onClick={retry}>Tentar novamente</button></div>;
  return null;
}
