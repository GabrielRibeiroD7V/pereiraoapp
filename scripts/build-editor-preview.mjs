// Synthetic review page exists only in Preview builds and cannot initialize Supabase.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
if (process.env.VERCEL_ENV === 'preview') {
  await build({
    configFile: false,
    root: resolve('scripts/fixtures/profile-editor'),
    base: '/qa/profile-editor/',
    publicDir: false,
    plugins: [react()],
    define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
    build: { outDir: resolve('dist/qa/profile-editor'), emptyOutDir: true },
  });
  console.log('PROFILE_EDITOR_SYNTHETIC_PREVIEW_READY');
}
