-- Pós-aplicação no MESMO cluster descartável; compara conteúdo integral, não só contagens.
select test.assert_true((select data=test.specialty_data_snapshot() from test.specialty_migration_snapshot),'migração especialidades: negócios, datas, categorias, membros, serviços, imagens, publicações e políticas anteriores intactos');
select test.assert_true((select count(*)=0 from public.business_categories),'migração especialidades: nenhuma adicional inventada ou backfill de negócios');
-- Limpeza apenas das fixtures recém-criadas neste cluster, antes das demais suites.
delete from public.businesses where id in ('00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000913');
delete from auth.users where id='00000000-0000-4000-8000-000000000911';
delete from public.categories where id='legada-inativa';
