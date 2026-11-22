import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import type { useBusinessWork } from './useBusinessWork';
export function WorkFrame({ title, state, children }: { title: string; state: ReturnType<typeof useBusinessWork>; children: ReactNode }) {
  return <div className="work-page"><Link className="back-link" to={`/conta/profissional/${state.businessId}/editar?secao=conteudo`}><ArrowLeft size={17} aria-hidden="true" />Voltar a editar perfil</Link>
    <PageHeader title={title}>{state.data && <p className="work-business-name">{state.data.business.name}</p>}</PageHeader>
    {state.loading && <p role="status" className="field-help">Atualizando informações…</p>}
    {state.error && <div className="form-error" role="alert"><p>{state.error}</p><button className="text-link" type="button" onClick={state.refresh} disabled={state.loading}>Tentar novamente</button></div>}
    {state.data && children}
  </div>;
}
