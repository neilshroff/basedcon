# basedcon.xyz + bangerlore.com

Astro monorepo for both sites.

```
shared/              shared styles and components (PhotoGrid, Footer)
sites/basedcon.xyz/  → basedcon.xyz
sites/bangerlore.com/ → bangerlore.com
```

## Develop

```
npm install
npm run dev:basedcon     # http://localhost:4321
npm run dev:bangerlore   # http://localhost:4321
```

## Build

```
npm run build            # both sites
npm run build:basedcon
npm run build:bangerlore
```

Gallery images live in each site's `src/assets/gallery/` and are converted to responsive WebP at build time.

## Deploy

Two Vercel projects point at this repo, each with its Root Directory set to its `sites/` folder and "Include source files outside of the Root Directory" enabled. Pushes to `master` deploy both automatically.
