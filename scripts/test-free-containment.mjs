// Recebe somente o executável/argumentos do cluster local criado pelos runners.
import{spawnSync}from'node:child_process';import{resolve}from'node:path';
export function testFreeContainment(executable,args){
 const psql=executable('psql'),file=resolve('supabase/operations/initial_free_phase_containment.sql');
 const run=(more)=>{const r=spawnSync(psql,[...args,...more],{encoding:'utf8'});if(r.error||r.status!==0)throw new Error(r.stderr||r.error?.message);if(r.stdout?.trim())process.stdout.write(r.stdout);if(r.stderr)process.stdout.write(r.stderr);};
 run(['-c','delete from private.platform_access_policy;']);
 const failed=spawnSync(psql,[...args,'-f',file],{encoding:'utf8'});
 if(failed.status===0||!failed.stderr.includes('Rollback policy metadata unavailable'))throw new Error('Contenção deve recusar rollback sem metadata');
 run(['-c',"select test.assert_true(to_regprocedure('private.reject_financial_write_during_free_phase()') is not null,'free: rollback sem metadata recusado mantém proteção'); insert into private.platform_access_policy(singleton) values(true);"]);
 run(['-f',file]);
 run(['-c',"select test.assert_true(to_regprocedure('public.platform_access_status()') is null and (select count(*)=1 from private.platform_access_policy),'free: reversão anterior a publicação conserva metadados');"]);
}
