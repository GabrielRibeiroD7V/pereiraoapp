// Apenas servidor local. Não controla navegador nem utiliza credenciais reais.
import {createServer} from 'vite';
import {resolve} from 'node:path';
const server=await createServer({root:resolve('scripts/fixtures/app-audit'),configFile:resolve('vite.config.ts'),publicDir:resolve('public'),define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5207,strictPort:true,fs:{allow:[resolve('.')]}}});
await server.listen();server.printUrls();
