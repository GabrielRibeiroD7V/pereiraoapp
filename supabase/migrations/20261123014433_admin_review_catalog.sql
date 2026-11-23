-- PROPOSTA: leitura complementar da revisão; aplicação remota exige autorização.
begin;
create function public.admin_review_catalog(target_business uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'primaryCategory', (select jsonb_build_object('id',c.id,'name',c.name,'active',c.active)
      from public.categories c where c.id=b.category_id),
    'additionalSpecialties', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'active',c.active) order by c.name,c.id)
      from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=b.id),'[]'::jsonb),
    'originCity', (select jsonb_build_object('id',c.id,'name',c.name,'stateCode',c.state_code,'active',c.active)
      from public.cities c where c.id=b.city_id),
    'serviceCities', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'stateCode',c.state_code,'active',c.active) order by c.state_code,c.name,c.id)
      from public.business_service_areas a join public.cities c on c.id=a.city_id where a.business_id=b.id),'[]'::jsonb)
  ) into result from public.businesses b where b.id=target_business;
  if result is null then raise exception 'Business not found' using errcode='P0002'; end if;
  return result;
end;
$$;
revoke all on function public.admin_review_catalog(uuid) from public,anon,authenticated;
grant execute on function public.admin_review_catalog(uuid) to authenticated;
comment on function public.admin_review_catalog(uuid) is 'Somente administrador da plataforma ativo; leitura de classificação e atendimento declarados, sem concessão de propriedade ou verificação de credenciais.';
commit;
