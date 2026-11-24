import { linkedinUrl } from './model';
import type { Presentation } from './model';
export function PresentationIdentity({ data, company = false }: { data: Presentation; company?: boolean }) {
  const link = linkedinUrl(data.linkedin_url);
  return <>
    {data.profession && <p className="professional-declaration"><strong>{company ? 'Atuação declarada' : 'Profissão declarada'}:</strong> {data.profession}<small className="field-help">Informação declarada pelo responsável. Não verificada pelo PEREIRÃO.</small></p>}
    {link && <a className="text-link professional-linkedin" href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">LinkedIn <span className="visually-hidden">(abre em nova guia)</span></a>}
  </>;
}
