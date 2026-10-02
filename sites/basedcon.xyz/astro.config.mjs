import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://basedcon.xyz',
  output: 'static',
  adapter: vercel(),
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
