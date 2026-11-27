import { Link } from 'react-router-dom';
import { useCategoryCatalog } from './catalog';
import { categoryImage } from '../config/categories';
import './categories.scss';

export function AllCategories() {
  const catalog=useCategoryCatalog();
  return <details className="all-categories">
    <summary>Ver todas as categorias</summary>
    {catalog.loading && <p role="status">Carregando categorias…</p>}
    {catalog.error && <p role="status">Não foi possível carregar as categorias. <button type="button" className="text-link" onClick={catalog.retry}>Tentar novamente</button></p>}
    {!catalog.loading && !catalog.error && !catalog.data?.length && <p role="status">Catálogo indisponível neste momento.</p>}
    <ul aria-label="Todas as categorias">{catalog.data?.map(item=><li key={item.id}><Link to={`/buscar?${new URLSearchParams({categoria:item.id})}`}>
      {categoryImage(item.id) && <img src={categoryImage(item.id)!.src} width="48" height="34" alt="" loading="lazy" />}
      <span>{item.name}</span>
    </Link></li>)}</ul>
  </details>;
}
