// Artefato sintético disponível somente em Preview; nunca na produção ou precache.
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
if(process.env.VERCEL_ENV==='preview')await build({configFile:false,root:resolve('scripts/fixtures/admin-review'),base:'/qa/admin-review/',publicDir:false,plugins:[react()],define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},build:{outDir:resolve('dist/qa/admin-review'),emptyOutDir:true}});
