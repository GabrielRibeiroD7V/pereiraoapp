import type { Presentation } from './model';
export function PresentationSections({ data, company = false }: { data: Presentation; company?: boolean }) {
  const sections = [[company ? 'Histórico e experiência da empresa' : 'Experiência profissional', data.experience], [company ? 'Qualificação da equipe' : 'Formação', data.education], ['Certificações',data.certifications],['Registro profissional',data.professional_registration]];
  if(!sections.some(([,value])=>value))return null;
  return <details className="professional-background"><summary>{company ? 'Histórico e qualificações' : 'Experiência, formação e credenciais'}</summary><div className="professional-presentation">{sections.filter(([,value]) => value).map(([title,value]) => <section key={title} className="public-profile-section"><h2>{title}</h2><p>{value}</p>{(title === 'Certificações' || title === 'Registro profissional') && <p className="field-help">Informado pelo responsável. Não verificado pelo PEREIRÃO.</p>}</section>)}</div></details>;
}
