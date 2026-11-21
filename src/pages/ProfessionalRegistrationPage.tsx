import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { useAuth } from '../auth/AuthProvider';
import { useProfessionalRepository } from '../professional/ProfessionalProvider';
import type { ProfessionalCatalog, RegistrationInput } from '../professional/types';
import { createRegistrationSlug, emptyRegistration, normalizeRegistration, professionalError, validateRegistration } from '../professional/validation';
import { clearCheckpoint, readCheckpoint, writeCheckpoint } from '../professional/checkpoint';
import type { Checkpoint } from '../professional/checkpoint';
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, UserRound } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { CitySelect } from '../locations/CitySelect';
import { ServiceAreaPicker } from '../locations/ServiceAreaPicker';
import { StepProgress } from '../components/StepProgress';

const steps = ['Identificação', 'Seu negócio', 'Contatos'];
const stepTitles = ['Como você quer anunciar?', 'Conte sobre seu trabalho', 'Contatos e revisão'];
export function ProfessionalRegistrationPage() {
  const repository = useProfessionalRepository();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<ProfessionalCatalog | null>(null);
  const [input, setInput] = useState<RegistrationInput>({ ...emptyRegistration });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const checkpoint = useRef<Checkpoint | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setCatalog(null);
    if (!repository) { setLoading(false); return; }
    async function load() {
      const values = await repository!.getCatalog();
      const saved = businessId ? null : readCheckpoint(uid);
      const id = businessId ?? saved?.businessId;
      const existing = id ? await repository!.getEditable(id) : null;
      if (!live) return;
      checkpoint.current = saved;
      setSavedId(id ?? null);
      setCatalog(values);
      setInput(existing?.input ?? { ...emptyRegistration, cityId: values.cities.find((city) => city.id === 'mundo-novo-ms')?.id ?? values.cities[0]?.id ?? '', areaCityIds: [] });
    }
    void load().catch((cause: unknown) => { if (live) setError(professionalError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [repository, businessId, uid]);
  useEffect(() => { if (step > 1) heading.current?.focus(); }, [step]);

  function change<K extends keyof RegistrationInput>(name: K, value: RegistrationInput[K]) {
    setInput((current) => ({ ...current, [name]: value }));
    setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog || !repository || submitting.current) return;
    const message = validateRegistration(input, catalog, step);
    if (message) { setError(message); return; }
    if (step < 3) { setStep(step + 1); return; }
    submitting.current = true; setPending(true); setError(null);
    const normalized = normalizeRegistration(input);
    try {
      const attempt = checkpoint.current ?? { slug: createRegistrationSlug(input.name) };
      checkpoint.current = attempt;
      if (!businessId) writeCheckpoint(uid, attempt);
      const id = businessId ?? savedId ?? await repository.createDraft(normalized, attempt.slug);
      setSavedId(id);
      checkpoint.current = { ...attempt, businessId: id };
      if (!businessId) writeCheckpoint(uid, checkpoint.current);
      await repository.saveDraft(id, normalized);
      if (!businessId || readCheckpoint(uid)?.businessId === id) clearCheckpoint(uid);
      navigate('/conta/profissional', { replace: true, state: { saved: true, businessId: id } });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505' && !checkpoint.current?.businessId) {
        checkpoint.current = null; clearCheckpoint(uid);
      }
      setError(professionalError(cause));
    } finally { submitting.current = false; setPending(false); }
  }

  return <div className="registration-page">
    <Link className="back-link" to="/conta/profissional"><ArrowLeft size={17} aria-hidden="true" />Espaço profissional</Link>
    <PageHeader title={businessId ? 'Editar perfil profissional' : 'Anunciar meus serviços'}><p>Seu próximo cliente começa conhecendo seu trabalho.</p></PageHeader>
    {loading && <p role="status">Carregando informações do cadastro…</p>}
    {!repository && <p role="status" className="form-notice">O cadastro ainda está sendo preparado. Continue explorando o PEREIRÃO.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {savedId && !businessId && <p className="form-notice">Seu rascunho já foi criado. Ao tentar novamente, continuaremos no mesmo perfil.</p>}
    {catalog && <>
      {(catalog.categories.length === 0 || catalog.cities.length === 0) && <p role="status" className="form-notice">Ainda não há cidade ou categoria disponível para concluir o cadastro.</p>}
      <StepProgress labels={steps} step={step} />
      <div className="registration-section-heading"><span className="step-caption">Etapa {step} de 3</span><h2 ref={heading} tabIndex={-1} className="registration-title">{stepTitles[step - 1]}</h2>
        <p>{step === 1 ? 'Um perfil para apresentar seus serviços na sua cidade.' : step === 2 ? 'As informações que ajudam as pessoas a encontrar você.' : 'Confira seus dados. Você poderá editar tudo depois.'}</p></div>
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className="registration-fields">
          {step === 1 && <fieldset className="provider-choice"><legend className="visually-hidden">Tipo de prestador</legend>
            <label className={input.type === 'autonomo' ? 'is-selected' : ''}><input aria-label="Profissional autônomo" type="radio" name="provider_type" value="autonomo" checked={input.type === 'autonomo'} onChange={() => change('type', 'autonomo')} /><UserRound size={25} aria-hidden="true" /><strong>Profissional autônomo</strong><span>Seu trabalho, seu nome.</span></label>
            <label className={input.type === 'empresa' ? 'is-selected' : ''}><input aria-label="Empresa" type="radio" name="provider_type" value="empresa" checked={input.type === 'empresa'} onChange={() => change('type', 'empresa')} /><Building2 size={25} aria-hidden="true" /><strong>Empresa</strong><span>A presença do seu negócio.</span></label>
          </fieldset>}
          {step === 2 && <>
            <FormField id="business-name" label={input.type === 'empresa' ? 'Nome da empresa' : 'Nome profissional'} value={input.name} onChange={(event) => change('name', event.target.value)} maxLength={120} required />
            <fieldset className="category-picker"><legend>Categoria principal</legend><div className="category-picker__grid">{catalog.categories.map((category) => <label key={category.id} className={input.categoryId === category.id ? 'is-selected' : ''}>
              <input type="radio" name="main_category" value={category.id} aria-label={category.name} checked={input.categoryId === category.id} onChange={() => change('categoryId', category.id)} required /><CategoryIcon id={category.id} /><span>{category.name}</span>
            </label>)}</div></fieldset>
            <div className="form-field"><label htmlFor="business-description">Descrição</label><textarea id="business-description" value={input.description} placeholder="Ex.: Instalação e manutenção de ar-condicionado residencial e comercial." maxLength={3000} rows={3} onChange={(event) => change('description', event.target.value)} /></div>
            <CitySelect id="business-city" label="Cidade" cities={catalog.cities.map(city => ({ ...city, stateCode: city.state_code }))} value={input.cityId} required onChange={value => change('cityId', value)} />
            <p className="field-help">Esta é a localização principal do seu negócio. As cidades atendidas podem ser diferentes.</p>
            <ServiceAreaPicker cities={catalog.cities.map(city => ({ ...city, stateCode: city.state_code }))} originId={input.cityId} selectedIds={input.areaCityIds} onChange={ids => change('areaCityIds', ids)} />
          </>}
          {step === 3 && <>
            <FormField id="business-whatsapp" label="WhatsApp" type="tel" autoComplete="tel" placeholder="55 + DDD + número" value={input.whatsapp} maxLength={24} onChange={(event) => change('whatsapp', event.target.value)} />
            <p className="field-help">Obrigatório antes da publicação. Você pode completar depois, no rascunho.</p>
            <FormField id="business-instagram" label="Instagram (opcional)" placeholder="usuario" value={input.instagram} maxLength={31} onChange={(event) => change('instagram', event.target.value)} />
            {input.type === 'empresa' && <details className="private-details" open={Boolean(input.legalName || input.taxId) || undefined}><summary><ShieldCheck size={18} aria-hidden="true" />Dados empresariais privados <span>Opcional</span></summary>
              <fieldset className="legal-fields"><legend className="visually-hidden">Dados empresariais privados</legend><p className="field-help">Razão social e CNPJ não aparecem no perfil público.</p>
                <FormField id="business-legal-name" label="Razão social" value={input.legalName} maxLength={200} onChange={(event) => change('legalName', event.target.value)} />
                <FormField id="business-tax-id" label="CNPJ" value={input.taxId} inputMode="numeric" maxLength={18} onChange={(event) => change('taxId', event.target.value)} />
              </fieldset>
            </details>}
            <section aria-label="Revisão do cadastro" className="registration-review">
              <h3>Revise seu perfil</h3>
              <dl><dt>Nome</dt><dd>{input.name}</dd><dt>Tipo</dt><dd>{input.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</dd>
                <dt>Categoria</dt><dd>{catalog.categories.find((category) => category.id === input.categoryId)?.name}</dd>
                <dt>Cidade de origem</dt><dd>{catalog.cities.filter(city => city.id === input.cityId).map(city => `${city.name}/${city.state_code}`)}</dd>
                <dt>Atendimento</dt><dd>{catalog.cities.filter((city) => normalizeRegistration(input).areaCityIds.includes(city.id)).map((city) => `${city.name}/${city.state_code}`).join(', ')}</dd>
              </dl>
              <p className="field-help">Este perfil não será publicado automaticamente. Não há cobrança nesta etapa.</p>
            </section>
          </>}
        </fieldset>
        <div className="registration-actions">
          {step > 1 && <button className="button button--secondary" type="button" disabled={pending} onClick={() => { setError(null); setStep(step - 1); }}><ArrowLeft size={17} aria-hidden="true" />Voltar</button>}
          <button className="button button--primary" type="submit" disabled={pending || catalog.categories.length === 0 || catalog.cities.length === 0}>{pending ? 'Salvando…' : step === 3 ? 'Salvar rascunho' : 'Continuar'}{step < 3 && <ArrowRight size={17} aria-hidden="true" />}</button>
        </div>
      </form>
      <p className="registration-assurance"><ShieldCheck size={16} aria-hidden="true" />Ao concluir, seu perfil será salvo como rascunho. Sem publicação ou cobrança automática.</p>
    </>}
    <Link className="text-link" to="/conta/profissional">Voltar ao espaço profissional</Link>
  </div>;
}
