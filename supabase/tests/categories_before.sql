-- Estado anterior preservado entre a expansão e seu replay no cluster descartável.
create table test.categories_baseline as select
 (select jsonb_object_agg(id,to_jsonb(c)) from public.categories c) categories,
 (select md5(coalesce(jsonb_agg(to_jsonb(b) order by id)::text,'[]')) from public.businesses b) businesses,
 (select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) from public.services s) services,
 (select md5(coalesce(jsonb_agg(to_jsonb(bc) order by business_id,category_id)::text,'[]')) from public.business_categories bc) specialties;
