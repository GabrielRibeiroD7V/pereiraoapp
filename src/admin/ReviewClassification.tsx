import type { AdminReviewCatalog } from './types';
import './review.scss';
export function ReviewClassification({ catalog, fallbackCategory, fallbackCity }: {
  catalog: AdminReviewCatalog | null; fallbackCategory?: string | null; fallbackCity?: string | null;
}) {
  return <section className="admin-review-classification" aria-label="Especialidades e atendimento declarados">
    <h3>Especialidades e atendimento</h3>
    <p className="field-help">Informações declaradas pelo responsável. A publicação não representa verificação de formação, registro ou experiência.</p>
    {!catalog && <p role="status" className="form-notice">A revisão completa de especialidades e cidades está indisponível. Feche e abra esta análise para tentar novamente. Não confunda a indisponibilidade da consulta com verificação das informações.</p>}
    <dl>
      <div><dt>Categoria principal</dt><dd>{catalog ? (catalog.primaryCategory ? <>{catalog.primaryCategory.name}{!catalog.primaryCategory.active && ' (inativa)'}</> : 'Não informada.') : (fallbackCategory || 'Não informada.')}</dd></div>
      <div><dt>Especialidades adicionais</dt><dd>{!catalog ? 'Leitura indisponível.' : catalog.additionalSpecialties.length ? <ul>{catalog.additionalSpecialties.map(item => <li key={item.id}>{item.name}{!item.active && ' (inativa)'}</li>)}</ul> : 'Nenhuma especialidade adicional informada.'}</dd></div>
      <div><dt>Cidade de origem</dt><dd>{catalog ? (catalog.originCity ? <>{catalog.originCity.name}/{catalog.originCity.stateCode}{!catalog.originCity.active && ' (inativa)'}</> : 'Não informada.') : (fallbackCity ? `${fallbackCity} (UF indisponível)` : 'Não informada.')}</dd></div>
      <div><dt>Cidades atendidas</dt><dd>{!catalog ? 'Leitura indisponível.' : catalog.serviceCities.length ? <ul>{catalog.serviceCities.map(item => <li key={item.id}>{item.name}/{item.stateCode}{!item.active && ' (inativa)'}</li>)}</ul> : 'Nenhuma cidade de atendimento informada.'}</dd></div>
    </dl>
  </section>;
}
