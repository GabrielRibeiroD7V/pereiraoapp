import { testSpecialtyConcurrency } from './test-specialty-concurrency.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
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
    const specialties = file === '20261121193603_business_specialties.sql';
    if (specialties) run(executable('psql'), [...args, '-f', resolve('supabase/tests/specialties_migration_before.sql')], true);
    run(executable('psql'), [...args, '-f', resolve('supabase/migrations', file)], true);
    if (specialties) run(executable('psql'), [...args, '-f', resolve('supabase/tests/specialties_migration_after.sql')]);
  }
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/rls.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/storage.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/marketplace.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/work_posts.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/admin.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/subscriptions.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/sandbox_billing.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/admin_bootstrap.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/regional_cities.sql')]);
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/business_specialties.sql')]);
  await testSpecialtyConcurrency(executable('psql'), args);
  console.log('SQL e RLS: testes concluídos em PostgreSQL isolado; nenhum projeto remoto foi acessado.');
} finally {
  if (started) run(executable('pg_ctl'), ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], true);
  // Diretório criado exclusivamente por este processo, nunca contém dados do usuário.
  rmSync(root, { recursive: true, force: true });
}
