import {testFreeContainment} from './test-free-containment.mjs';
// Execução focada da nova fase: DDL compatível + somente testes desta mudança.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Não aceita URL de conexão: só inicia e testa um cluster temporário sem TCP.
const bin = process.env.PG_BIN ?? '';
const executable = (name) => bin ? join(bin, name) : name;
const root = mkdtempSync(join(tmpdir(), 'pereirao-free-phase-'));
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
  for (const file of readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort()) {
    run(executable('psql'), [...args, '-f', resolve('supabase/migrations', file)], true);
  }
  run(executable('psql'), [...args, '-f', resolve('supabase/tests/initial_free_phase.sql')]);
  testFreeContainment(executable,args);
  console.log('SQL e RLS: testes concluídos em PostgreSQL isolado; nenhum projeto remoto foi acessado.');
} finally {
  if (started) run(executable('pg_ctl'), ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], true);
  // Diretório criado exclusivamente por este processo, nunca contém dados do usuário.
  rmSync(root, { recursive: true, force: true });
}
