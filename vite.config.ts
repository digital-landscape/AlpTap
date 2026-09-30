import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], worker: { format: 'es' }, server: { proxy: { '/v2': 'http://127.0.0.1:8787', '/v1': 'http://127.0.0.1:8787' } }, build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('maplibre-gl') ? 'maplibre' : undefined } } } });
