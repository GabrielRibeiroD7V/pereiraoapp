import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { SectionTabs } from '../components/SectionTabs';
import { Modal } from '../components/Modal';
import { BusinessStatus } from '../components/BusinessStatus';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import { normalizeRegistration, professionalError, validateRegistration } from '../professional/validation';
import type { EditableBusiness, ProfessionalCatalog, RegistrationInput } from '../professional/types';
import type { CategoryId } from '../types/domain';
import { SpecialtyPicker } from '../specialties/SpecialtyPicker';
import { CitySelect } from '../locations/CitySelect';
import { ServiceAreaPicker } from '../locations/ServiceAreaPicker';
import { useWorkRepository } from '../work/WorkProvider';
import { ProfilePhotoPicker } from '../work/ProfilePhotoPicker';
import { ManagedBusinessAvatar } from '../work/ManagedBusinessAvatar';
import { effectiveAvatarPath } from '../lib/mediaPath';
import { ProfilePreviewPage } from './ProfilePreviewPage';

const sections = ['perfil', 'atendimento', 'conteudo', 'previa'];
export function ProfessionalEditorPage() {
  const { businessId = '' } = useParams();
  const { session } = useAuth();
  const repository = useProfessionalRepository();
  const work = useWorkRepository();
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams();
  const requested = query.get('secao') ?? '';
  const section = sections.includes(requested) ? requested : 'perfil';
  const [saved, setSaved] = useState<EditableBusiness | null>(null);
  const [input, setInput] = useState<RegistrationInput | null>(null);
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const [leave, setLeave] = useState<string | null>(null);
  const busy = useRef(false);
  const epoch = useRef(0);
  const dirty = !!input && !!saved && JSON.stringify(input) !== JSON.stringify(saved.input);
  useEffect(() => {
    let live = true;
    ++epoch.current;
    setSaved(null); setInput(null); setCatalog(null); setLoading(true); setPending(false); busy.current = false; setError(''); setNotice('');
    if (!repository) { setLoading(false); return; }
    void Promise.all([repository.getEditable(businessId), repository.getCatalog()]).then(([value, options]) => {
      if (live) { setSaved(value); setInput(value.input); setCatalog(options); }
    }).catch(cause => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; ++epoch.current; };
  }, [repository, businessId, session?.user.id]);
  // Preserve edits when following links (including the bottom navigation) or reloading.
  useEffect(() => {
    if (!dirty && !pending) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault(); event.stopPropagation();
      if (!pending) setLeave(url.pathname + url.search + url.hash);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', follow, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', follow, true); };
  }, [dirty, pending]);
  function change<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setInput(current => current ? { ...current, [key]: value } : current); setError(''); setNotice('');
  }
  function primary(id: CategoryId) {
    if (!input) return;
    setInput({ ...input, categoryId: id, additionalCategoryIds: [...new Set([
      ...input.additionalCategoryIds.filter(value => value !== id),
      ...(catalog?.specialtiesAvailable !== false && input.categoryId && input.categoryId !== id && catalog?.categories.some(value => value.id === input.categoryId) ? [input.categoryId] : []),
    ])] }); setError(''); setNotice('');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!input || !catalog || !repository || busy.current || !dirty) return;
    const message = validateRegistration(input, catalog, 3);
    if (message) { setError(message); return; }
    const requestEpoch = epoch.current;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      await repository.saveDraft(businessId, normalizeRegistration(input));
      // Refresh only from persisted data, including the concurrency snapshot for specialties.
      const value = await repository.getEditable(businessId);
      if (epoch.current !== requestEpoch) return;
      setSaved(value); setInput(value.input); setRevision(value => value + 1);
      setFormVersion(value => value + 1);
      setNotice('Alterações salvas. A prévia mostra os dados gravados. O status de publicação não foi alterado.');
    } catch (cause) { if (epoch.current === requestEpoch) setError(professionalError(cause)); }
    finally { if (epoch.current === requestEpoch) { busy.current = false; setPending(false); } }
  }
  function discard() {
    if (saved) setInput(saved.input);
    setFormVersion(value => value + 1); setError(''); setNotice('Alterações não salvas descartadas.'); setRevision(value => value + 1);
  }
  return <div className="profile-editor">
    <Link className="back-link" to="/conta" state={{ businessId }}>Voltar à Conta</Link>
    <PageHeader title="Editar perfil profissional"><p>Organize a apresentação e o conteúdo do seu negócio.</p></PageHeader>
    {loading && <p role="status">Carregando perfil…</p>}
    {!repository && <p role="status">Edição indisponível neste momento.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="form-notice">{notice}</p>}
    {saved && input && catalog && <>
      <header className="profile-editor__identity">
        <div className="profile-photo-controls" hidden={section !== 'perfil'} inert={pending}>{work ? <ProfilePhotoPicker actionLabel="Foto principal" businessId={businessId} path={effectiveAvatarPath(saved.business)} repository={work} onSaved={path => {
          setSaved(current => current ? { ...current, business: { ...current.business, profile_avatar_path: path } } : current);
          setRevision(value => value + 1);
        }} /> : <ManagedBusinessAvatar path={effectiveAvatarPath(saved.business)} />}</div>
        <div><strong>{saved.input.name}</strong><p>{saved.input.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</p><BusinessStatus status={saved.business.status} /></div>
      </header>
      <p hidden={section !== 'perfil'} className="field-help">Foto principal é o retrato do perfil. Ela não é adicionada às fotografias de trabalhos.</p>
      <form key={formVersion} className="auth-form profile-editor__form" onSubmit={save} noValidate aria-busy={pending}>
        <p className="profile-editor__save-state" role="status">{dirty ? 'Há alterações não salvas. A prévia continua mostrando a versão gravada.' : 'Você está editando os dados salvos.'}</p>
        <SectionTabs label="Editar conteúdo profissional" selectedId={section} onSelect={id => setQuery({ secao: id }, { replace: true })} sections={[
          { id: 'perfil', label: 'Perfil', content: <fieldset disabled={pending} className="profile-editor__fields"><legend className="visually-hidden">Identidade e especialidades</legend>
            <div className="form-field"><label htmlFor="edit-provider-type">Tipo de prestador</label><select id="edit-provider-type" value={input.type} onChange={event => change('type', event.target.value as RegistrationInput['type'])}><option value="autonomo">Profissional autônomo</option><option value="empresa">Empresa</option></select></div>
            <FormField id="edit-business-name" label={input.type === 'empresa' ? 'Nome da empresa' : 'Nome profissional'} value={input.name} onChange={event => change('name', event.target.value)} maxLength={120} required />
            <div className="form-field"><label htmlFor="edit-business-bio">Bio</label><textarea id="edit-business-bio" value={input.description} rows={4} maxLength={3000} onChange={event => change('description', event.target.value)} /></div>
            <div className="form-field"><label htmlFor="edit-category">Categoria principal</label><select id="edit-category" value={input.categoryId} onChange={event => primary(event.target.value as CategoryId)} required><option value="" disabled>Selecione</option>{catalog.categories.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></div>
            {catalog.specialtiesAvailable !== false ? <SpecialtyPicker categories={catalog.categories} primaryId={input.categoryId} selected={input.additionalCategoryIds} onChange={ids => change('additionalCategoryIds', ids)} /> : <p className="field-help">Especialidades adicionais indisponíveis. A categoria principal foi preservada.</p>}
          </fieldset> },
          { id: 'atendimento', label: 'Atendimento', content: <fieldset disabled={pending} className="profile-editor__fields"><legend className="visually-hidden">Cidades e contatos públicos</legend>
            <CitySelect id="edit-city" label="Cidade de origem" cities={catalog.cities.map(value => ({ ...value, stateCode: value.state_code }))} value={input.cityId} required onChange={value => change('cityId', value)} />
            <ServiceAreaPicker cities={catalog.cities.map(value => ({ ...value, stateCode: value.state_code }))} originId={input.cityId} selectedIds={input.areaCityIds} onChange={ids => change('areaCityIds', ids)} />
            <FormField id="edit-whatsapp" label="WhatsApp" type="tel" value={input.whatsapp} maxLength={24} onChange={event => change('whatsapp', event.target.value)} />
            <p className="field-help">Informe país e DDD. Obrigatório antes da publicação administrativa.</p>
            <FormField id="edit-instagram" label="Instagram (opcional)" value={input.instagram} maxLength={31} onChange={event => change('instagram', event.target.value)} />
          </fieldset> },
          { id: 'conteudo', label: 'Conteúdo', content: <section className="profile-editor__content" aria-label="Gerenciar conteúdo salvo"><h2>Conteúdo do perfil</h2><p className="field-help">Cada seção usa os dados deste negócio e retorna para esta área.</p>
            <Link to={`/conta/profissional/${businessId}/servicos`}><strong>Meus serviços</strong><span>Nome, descrição, categoria e preços</span></Link>
            <Link to={`/conta/profissional/${businessId}/trabalhos`}><strong>Adicionar foto de trabalho</strong><span>Fotografias de serviços realizados, separadas do retrato</span></Link>
            <Link to={`/conta/profissional/${businessId}/publicacoes`}><strong>Publicações de trabalhos</strong><span>Preparar e gerenciar trabalhos com fotos e descrição</span></Link>
          </section> },
          { id: 'previa', label: 'Prévia', content: <section aria-label="Prévia dos dados salvos"><p className="form-notice">Prévia privada dos dados salvos. Alterações ainda não salvas não aparecem aqui.</p>{section === 'previa' && <ProfilePreviewPage key={`${businessId}:${revision}`} businessIdOverride={businessId} embedded readOnly />}</section> },
        ]} />
        {(section === 'perfil' || section === 'atendimento') && <div className="profile-editor__actions"><button type="submit" className="button button--primary" disabled={pending || !dirty}>{pending ? 'Salvando…' : 'Salvar alterações'}</button><button type="button" className="button button--secondary" disabled={pending || !dirty} onClick={discard}>Cancelar alterações</button></div>}
      </form>
      <p className="field-help">Salvar não publica seu negócio, não inicia gratuidade e não ativa cobrança. A publicação do perfil depende de aprovação administrativa.</p>
    </>}
    {leave && <Modal title="Descartar alterações não salvas?" onClose={() => setLeave(null)}><p>As informações ainda não salvas não aparecerão na prévia.</p><div className="work-actions"><button type="button" className="button button--secondary" onClick={() => setLeave(null)}>Continuar editando</button><button type="button" className="button button--primary" onClick={() => { const destination = leave; setLeave(null); navigate(destination, { state: { businessId } }); }}>Descartar e sair</button></div></Modal>}
  </div>;
}
