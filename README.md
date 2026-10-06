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

## Basedcon invite requests

"Request an invite" on basedcon.xyz POSTs to `/api/invite` (an Astro server route deployed
as a Vercel Function). Each submission is stored as a JSON file in the project's Vercel Blob
store under `invites/`. Required env vars on the `basedcon` Vercel project:

- `BLOB_READ_WRITE_TOKEN` — set automatically when the Blob store is connected to the project
- `INVITES_ADMIN_KEY` — any long random string; unlocks the export endpoint

Export all submissions: `https://basedcon.xyz/api/invites?key=<INVITES_ADMIN_KEY>`
(add `&format=csv` for a spreadsheet-friendly download).

Site copy and events live in `sites/basedcon.xyz/src/data/site.json`.

## Bangerlore attend requests

Same pattern: "Want to attend?" POSTs to `/api/attend`, stored under `attend/` in the
`bangerlore-com` project's Blob store. Env vars: `BLOB_READ_WRITE_TOKEN` (from the store) and
`ATTEND_ADMIN_KEY`. Export: `https://bangerlore.com/api/attendees?key=<ATTEND_ADMIN_KEY>` (`&format=csv`).

Site copy, editions, sponsors and tweets live in `sites/bangerlore.com/src/data/site.json`.

## Tweets

`shared/data/tweets.json` lists the tweets shown on the Bangerlore home. To add one, append
`{ "id", "handle", "url", "site": "bangerlore" }` and run, locally (X blocks server fetches):

```
node scripts/fetch-tweets.mjs        # fills text, name, avatar
node scripts/fetch-tweet-media.mjs   # saves the attached photo, if any
```

Set `"featured": true` to show it on the wall; `"quote"` overrides the displayed text.

## People (hosts / conspirators)

One list for both sites: `shared/data/people.json`. Each person has `basedcon` and `bangerlore`
flags; basedcon.xyz/conspirators and bangerlore.com/hosts are both rendered from it, so a bio or
link edit there updates both sites on the next push.

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
