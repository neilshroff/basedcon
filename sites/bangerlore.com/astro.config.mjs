import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bangerlore.com',
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
