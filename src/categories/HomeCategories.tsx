import { CategoryTile } from '../components/CategoryTile';
import { categoryImage, homeCategoryIds } from '../config/categories';
import { useCategoryCatalog } from './catalog';
import { AllCategoriesContent } from './AllCategories';

export function HomeCategories() {
  const catalog=useCategoryCatalog();
  const active=new Map(catalog.data?.map(item=>[item.id,item])??[]);
  const popular=homeCategoryIds.flatMap(id=>{const item=active.get(id);return item?[{...item,officialImage:categoryImage(id)}]:[];});
  return <section className="home-section" aria-labelledby="categories-title">
    <h2 id="categories-title">Categorias populares</h2>
    {catalog.loading&&<p role="status">Carregando categorias…</p>}
    {catalog.error&&<p role="status">Não foi possível carregar o catálogo. <button className="text-link" onClick={catalog.retry}>Tentar novamente</button></p>}
    {!catalog.loading&&!catalog.error&&!popular.length&&<p role="status">Catálogo indisponível neste momento.</p>}
    {!catalog.error&&<ul className="category-grid category-grid--twelve">{popular.map(category=><li key={category.id}><CategoryTile category={category}/></li>)}</ul>}
    <AllCategoriesContent catalog={catalog}/>
  </section>;
}
