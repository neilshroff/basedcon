# basedcon.xyz + bangerlore.com

Astro monorepo for both sites.

```
shared/                shared styles and components (PhotoGrid, Footer)
sites/basedcon.xyz/    → basedcon.xyz
sites/bangerlore.com/  → bangerlore.com
bangerlore-match/      matchmaking app source (Bun); publishes to bangerlore.com/v5/match/
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

## Matchmaking pages

The match app's generated pages are committed as static files in
`sites/bangerlore.com/public/v5/match/` and served at `bangerlore.com/v5/match/`.

To refresh them after rebuilding the match app:

```bash
cd bangerlore-match
PASS=bangerlore bun run build
cd ..
rm -rf sites/bangerlore.com/public/v5/match
cp -R bangerlore-match/public sites/bangerlore.com/public/v5/match
```

## Deploy

Two Vercel projects point at this repo, each with its Root Directory set to its `sites/` folder and "Include source files outside of the Root Directory" enabled. Pushes to `master` deploy both automatically.
