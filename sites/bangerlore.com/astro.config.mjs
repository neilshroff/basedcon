import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bangerlore.com',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap({ filter: (page) => !page.includes('/api/') })],
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  vite: {
    server: {
      fs: {
        allow: ['../..'],
      },
    },
  },
});
