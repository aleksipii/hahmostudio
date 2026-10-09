import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',publicDir:false,plugins:[react()],build:{outDir:'dist-team-preview',rollupOptions:{input:'docs/tiimi/preview.html'}}});
