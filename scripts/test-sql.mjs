import {testFreeContainment} from './test-free-containment.mjs';
import { testSpecialtyConcurrency } from './test-specialty-concurrency.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Não aceita URL de conexão: só inicia e testa um cluster temporário sem TCP.
const bin = process.env.PG_BIN ?? '';
const executable = (name) => bin ? join(bin, name) : name;
const root = mkdtempSync(join(tmpdir(), 'pereirao-sql-'));
const socket = join(root, 'socket');
mkdirSync(socket);
let started = false;
function run(command, args, quiet = false) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} falhou: ${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  if (!quiet && result.stdout?.trim()) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stdout.write(result.stderr);
}
try {
  run(executable('initdb'), ['-D', join(root, 'data'), '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'], true);
  run(executable('pg_ctl'), ['-D', join(root, 'data'), '-l', join(root, 'postgres.log'), '-o', `-k ${socket} -h '' -p 54329`, '-w', 'start'], true);
  started = true;
  const args = ['-X', '-qAt', '-h', socket, '-p', '54329', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/bootstrap.sql')], true);
  for (const file of readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql')).sort()) {
    if(file.endsWith('_marketplace_sixteen_categories.sql'))continue; // Depende de offers_unified_search, aplicada abaixo.
    if (file.endsWith('_admin_monetization_policy.sql')) continue;
    if (file.endsWith('_sandbox_monthly_1990.sql')) continue;
    if (file.endsWith('_offers_unified_search.sql') || file.endsWith('_realtime_messaging_and_notifications.sql')) continue;
    if (file.endsWith('_owner_publication.sql') || file.endsWith('_personal_posts.sql') || file.endsWith('_account_conversations.sql')) continue;
    if (file === '20261124163000_initial_free_phase.sql') continue; // Testa atualização após a arquitetura anterior, abaixo.
    const storageGuard = file === '20261123000107_fix_profile_storage_guard.sql';
    if(storageGuard)run(executable('psql'), [...args, '-v', 'guard_fixed=false', '-f', resolve('supabase/tests/profile_storage_phase.sql')]);
    const specialties = file === '20261121193603_business_specialties.sql';
    if (specialties) run(executable('psql'), [...args, '-f', resolve('supabase/tests/specialties_migration_before.sql')], true);
    run(executable('psql'), [...args, '-f', resolve('supabase/migrations', file)], true);
    if (specialties) run(executable('psql'), [...args, '-f', resolve('supabase/tests/specialties_migration_after.sql')]);
    if(storageGuard)run(executable('psql'), [...args, '-v', 'guard_fixed=true', '-f', resolve('supabase/tests/profile_storage_phase.sql')]);
  }
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/rls.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/storage.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/marketplace.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/work_posts.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/admin.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/subscriptions.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/billing_exemption.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/internal_messages.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/sandbox_billing.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/admin_bootstrap.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/regional_cities.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/business_specialties.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/profile_images.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/business_presentation.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/admin_review_catalog.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/business_profession_linkedin.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/post_direct_photos.sql')]);
  await testSpecialtyConcurrency(executable('psql'), args);
  run(executable('psql'), [...args, '-f', resolve('supabase/migrations/20261124163000_initial_free_phase.sql')], true);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/initial_free_phase.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/production_billing.sql')]);
  testFreeContainment(executable,args);
  for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('_owner_publication.sql')||f.endsWith('_personal_posts.sql')||f.endsWith('_account_conversations.sql')).sort()){
    run(executable('psql'), [...args,'-f',resolve('supabase/migrations',file)],true);
    run(executable('psql'), [...args,'-f',resolve('supabase/tests',file.endsWith('_owner_publication.sql')?'owner_publication.sql':file.endsWith('_personal_posts.sql')?'personal_posts.sql':'account_conversations.sql')]);
  }
  run(executable('psql'), [...args,'-f',resolve('supabase/migrations/20261125183249_offers_unified_search.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/offers_unified_search.sql')]);
  // A migração depende de account_conversations. Antes ela era pulada e nunca aplicada.
  // Infraestrutura de transporte é simulada explicitamente, sem rede ou segredos reais.
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/notifications_bootstrap.sql')],true);
  const notificationSql=readFileSync('supabase/migrations/20261125131147_realtime_messaging_and_notifications.sql','utf8');
  const extensionLine='create extension if not exists pg_net with schema extensions;';
  if(notificationSql.split(extensionLine).length!==2)throw new Error('Revisar preparação local da extensão pg_net.');
  const localNotificationSql=join(root,'notifications.sql');
  writeFileSync(localNotificationSql,notificationSql.replace(extensionLine,'-- pg_net simulado no bootstrap local, sem HTTP.'));
  run(executable('psql'), [...args,'-f',localNotificationSql],true);
  // Revalidar os dois canais porque a migração substitui funções de ambos.
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/internal_messages.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/account_conversations.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/notifications.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/categories_before.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/migrations/20261127192706_marketplace_sixteen_categories.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/migrations/20261127192706_marketplace_sixteen_categories.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/categories_sixteen.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/registration_matrix.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/migrations/20261127192500_admin_monetization_policy.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/admin_monetization.sql')]);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/sandbox_monthly_before.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/migrations/20261127193500_sandbox_monthly_1990.sql')],true);
  run(executable('psql'), [...args,'-f',resolve('supabase/tests/sandbox_monthly_1990.sql')]);
  console.log('SQL e RLS: testes concluídos em PostgreSQL isolado; nenhum projeto remoto foi acessado.');
} finally {
  if (started) run(executable('pg_ctl'), ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], true);
  // Diretório criado exclusivamente por este processo, nunca contém dados do usuário.
  rmSync(root, { recursive: true, force: true });
}
