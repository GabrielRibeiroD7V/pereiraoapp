// Native disposable PostgreSQL; no remote connection or Docker accepted.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const bin=process.env.PG_BIN??'',exe=n=>bin?join(bin,n):n;
const root=mkdtempSync(join(tmpdir(),'pereirao-personal-')),socket=join(root,'socket');mkdirSync(socket);
let started=false;
function run(name,args,quiet=false){const r=spawnSync(exe(name),args,{encoding:'utf8'});if(r.status!==0||r.error)throw Error(`${name} failed: ${r.error??''} ${r.stdout??''} ${r.stderr??''}`);if(!quiet){process.stdout.write(r.stdout);process.stderr.write(r.stderr);}}
try{
 run('initdb',['-D',join(root,'data'),'-A','trust','-U','postgres','--no-locale','-E','UTF8'],true);
 run('pg_ctl',['-D',join(root,'data'),'-l',join(root,'postgres.log'),'-o',`-k ${socket} -h '' -p 54326`,'-w','start'],true);started=true;
 const args=['-X','-qAt','-h',socket,'-p','54326','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
 run('psql',[...args,'-f',resolve('supabase/tests/bootstrap.sql')],true);
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())run('psql',[...args,'-f',resolve('supabase/migrations',f)],true);
 run('psql',[...args,'-f',resolve('supabase/tests/personal_posts.sql')]);
 console.log('Personal posts SQL: passed in disposable native PostgreSQL, no remote access.');
}finally{if(started)run('pg_ctl',['-D',join(root,'data'),'-m','immediate','-w','stop'],true);rmSync(root,{recursive:true,force:true});}
