// Loopback apenas; não cria servidor na rede pública, sessões ou dados remotos.
import{createServer}from'vite';import{resolve}from'node:path';
const server=await createServer({root:resolve('scripts/fixtures/social-demo'),configFile:resolve('vite.config.ts'),publicDir:resolve('public'),define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5201,strictPort:true,fs:{allow:[resolve('.')]}}});await server.listen();console.log('Demonstração SIMULADA local: http://127.0.0.1:5201 — Ctrl+C encerra; nenhum Auth/Supabase.');
