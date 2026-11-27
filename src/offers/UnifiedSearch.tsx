import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { CitySelect } from "../locations/CitySelect";
import { useMarketplace } from "../marketplace/MarketplaceProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";
import { QueryStatus } from "../marketplace/QueryStatus";
import { Pagination } from "../marketplace/Pagination";
import { pageNumber, readFilters } from "../marketplace/validation";
import { useCategoryCatalog } from '../categories/catalog';
import { formatPrice } from "../work/validation";
import { useOffers, offersError } from "./OffersProvider";
import { kindLabel } from "./model";
import type { ResultKind } from "./model";
const tabs = [
  ["", "Tudo"],
  ["service", "Serviços"],
  ["product", "Produtos"],
  ["provider", "Profissionais"],
  ["project", "Projetos"],
] as const;
export function UnifiedSearch() {
  const [params, setParams] = useSearchParams(),
    repository = useOffers(),
    market = useMarketplace();
  const q = (params.get("q") ?? "").trim().slice(0, 200),
    city = params.get("cidade") ?? "mundo-novo-ms",
    area = readFilters(params).categoryId,
    kind = (
      tabs.some(([id]) => id === params.get("resultado"))
        ? params.get("resultado")
        : ""
    ) as ResultKind | "",
    page = pageNumber(params.get("pagina")),
    type = ["autonomo", "empresa"].includes(params.get("tipo") ?? "")
      ? params.get("tipo")!
      : "";
  const [term, setTerm] = useState(q),
    [cityInput, setCityInput] = useState(city === "todas" ? "" : city),
    [areaInput,setAreaInput]=useState(area);
  useEffect(() => {
    setTerm(q);
    setCityInput(city === "todas" ? "" : city);
    setAreaInput(area);
  }, [q, city, area]);
  const catalog = useCategoryCatalog();
  const loadCities = useCallback(
    () => (market ? market.getCities() : Promise.resolve([])),
    [market],
  );
  const cities = usePublicQuery("cities", loadCities);
  const load = useCallback(
    () =>
      repository
        ? repository.search({
            query: q,
            city,
            area,
            kind,
            page,
            providerType: type,
          })
        : Promise.resolve([]),
    [repository, q, city, area, kind, page, type],
  );
  const state = usePublicQuery(
    JSON.stringify([q, city, area, kind, page, type]),
    load,
  );
  function changeTab(value: string) {
    const next = new URLSearchParams(params);
    next.set("resultado", value);
    next.delete("pagina");
    setParams(next);
  }
  return (
    <div className="public-marketplace">
      <PageHeader title="Buscar">
        <p>Serviços, produtos, profissionais e projetos públicos.</p>
      </PageHeader>
      <form
        key={params.toString()}
        role="search"
        className="public-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            next = new URLSearchParams();
          if (term.trim()) next.set("q", term.trim());
          next.set("cidade", cityInput || "todas");
          const a = String(values.get("area") ?? "");
          if (a) next.set("categoria", a);
          const t = String(values.get("tipo") ?? "");
          if (t) next.set("tipo", t);
          if (kind) next.set("resultado", kind);
          setParams(next);
        }}
      >
        <label className="form-field public-search-input">
          O que você procura?
          <input
            name="q"
            type="search"
            maxLength={200}
            defaultValue={q}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Telhados, câmera, tinta…"
          />
        </label>
        <label className="form-field">
          Área
          <select name="area" value={areaInput} onChange={e=>setAreaInput(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areaInput && !catalog.data?.some(a=>a.id===areaInput) && <option value={areaInput}>{catalog.loading?'Carregando categoria…':'Categoria indisponível'}</option>}
            {catalog.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <CitySelect
          id="offers-city"
          label="Cidade atendida"
          cities={(cities.data ?? []).map((c) => ({
            ...c,
            stateCode: c.state,
          }))}
          value={cityInput}
          onChange={setCityInput}
          emptyLabel="Todas as cidades"
        />
        <label className="form-field">
          Tipo de prestador
          <select name="tipo" defaultValue={type}>
            <option value="">Todos</option>
            <option value="autonomo">Autônomos</option>
            <option value="empresa">Empresas</option>
          </select>
        </label>
        <button className="button button--primary">Pesquisar</button>
      </form>
      <nav className="offer-filter-tabs" aria-label="Tipos de resultado">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={kind === id}
            onClick={() => changeTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <QueryStatus {...state} />
      {(catalog.error || state.error) && (
        <p role="status">{offersError(catalog.error || state.error)}{catalog.error && <button type="button" className="text-link" onClick={catalog.retry}>Recarregar categorias</button>}</p>
      )}
      {state.data && (
        <>
          <p className="field-help">
            Correspondência no nome primeiro; somente atividades declaradas.
            Projetos sem cidade pública aparecem em Todas as cidades.
          </p>
          {!state.data.length && (
            <p>Nenhum resultado público para estes filtros.</p>
          )}
          <ul className="offer-search-results">
            {state.data.slice(0, 20).map((r) => (
              <li key={`${r.kind}:${r.url}`}>
                <span className="offer-kind">{kindLabel[r.kind]}</span>
                <h2>
                  <Link to={r.url}>{r.title}</Link>
                </h2>
                <p>{r.author}</p>
                <p>{r.description}</p>
                {r.pricing_type && (
                  <strong>
                    {formatPrice(r.pricing_type, r.price_amount_cents)}
                  </strong>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            hasNext={state.data.length > 20}
            onChange={(p) => {
              const next = new URLSearchParams(params);
              next.set("pagina", String(p));
              setParams(next);
            }}
            label="resultados"
          />
        </>
      )}
    </div>
  );
}
