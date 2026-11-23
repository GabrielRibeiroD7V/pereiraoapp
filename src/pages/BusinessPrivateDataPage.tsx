import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import type { EditableBusiness } from '../professional/types';
import { professionalError } from '../professional/validation';

/** Private company details stay in Account, never in the public-profile editor/preview. */
export function BusinessPrivateDataPage() {
  const { businessId = '' } = useParams();
  const { session } = useAuth();
  const repository = useProfessionalRepository();
  const [saved, setSaved] = useState<EditableBusiness | null>(null);
  const [legalName, setLegalName] = useState(''), [taxId, setTaxId] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    let live = true; ++epoch.current; busy.current = false; setPending(false); setSaved(null); setError(''); setNotice('');
    void repository?.getEditable(businessId).then(value => {
      if (live) { setSaved(value); setLegalName(value.input.legalName); setTaxId(value.input.taxId); }
    }).catch(cause => { if (live) setError(professionalError(cause)); });
    return () => { live = false; ++epoch.current; };
  }, [repository, businessId, session?.user.id]);
  return <div className="profile-editor"><Link className="back-link" to="/conta" state={{ businessId }}>Voltar à Conta</Link>
    <PageHeader title="Dados empresariais privados"><p>Razão social e CNPJ não aparecem no perfil público.</p></PageHeader>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {saved?.input.type === 'empresa' ? <form className="auth-form" onSubmit={async event => {
      event.preventDefault(); if (!repository || busy.current) return;
      const requestEpoch = epoch.current; busy.current = true; setPending(true); setError(''); setNotice('');
      try {
        await repository.saveDraft(businessId, { ...saved.input, legalName, taxId });
        const value = await repository.getEditable(businessId); if (epoch.current !== requestEpoch) return; setSaved(value); setLegalName(value.input.legalName); setTaxId(value.input.taxId);
        setNotice('Dados empresariais salvos. O perfil não foi publicado.');
      } catch (cause) { if (epoch.current === requestEpoch) setError(professionalError(cause)); }
      finally { if (epoch.current === requestEpoch) { busy.current = false; setPending(false); } }
    }}><fieldset disabled={pending} className="profile-editor__fields"><legend className="visually-hidden">Informações privadas</legend>
      <FormField id="private-legal" label="Razão social" value={legalName} maxLength={200} onChange={event => setLegalName(event.target.value)} />
      <FormField id="private-tax" label="CNPJ" value={taxId} inputMode="numeric" maxLength={18} onChange={event => setTaxId(event.target.value)} />
      <div className="work-actions"><button className="button button--primary" disabled={pending}>{pending ? 'Salvando…' : 'Salvar dados empresariais'}</button><button className="button button--secondary" type="button" disabled={pending} onClick={() => { setLegalName(saved.input.legalName); setTaxId(saved.input.taxId); }}>Cancelar</button></div>
    </fieldset></form> : saved ? <p>Este perfil é de profissional autônomo.</p> : !error && <p role="status">{repository ? 'Carregando dados privados…' : 'Edição indisponível neste momento.'}</p>}
  </div>;
}
