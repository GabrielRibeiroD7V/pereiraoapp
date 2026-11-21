// Ensaio de migração com fontes históricas REAIS do PWA. Nenhum acesso remoto ou credencial.
import {build} from 'vite';import react from '@vitejs/plugin-react';import {buildPwa} from './build-pwa.mjs';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join,extname} from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import http from 'node:http';
const directory=await mkdtemp(join(tmpdir(),'pereirao-legacy-')),repo=resolve('.');
const releases={pr19:'d58980d9460b7febafb0d4759109c82a0cee5a88',pr20:'cd0410c0834567e63a183465d564e8f46bb18790',pr21:'d5176a53c61f7f274d83bad309596436077aad9c',pr22:'2b33b3b0c36a3f441c5dbc58e05bb75bc08f0a7a',fix:null};
for(const [label,commit] of Object.entries(releases)){
 const historical=new Map();if(commit)for(const path of ['src/pwa/controller.ts','src/pwa/PwaProvider.tsx','src/styles/_pwa.scss']){
  let source=execFileSync('git',['show',`${commit}:${path}`],{encoding:'utf8'});if(path.endsWith('PwaProvider.tsx'))source+='\nexport function VersionDiagnostics(){return null;}';historical.set(resolve(path),source);
 }
 const outDir=join(directory,label);await build({configFile:false,root:resolve('scripts/fixtures/pwa'),publicDir:resolve('public'),plugins:[{name:'historical-pwa',enforce:'pre',load(id){return historical.get(id.split('?')[0]);}},react()],define:{__QA_LABEL__:JSON.stringify(label)},build:{outDir,emptyOutDir:true}});
 if(commit){const scripts=join(directory,'generator-'+label,'scripts');await mkdir(scripts,{recursive:true});await mkdir(join(directory,'generator-'+label,'src/pwa'),{recursive:true});await writeFile(join(scripts,'build-pwa.mjs'),execFileSync('git',['show',`${commit}:scripts/build-pwa.mjs`]));await writeFile(join(directory,'generator-'+label,'src/pwa/service-worker.js'),execFileSync('git',['show',`${commit}:src/pwa/service-worker.js`]));const generator=await import(pathToFileURL(join(scripts,'build-pwa.mjs')));console.log(label,await generator.buildPwa(outDir));}
 else console.log(label,await buildPwa(outDir));
}
let active='pr19';const mime={'.html':'text/html','.json':'application/json','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1:5197');const next=url.pathname.match(/^\/qa\/release\/(pr19|pr20|pr21|pr22|fix)$/)?.[1];
 if(next&&req.method==='POST'){active=next;res.writeHead(200,{'Cache-Control':'no-store'});res.end(next);return;}
 if(url.pathname==='/qa/publish'&&req.method==='POST'){active='fix';res.writeHead(200,{'Cache-Control':'no-store'});res.end(active);return;}
 if(req.method!=='GET'||url.pathname.startsWith('/api')){res.writeHead(403);res.end('Blocked');return;}
 let path=url.pathname,data;if(path.includes('..')){res.writeHead(400);res.end();return;}try{data=await readFile(join(directory,active,path));}catch{if(extname(path)){res.writeHead(404);res.end();return;}path='/index.html';data=await readFile(join(directory,active,path));}
 if(path==='/index.html')data=data.toString().replace('<body>',`<body><p style="font:12px system-ui;padding:8px;text-align:center;background:#fff4ba">Ensaio técnico local · release servida ${active} · sem banco. Não é produção.</p><nav aria-label="Publicar release local">${Object.keys(releases).map(label=>`<button onclick="fetch('/qa/release/${label}',{method:'POST'}).then(()=>document.getElementById('release-result').textContent='Servidor local: ${label}')">Publicar ${label}</button>`).join(' ')} <output id="release-result"></output></nav>`);
 res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-store'});res.end(data);
});server.listen(5197,'127.0.0.1',()=>console.log('LEGACY QA READY http://127.0.0.1:5197 · pr19'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
