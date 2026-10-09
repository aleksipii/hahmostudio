import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/',publicDir:false,plugins:[react()],build:{outDir:'dist-team-preview',rollupOptions:{input:{samples:'docs/tiimi/preview.html',editor:'docs/tiimi/editor-preview.html'}}}});
