import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { business, SITE_URL } from './src/data/business.ts';
import { hours } from './src/data/hours.ts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PAGES = {
  home: { path: '/', title: 'Ótica Vetor | Ótica no Jardim Prudência, São Paulo' },
  loja: { path: '/armacoes/', title: 'Comprar armações | Ótica Vetor — São Paulo' },
};

const abs = (path: string) => (SITE_URL ? `${SITE_URL.replace(/\/$/, '')}${path}` : path);

/**
 * SEO local: Open Graph, canonical, dados estruturados (schema.org/Optician), robots.txt e sitemap.xml
 * gerados a partir de src/data — somente com os dados informados pela empresa.
 */
function seo(): Plugin {
  return {
    name: 'otica-vetor-seo',
    transformIndexHtml(html, ctx) {
      const page = ctx.path.startsWith('/armacoes') ? PAGES.loja : PAGES.home;
      const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '';
      const { address } = business;

      const optician: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Optician',
        name: business.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: `${address.street}, ${address.number}`,
          addressLocality: address.city,
          addressRegion: address.state,
          postalCode: address.postalCode,
          addressCountry: address.country,
        },
        telephone: business.phone.e164,
        sameAs: [business.instagram.url],
        openingHoursSpecification: hours
          .filter((h) => h.open && h.close)
          .map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${DAYS[h.day]}`,
            opens: h.open,
            closes: h.close,
          })),
      };
      if (SITE_URL) optician.url = abs('/');

      const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
      const tags: HtmlTagDescriptor[] = [
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:locale', content: 'pt_BR' }),
        meta({ property: 'og:site_name', content: business.name }),
        meta({ property: 'og:title', content: page.title }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:image', content: abs('/og.jpg') }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(optician), injectTo: 'head' },
      ];

      if (page === PAGES.loja) {
        const crumbs = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', ...(SITE_URL && { item: abs('/') }) },
            { '@type': 'ListItem', position: 2, name: 'Armações', ...(SITE_URL && { item: abs('/armacoes/') }) },
          ],
        };
        tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(crumbs), injectTo: 'head' });
      }

      if (SITE_URL) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: abs(page.path) }, injectTo: 'head' });
        tags.push(meta({ property: 'og:url', content: abs(page.path) }));
      }
      return tags;
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /'];
      if (SITE_URL) {
        robots.push(`Sitemap: ${abs('/sitemap.xml')}`);
        const today = new Date().toISOString().slice(0, 10);
        const urls = Object.values(PAGES)
          .map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${today}</lastmod></url>`)
          .join('\n');
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      } else {
        this.warn('SITE_URL vazio em src/data/business.ts: sitemap.xml, canonical e URLs absolutas não foram gerados.');
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' });
    },
  };
}

/** Pré-carrega as fontes latinas principais (evita o "salto" do título quando a fonte chega) */
function preloadFonts(): Plugin {
  return {
    name: 'otica-vetor-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => /(instrument-sans-latin-wdth|manrope-latin-wght)-normal-.*\.woff2$/.test(f));
        return files.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' },
          injectTo: 'head-prepend' as const,
        }));
      },
    },
  };
}

/**
 * Versão de arquivo único: embute as imagens (WebP) e o favicon no HTML como data URI,
 * expostos em window.__OV_ASSETS__ (lidos por src/utils/asset.ts).
 */
function embedImages(): Plugin {
  const root = resolve(import.meta.dirname, 'public');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  return {
    name: 'otica-vetor-embed-images',
    transformIndexHtml() {
      const map: Record<string, string> = {};
      for (const file of walk(join(root, 'images')).filter((f) => f.endsWith('.webp'))) {
        map[`/${relative(root, file)}`] = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
      }
      const favicon = `data:image/svg+xml;base64,${readFileSync(join(root, 'favicon.svg')).toString('base64')}`;
      return [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: favicon }, injectTo: 'head' },
        { tag: 'script', children: `window.__OV_ASSETS__=${JSON.stringify(map)};`, injectTo: 'head' },
      ];
    },
  };
}

export default defineConfig(({ mode }) =>
  mode.startsWith('single')
    ? {
        // npm run build:single → um único HTML, sem servidor
        plugins: [react(), embedImages(), viteSingleFile({ removeViteModuleLoader: true })],
        publicDir: false,
        build: {
          target: 'es2022',
          outDir: mode === 'single' ? 'dist-single' : 'dist-single-revisao',
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          chunkSizeWarningLimit: 4000,
          rollupOptions: { input: resolve(import.meta.dirname, 'single.html') },
        },
      }
    : {
        plugins: [react(), seo(), preloadFonts()],
        build: {
          target: 'es2022',
          cssCodeSplit: true,
          chunkSizeWarningLimit: 1200,
          rollupOptions: {
            input: {
              main: resolve(import.meta.dirname, 'index.html'),
              armacoes: resolve(import.meta.dirname, 'armacoes/index.html'),
            },
          },
        },
      },
);
