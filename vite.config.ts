import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { socialMetadata } from './scripts/social-metadata.ts';

export default defineConfig(({ mode }) => {
  let relativeBase = true;
  return {
    base: './',
    plugins: [
      react(),
      socialMetadata(process.env.SITE_URL || loadEnv(mode, process.cwd(), 'SITE_URL').SITE_URL || 'https://alptap.eu/'),
      {
        name: 'explore-pages',
        enforce: 'post',
        configResolved(config) {
          relativeBase = config.base === './' || config.base === '';
        },
        generateBundle(_, bundle) {
          const index = bundle['index.html'];
          if (index?.type !== 'asset') return;
          // Nested entry pages share the root page's assets, data and navigation.
          const html = typeof index.source === 'string' ? index.source : new TextDecoder().decode(index.source);
          const source = relativeBase ? html.replace('<head>', '<head><base href="../">') : html;
          for (const page of ['explore', 'training']) {
            this.emitFile({ type: 'asset', fileName: `${page}/index.html`, source });
          }
        },
      },
    ],
    worker: { format: 'es' },
    server: { proxy: { '/v2': 'http://127.0.0.1:8787', '/v1': 'http://127.0.0.1:8787' } },
    build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('maplibre-gl') ? 'maplibre' : undefined } } },
  };
});
