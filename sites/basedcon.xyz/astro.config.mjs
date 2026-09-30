import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://basedcon.xyz',
  output: 'static',
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
