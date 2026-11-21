// Dois builds reais no mesmo localhost; nenhuma publicação Vercel ou acesso ao Supabase.
import {build} from 'vite';import react from '@vitejs/plugin-react';import {buildPwa} from './build-pwa.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join,extname} from 'node:path';import http from 'node:http';
const directory=await mkdtemp(join(tmpdir(),'pereirao-pwa-qa-')),repo=resolve('.');
for(const label of ['A','B']){const outDir=join(directory,label);await build({configFile:false,root:resolve('scripts/fixtures/pwa'),publicDir:resolve('public'),plugins:[react()],define:{__QA_LABEL__:JSON.stringify(label)},build:{outDir,emptyOutDir:true}});console.log(label,await buildPwa(outDir));}
let active=process.argv.includes('--latest')?'B':'A';const mime={'.html':'text/html','.json':'application/json','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1:5196');
 if(url.pathname==='/qa/publish'&&req.method==='POST'){active='B';res.writeHead(200,{'Cache-Control':'no-store'});res.end('B');return;}
 if(req.method!=='GET'||url.pathname.startsWith('/api')){res.writeHead(403);res.end('Blocked');return;}
 let path=url.pathname;if(path.includes('..')){res.writeHead(400);res.end();return;}
 let data;try{data=await readFile(join(directory,active,path));}catch{if(extname(path)){res.writeHead(404);res.end();return;}path='/index.html';data=await readFile(join(directory,active,path));}
 res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-store'});res.end(data);
});server.listen(5196,'127.0.0.1',()=>console.log('QA READY http://127.0.0.1:5196 · current A'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
