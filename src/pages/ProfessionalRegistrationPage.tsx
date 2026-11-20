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

const steps = ['Tipo de prestador', 'Informações profissionais', 'Contatos e revisão'];
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
      if (!businessId) clearCheckpoint(uid);
      navigate('/conta/profissional', { replace: true, state: { saved: true } });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505' && !checkpoint.current?.businessId) {
        checkpoint.current = null; clearCheckpoint(uid);
      }
      setError(professionalError(cause));
    } finally { submitting.current = false; setPending(false); }
  }

  return <div className="registration-page">
    <PageHeader title={businessId ? 'Editar perfil profissional' : 'Anunciar meus serviços'}><p>Cadastre seu perfil em três etapas. Ele será salvo como rascunho.</p></PageHeader>
    {loading && <p role="status">Carregando informações do cadastro…</p>}
    {!repository && <p role="status" className="form-notice">O cadastro ainda está sendo preparado. Continue explorando o PEREIRÃO.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {savedId && !businessId && <p className="form-notice">Seu rascunho já foi criado. Ao tentar novamente, continuaremos no mesmo perfil.</p>}
    {catalog && <>
      {(catalog.categories.length === 0 || catalog.cities.length === 0) && <p role="status" className="form-notice">Ainda não há cidade ou categoria disponível para concluir o cadastro.</p>}
      <ol className="registration-steps" aria-label="Etapas do cadastro">
        {steps.map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>{index + 1}. {label}</li>)}
      </ol>
      <h2 ref={heading} tabIndex={-1} className="registration-title">{steps[step - 1]}</h2>
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className="registration-fields">
          {step === 1 && <fieldset className="provider-choice"><legend>Como você quer anunciar?</legend>
            <label><input type="radio" name="provider_type" value="autonomo" checked={input.type === 'autonomo'} onChange={() => change('type', 'autonomo')} />Profissional autônomo</label>
            <label><input type="radio" name="provider_type" value="empresa" checked={input.type === 'empresa'} onChange={() => change('type', 'empresa')} />Empresa</label>
          </fieldset>}
          {step === 2 && <>
            <FormField id="business-name" label={input.type === 'empresa' ? 'Nome da empresa' : 'Nome profissional'} value={input.name} onChange={(event) => change('name', event.target.value)} maxLength={120} required />
            <div className="form-field"><label htmlFor="business-category">Categoria principal</label><select id="business-category" value={input.categoryId} required onChange={(event) => change('categoryId', event.target.value as RegistrationInput['categoryId'])}>
              <option value="">Selecione uma categoria</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></div>
            <div className="form-field"><label htmlFor="business-description">Descrição</label><textarea id="business-description" value={input.description} maxLength={3000} rows={4} onChange={(event) => change('description', event.target.value)} /></div>
            <div className="form-field"><label htmlFor="business-city">Cidade</label><select id="business-city" value={input.cityId} required onChange={(event) => change('cityId', event.target.value)}>
              <option value="">Selecione uma cidade</option>{catalog.cities.map((city) => <option key={city.id} value={city.id}>{city.name}/{city.state_code}</option>)}
            </select></div>
            <fieldset className="service-areas"><legend>Área de atendimento</legend>
              <p className="field-help">A cidade principal já está incluída. Selecione outras cidades atendidas, quando disponíveis.</p>
              {catalog.cities.map((city) => <label key={city.id}><input type="checkbox" checked={input.cityId === city.id || input.areaCityIds.includes(city.id)} disabled={input.cityId === city.id}
                onChange={(event) => change('areaCityIds', event.target.checked ? [...input.areaCityIds, city.id] : input.areaCityIds.filter((id) => id !== city.id))} />{city.name}/{city.state_code}</label>)}
            </fieldset>
            {input.type === 'empresa' && <fieldset className="legal-fields"><legend>Dados empresariais privados (opcional)</legend>
              <p className="field-help">Estes dados não serão exibidos no perfil público.</p>
              <FormField id="business-legal-name" label="Razão social" value={input.legalName} maxLength={200} onChange={(event) => change('legalName', event.target.value)} />
              <FormField id="business-tax-id" label="CNPJ" value={input.taxId} inputMode="numeric" maxLength={18} onChange={(event) => change('taxId', event.target.value)} />
            </fieldset>}
          </>}
          {step === 3 && <>
            <FormField id="business-whatsapp" label="WhatsApp" type="tel" autoComplete="tel" placeholder="55 + DDD + número" value={input.whatsapp} maxLength={24} onChange={(event) => change('whatsapp', event.target.value)} />
            <p className="field-help">Obrigatório antes da publicação. Você pode completar depois, no rascunho.</p>
            <FormField id="business-instagram" label="Instagram (opcional)" placeholder="usuario" value={input.instagram} maxLength={31} onChange={(event) => change('instagram', event.target.value)} />
            <section aria-label="Revisão do cadastro" className="registration-review">
              <h3>Revise seu perfil</h3>
              <dl><dt>Nome</dt><dd>{input.name}</dd><dt>Tipo</dt><dd>{input.type === 'empresa' ? 'Empresa' : 'Profissional autônomo'}</dd>
                <dt>Categoria</dt><dd>{catalog.categories.find((category) => category.id === input.categoryId)?.name}</dd>
                <dt>Atendimento</dt><dd>{catalog.cities.filter((city) => normalizeRegistration(input).areaCityIds.includes(city.id)).map((city) => `${city.name}/${city.state_code}`).join(', ')}</dd>
              </dl>
              <p className="field-help">Este perfil não será publicado automaticamente. Não há cobrança nesta etapa.</p>
            </section>
          </>}
        </fieldset>
        <div className="account-actions">
          {step > 1 && <button className="button button--secondary" type="button" disabled={pending} onClick={() => { setError(null); setStep(step - 1); }}>Voltar</button>}
          <button className="button button--primary" type="submit" disabled={pending || catalog.categories.length === 0 || catalog.cities.length === 0}>{pending ? 'Salvando…' : step === 3 ? 'Salvar rascunho' : 'Continuar'}</button>
        </div>
      </form>
    </>}
    <Link className="text-link" to="/conta/profissional">Voltar ao espaço profissional</Link>
  </div>;
}
