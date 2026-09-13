// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

/**
 * Deployment target.
 * - On GitHub Actions the Pages URL is derived from GITHUB_REPOSITORY automatically:
 *   `<owner>/<owner>.github.io` → https://<owner>.github.io (no base)
 *   `<owner>/<repo>`            → https://<owner>.github.io/<repo>/
 * - Custom domain: set the repository variable SITE_URL (e.g. https://jordanfry.com) and leave SITE_BASE empty.
 * - Anything else: SITE_URL / SITE_BASE override both.
 */
const [owner = '', repo = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const onActions = Boolean(owner && repo);
const userSite = onActions && repo.toLowerCase() === `${owner}.github.io`.toLowerCase();
const SITE = process.env.SITE_URL || (onActions ? `https://${owner}.github.io` : 'http://localhost:4321');
const BASE =
  process.env.SITE_BASE || (!process.env.SITE_URL && onActions && !userSite ? `/${repo}` : undefined);

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  output: 'static',
  prefetch: { prefetchAll: true },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  vite: { plugins: [tailwindcss()] },
  image: { layout: 'constrained' },
  env: {
    schema: {
      PUBLIC_WEB3FORMS_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/fraunces-latin-opsz-normal.woff2'],
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/inter-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' },
        ],
      },
    },
  ],
});
