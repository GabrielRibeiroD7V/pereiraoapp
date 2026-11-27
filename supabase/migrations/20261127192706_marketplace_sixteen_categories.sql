-- PROPOSTA: catálogo aditivo e busca por categorias declaradas. Nenhum conteúdo é publicado.
begin;
set local lock_timeout='5s';
-- Não atualiza nomes, IDs ou estados de nenhuma categoria existente.
insert into public.categories(id,name) values
 ('serralheria-metalurgica','Serralheria e Metalúrgica'),
 ('mecanica-automotivo','Mecânica e Automotivo'),
 ('jardinagem-paisagismo','Jardinagem e Paisagismo'),
 ('beleza-estetica','Beleza e Estética')
on conflict(id) do nothing;
-- Mantém as áreas de ofertas compatíveis com o catálogo de categorias (mesmos IDs).
insert into public.offer_areas(id,name) values
 ('serralheria-metalurgica','Serralheria e Metalúrgica'),
 ('mecanica-automotivo','Mecânica e Automotivo'),
 ('jardinagem-paisagismo','Jardinagem e Paisagismo'),
 ('beleza-estetica','Beleza e Estética')
on conflict(id) do nothing;

-- Mantém assinatura, privilégios, moderação e projeção pública da RPC existente.
-- Categorias classificam perfis/projetos, sem inferir ofertas não cadastradas.
create or replace function public.search_unified(p_query text default '',p_city text default '',p_area text default '',p_kind text default '',p_page integer default 1,p_provider_type text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if char_length(p_query)>200 or p_page not between 1 and 1000 or p_kind not in ('','service','product','provider','project') or p_provider_type not in ('','autonomo','empresa') then raise exception 'Invalid filters' using errcode='22023';end if;
 return coalesce((with eligible as (
 select b.* from public.businesses b where private.business_is_public(b.id) and (p_provider_type='' or b.type=p_provider_type)
 and (p_city in ('','todas') or exists(select 1 from public.business_service_areas a where a.business_id=b.id and a.city_id=p_city))
 ), offers as (
 select o.*,b.name author,b.slug,coalesce(a.terms,'') activity_terms,private.offer_score(p_query,o.name,a.terms,o.description) score
 from private.offer_rows() o join eligible b on b.id=o.business_id
 left join lateral(select string_agg(x.name||' '||x.terms,' ') terms from public.offer_activities x where x.id=any(o.activity_ids) and x.active)a on true
 where o.active and (o.source='legacy' or private.offer_public(o.id)) and (p_area='' or o.area_id=p_area or exists(select 1 from public.offer_activity_areas aa where aa.activity_id=any(o.activity_ids) and aa.area_id=p_area))
 ), results as (
 select o.id,o.kind,o.name title,o.description,o.author,'/ofertas/'||o.source||'/'||o.id::text url,o.business_id,o.pricing_type,o.price_amount_cents,o.score from offers o where o.score>0
 union all
 select b.id,'provider',b.name,coalesce(b.description,''),b.name,'/prestadores/'||b.slug,b.id,null,null,greatest(private.offer_score(p_query,b.name,coalesce(bp.profession,'')||' '||coalesce((select string_agg(ca.name||' '||ca.id,' ') from public.categories ca where ca.active and (ca.id=b.category_id or exists(select 1 from public.business_categories bc where bc.business_id=b.id and bc.category_id=ca.id))),''),''),coalesce((select max(score)-1 from offers where business_id=b.id),0))
 from eligible b left join public.business_presentations bp on bp.business_id=b.id where (p_area='' or exists(select 1 from public.categories ca where ca.active and ca.id=p_area and (ca.id=b.category_id or exists(select 1 from public.business_categories bc where bc.business_id=b.id and bc.category_id=ca.id))) or exists(select 1 from offers where business_id=b.id))
 union all
 select w.id,'project',w.title,w.description,b.name,'/trabalhos/'||w.id::text,case when private.business_is_public(b.id) then b.id else null end,null,null,private.offer_score(p_query,w.title,'',w.description)
 from public.work_posts w join public.businesses b on b.id=w.business_id where private.work_post_is_public(w.id)
 and (p_provider_type='' or b.type=p_provider_type) and (p_city in ('','todas') or exists(select 1 from eligible where id=b.id)) and (p_area='' or exists(select 1 from public.categories ca where ca.active and ca.id=p_area and (ca.id=b.category_id or exists(select 1 from public.business_categories bc where bc.business_id=b.id and bc.category_id=ca.id))) or exists(select 1 from offers where business_id=b.id))
 union all
 select p.id,'project',p.title,p.description,coalesce(nullif(pr.display_name,''),'Pessoa no PEREIRÃO'),'/publicacoes/'||p.id::text,null::uuid,null,null,private.offer_score(p_query,p.title,'',p.description)
 from public.personal_posts p left join public.profiles pr on pr.id=p.author_id where private.personal_post_public(p.id) and p_city in ('','todas') and p_area='' and p_provider_type=''
 ) select jsonb_agg(to_jsonb(x) order by score desc,title,id,kind) from (select * from results where score>0 and (p_kind='' or kind=p_kind) order by score desc,title,id,kind limit 21 offset (p_page-1)*20)x),'[]'::jsonb);
end;$$;
revoke all on function public.search_unified(text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.search_unified(text,text,text,text,integer,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
