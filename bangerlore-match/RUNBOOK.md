# Party-Day Runbook

## TL;DR commands

```bash
bun test                                   # 74 tests, must be green before anything
bun index.ts                               # scrape new/changed guests (ZenRows)
MODEL=claude-sonnet-4-6 bun run pipeline   # blurbs → match → html (cheap rerun config)
bun scripts/fetch-avatars.ts               # cache any new avatars locally
PASS=<party-passphrase> bun build-html.ts  # final gated build (PASS is REQUIRED for deploy)
```

## Final-RSVP rerun (morning of)

**Invalidation order — what a guests.json refresh actually invalidates:**

1. `bun index.ts` — scrapes only new/changed links (resumable; rebuilds index alignment).
2. `bun blurbs.ts` — generates only guests whose stable ID has no blurb yet.
   Removed guests: delete their entries from `data/blurbs.json` (or leave; they
   just render as extra cards — deleting is cleaner).
3. `bun match.ts` — matches only new guests. **Caveat:** existing guests'
   matches were computed against the old roster; they won't reference brand-new
   guests. Acceptable for a handful of late RSVPs; for a big influx, delete
   `data/matches.json` and re-match everyone (~$3-5 on Sonnet).
4. `bun scripts/fetch-avatars.ts` then `PASS=... bun build-html.ts`.

**Model:** default is now `claude-haiku-4-5` for everything (cheapest; user
decision 2026-06-05). Override for higher match quality:
`MODEL=claude-sonnet-4-6 bun run pipeline`. **Spot-check 2-3 outputs** before
deploying (open matches.html, read the new guests' cards).

## Cost table (per full 296-guest regeneration)

| Config | Blurbs | Matching | Latency |
|---|---|---|---|
| Live Haiku 4.5 (default) | ~$0.35 | ~$1.50 | minutes |
| Live Sonnet 4.6 (`MODEL=claude-sonnet-4-6`) | ~$1 | ~$3-5 | minutes |
| Live Opus 4.8 (original build) | ~$2.50 | ~$8-12 | minutes |
| Batch mode (TODO, not built) | half of any row above | | up to 1 hour |

Enrichment summaries (`scripts/enrich.ts`) always run on Haiku (~$0.20/run).

Incremental reruns cost pennies — only missing IDs are generated.

## Failure policy

- Any failed guest → pipeline prints a `FAILED: n/total` block with names and
  **exits 1**, so `bun run pipeline` stops before building HTML on partial data.
- Rerunning retries only the failed guests (resume via stable IDs).
- **6pm escape hatch:** `ALLOW_PARTIAL=1 bun run pipeline` builds anyway,
  loudly, with omissions listed in the log. Use only when doors are about to
  open and a few flaky guests shouldn't block 290 good ones.
- **No-rerun fallback:** the currently built `matches.html` is always complete
  and shippable. If credits/API die on party day: deploy what exists, done.

## Rollback

- Every build copies the previous `matches.html` to `releases/matches-<ts>.html`.
- To roll back: `cp releases/matches-<latest-good>.html matches.html` and redeploy.
- Pre-migration data snapshots: `data/backups/*-pre-rekey.json`.

## Deploy + QR

1. `PASS=<phrase> bun build-html.ts && PASS=<phrase> bun run graph` — **never
   deploy an UNGATED build** (the build log says `gated` or `UNGATED`).
2. Deploy `matches.html` + `graph.html` + `avatars/` to an **unguessable path**, e.g.
   `vercel deploy` into a project named with a random suffix, or any static
   host at `/p/<random-slug>/`. Page carries `noindex,nofollow`.
3. QR poster: encode the URL; print the passphrase ON the poster ("scan + enter
   passphrase: <phrase>"). ASCII-only passphrase (the gate uses btoa).
4. The gate is a deterrent, not security — data is in the page source. Real
   access control = tokenized per-guest links (deferred, see TODOS.md).

## Verified party-day surface (eng review T8, 2026-06-05)

- ✓ Mobile 375px: gate blocks wrong pass, accepts case-insensitive pass
- ✓ Search by tag (robotics→18) and name (Anirudh→2); clear restores all 296
- ✓ 230/230 avatars served locally (no Twitter/LinkedIn dependency at party time)
- ✓ 0 broken images, 0 console errors
- ✓ 296 blurbs swept for embarrassing content — all clean (6 flags reviewed,
  all guests' own self-descriptions)
- ✓ 189 mutual pairs badged, own-card-only
