import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { socialMetadata } from './scripts/social-metadata.ts';

export default defineConfig(({ mode }) => {
  let relativeBase = true;
  const siteUrl = process.env.SITE_URL || loadEnv(mode, process.cwd(), 'SITE_URL').SITE_URL || 'https://alptap.eu/';
  const exploreUrl = new URL('explore/', siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`).href;
  return {
    base: './',
    plugins: [
      react(),
      socialMetadata(siteUrl),
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
          const base = relativeBase ? html.replace('<head>', '<head><base href="../">') : html;
          // Explorer and training render the same explorer, so both declare the explorer as canonical.
          const source = base
            .replace(/<title>[^<]*<\/title>/, '<title>Explore · AlpTap</title>')
            .replace(/(<meta name="description" content=")[^"]*/, '$1Explore every peak in the AlpTap catalogue on a satellite map: locations, elevations and recorded names across the Alps and the world.')
            .replace(/(<link rel="canonical" href=")[^"]*/, `$1${exploreUrl}`)
            .replace(/<main class="static-intro">[\s\S]*?<\/main>/, '<main class="static-intro"><h1>Explore · AlpTap</h1><p>Browse every peak in the AlpTap catalogue on a satellite map, with locations, elevations and recorded names across the Alps and the world.</p><p>The explorer needs JavaScript to run.</p></main>');
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
