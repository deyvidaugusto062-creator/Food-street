import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { business, SITE_URL } from './src/data/business.ts';
import { hours } from './src/data/hours.ts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Injeta no <head> os dados estruturados (schema.org/Restaurant) e as meta tags
 * sociais a partir de src/data — só com informações confirmadas.
 */
function seo(): Plugin {
  return {
    name: 'food-street-seo',
    transformIndexHtml() {
      const { address } = business;
      const ld: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: business.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: `${address.street}, ${address.number} - ${address.neighborhood}`,
          addressLocality: address.city,
          addressRegion: address.state,
          postalCode: address.postalCode,
          addressCountry: address.country,
        },
        telephone: business.phone.e164,
        openingHoursSpecification: hours
          .filter((h) => !h.closed && h.open && h.close)
          .map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${DAYS[h.day]}`,
            opens: h.open,
            closes: h.close,
          })),
      };
      if (SITE_URL) ld.url = SITE_URL;

      const abs = (path: string) => (SITE_URL ? `${SITE_URL.replace(/\/$/, '')}${path}` : path);
      const title = 'Food Street Augusta | Burger and Bar em São Paulo';
      const description = `Burger and Bar na ${address.street}, ${address.number}, ${address.neighborhood}, São Paulo. Veja o cardápio, os horários e como chegar.`;

      const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
      const tags: HtmlTagDescriptor[] = [
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:locale', content: 'pt_BR' }),
        meta({ property: 'og:site_name', content: business.name }),
        meta({ property: 'og:title', content: title }),
        meta({ property: 'og:description', content: description }),
        meta({ property: 'og:image', content: abs('/og.jpg') }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(ld), injectTo: 'head' },
      ];
      if (SITE_URL) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: SITE_URL }, injectTo: 'head' });
        tags.push(meta({ property: 'og:url', content: SITE_URL }));
      }
      return tags;
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
  },
});
