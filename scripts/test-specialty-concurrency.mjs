// Ensaio real de locks em DUAS conexões do cluster temporário, nunca em Supabase remoto.
import { spawn, spawnSync } from 'node:child_process';
const uid = '00000000-0000-4000-8000-000000000901';
export async function testSpecialtyConcurrency(psql, args) {
  function sql(text) {
    const r = spawnSync(psql, [...args, '-c', text], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'Concurrency SQL failed');
    return r.stdout.trim();
  }
  sql(`begin; insert into auth.users(id,raw_user_meta_data) values ('${uid}','{}'); set local role authenticated; set local request.jwt.claim.sub='${uid}'; select public.create_business('Concorrência técnica','concorrencia-especialidades','autonomo','mundo-novo-ms'); commit;`);
  const id = sql("select id from public.businesses where slug='concorrencia-especialidades'");
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid local fixture ID');
  sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${uid}'; select public.set_business_specialties('${id}','construcao',array['pintura'],null,'{}'); commit;`);
  function connect(name) {
    const child = spawn(psql, [...args, '-v', 'VERBOSITY=verbose'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const state = { child, out: '', error: '', code: null };
    child.stdout.on('data', d => state.out += d.toString()); child.stderr.on('data', d => state.error += d.toString());
    state.done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => { state.code = code; resolve(code); }); });
    child.stdin.write(`set application_name='${name}'; begin; set local role authenticated; set local request.jwt.claim.sub='${uid}';\n`);
    return state;
  }
  async function until(check, label) {
    const deadline = Date.now() + 10_000;
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error(`Timeout: ${label}`);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  async function pair(aRequest, bRequest, expectConflict) {
    const a = connect('pereirao-specialties-a'), b = connect('pereirao-specialties-b');
    try {
      a.child.stdin.write(aRequest + "; select 'A_UPDATED';\n");
      await until(() => { if (a.code !== null) throw new Error(a.error); return a.out.includes('A_UPDATED'); }, 'first writer');
      b.child.stdin.write(bRequest + "; commit;\n\\q\n");
      await until(() => {
        if (b.code !== null) throw new Error('Second connection did not wait: ' + b.error);
        return sql("select count(*) from pg_stat_activity where application_name='pereirao-specialties-b' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0") === '1';
      }, 'row lock');
      console.log('PASS: concorrência: segunda conexão aguarda o lock do mesmo negócio');
      a.child.stdin.end('commit;\n\\q\n');
      await Promise.all([a.done, b.done]);
      if (a.code !== 0) throw new Error(a.error);
      if (expectConflict ? !(b.code !== 0 && /40001/.test(b.error)) : b.code !== 0) throw new Error('Unexpected concurrent result: ' + b.error);
      console.log(expectConflict ? 'PASS: concorrência: edição obsoleta recebe SQLSTATE 40001' : 'PASS: concorrência: duas tentativas iguais são idempotentes');
    } finally { for (const c of [a,b]) { if (c.code === null) c.child.kill('SIGTERM'); } }
  }
  await pair(
    `select public.set_business_specialties('${id}','construcao',array['pintura','eletrica'],'construcao',array['pintura'])`,
    `select public.set_business_specialties('${id}','construcao',array['pintura','limpeza'],'construcao',array['pintura'])`, true);
  if (sql(`select string_agg(category_id,',' order by category_id) from public.business_categories where business_id='${id}'`) !== 'eletrica,pintura') throw new Error('Lost or mixed update');
  console.log('PASS: concorrência: conjunto vencedor preservado sem mistura ou perda');
  const same = `select public.set_business_specialties('${id}','construcao',array['pintura','eletrica','limpeza'],'construcao',array['pintura','eletrica'])`;
  await pair(same, same, false);
  if (sql(`select count(*) from public.business_categories where business_id='${id}'`) !== '3') throw new Error('Duplicate concurrent category');
  console.log('PASS: concorrência: conjunto único após duas gravações iguais');
}
