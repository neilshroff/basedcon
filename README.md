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

## Form submissions (private)

"Request an invite" on basedcon.xyz POSTs to `/api/invite`; "Want to attend?" on bangerlore.com
POSTs to `/api/attend`. Each submission is saved as one JSON file in that project's **private**
Vercel Blob store (`basedcon-submissions` / `bangerlore-submissions`) via `shared/intake.ts`.
Private blobs need the store token to read, so no submission is reachable by URL.

Env vars per project: `BLOB_READ_WRITE_TOKEN` (set when the store is connected) and an admin key,
`INVITES_ADMIN_KEY` (basedcon) / `ATTEND_ADMIN_KEY` (bangerlore).

Export (JSON, or add `&format=csv`):

- `https://basedcon.xyz/api/invites?key=<INVITES_ADMIN_KEY>`
- `https://bangerlore.com/api/attendees?key=<ATTEND_ADMIN_KEY>`

`LEGACY_BLOB_READ_WRITE_TOKEN` points at the old public stores. While it is set, each export first
moves any old submissions into the private store and deletes the public copies. Once that has run,
remove the variable and delete the old `basedcon-invites` / `bangerlore-attend` stores.

Site copy lives in each site's `src/data/site.json`.

## Email notifications

Both forms also email the organizers through Resend (`shared/notify.ts`); the submission is
saved first, so a mail failure never loses a request. Each project needs three env vars:

- `RESEND_API_KEY` — from resend.com
- `NOTIFY_TO` — recipient(s), comma-separated
- `NOTIFY_FROM` — a verified sender, e.g. `Basedcon <hello@basedcon.xyz>`

Subjects are tagged `[Basedcon]` / `[Bangerlore]` and Reply-To is the requester.

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
