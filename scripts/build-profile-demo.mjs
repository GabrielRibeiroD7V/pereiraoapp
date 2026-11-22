// Preview-only synthetic review. Not part of the production build or PWA precache.
import { build } from 'vite';
import { resolve } from 'node:path';
if (process.env.VERCEL_ENV === 'preview') {
 await build({root:resolve('scripts/fixtures/profile-editor'),configFile:resolve('vite.config.ts'),base:'/qa/profile-editor/',publicDir:false,define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},build:{outDir:resolve('dist/qa/profile-editor'),emptyOutDir:false}});
 console.log('Synthetic profile review built for Preview only; no Supabase configuration.');
}
