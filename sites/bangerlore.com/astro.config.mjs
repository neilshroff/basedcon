import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://bangerlore.com',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
