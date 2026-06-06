# bangerlore

This is the bangerlore repository.

## Projects

- The root static site is served from this directory.
- The matchmaking source app lives in `bangerlore-match/`.
- The deployed matchmaking pages are published at `/v5/match/` from the root
  `v5/match/` directory.

To refresh `/v5/match/` after rebuilding the match app:

```bash
cd bangerlore-match
PASS=bangerlore bun run build
cd ..
rm -rf v5/match
cp -R bangerlore-match/public v5/match
```
