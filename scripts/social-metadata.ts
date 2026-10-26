import type { Plugin } from 'vite';

export function socialMetadata(siteUrl: string): Plugin {
  const site = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`);
  if (!['http:', 'https:'].includes(site.protocol) || site.search || site.hash || site.username || site.password) throw new Error('SITE_URL must be an absolute public site URL, including its base path');
  const image = new URL('social/alptap-preview-v1.jpg', site).href;
  const title = 'AlpTap — How close can you get?';
  const description = 'Three peaks. One mountain adventure. Find summits across the Alps and the world, then challenge friends to the exact same peaks.';
  const alt = 'AlpTap: A little closer to the mountains. Illustrated snowy Alpine peaks at sunrise, with a map pin on a summit.';
  return {
    name: 'social-metadata',
    transformIndexHtml() {
      // No og:url: shared query URLs must keep their replay token in link previews.
      // The search-only canonical consolidates those query variants into the root page.
      const og = { 'og:type': 'website', 'og:site_name': 'AlpTap', 'og:title': title, 'og:description': description, 'og:image': image, 'og:image:type': 'image/jpeg', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': alt };
      const twitter = { 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': alt };
      return [{ tag: 'link', attrs: { rel: 'canonical', href: site.href }, injectTo: 'head' as const }, ...Object.entries(og).map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' as const })), ...Object.entries(twitter).map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' as const }))];
    },
  };
}
