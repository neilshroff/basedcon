# TODOS

## Batches API mode for bulk reruns
- **What:** `BATCH=1` flag on `blurbs.ts` / `match.ts` that submits requests via Anthropic's Batches API (`client.messages.batches`) instead of live calls.
- **Why:** Identical output at 50% price for any regeneration that can wait up to an hour (post-party reruns, future enrichment passes).
- **Pros:** Halves the largest cost center; ~30 lines; composes with `MODEL=claude-sonnet-4-6` for ~80% total reduction vs live Opus.
- **Cons:** Results latency up to 1h makes it unusable for same-day event fixes; adds a polling loop to otherwise-simple scripts.
- **Context (June 2026):** Live full-roster rerun costs ~$8-12 (Opus) / ~$3-5 (Sonnet). The roster prompt is cached for live calls but batch requests each pay full input price — net is still cheaper because batch discount (50%) exceeds typical cache savings on this workload's mix. Decided during eng review the night before the party; explicitly rejected for event-day use (latency risk), captured for everything after.
- **Depends on / blocked by:** Nothing. Pairs well with stable guest IDs (landed in the same review).

---
*Reviewed but rejected (for the record): orphan-rebalance (quality > enforced fairness — 39 zero-inbound guests still get their own matches); pre-party personalized emails (PII/consent surface, cut per privacy review).*
*For Arnav: `data/guests.json` (296 emails) lives in git history of the private repo — fine while private, purge history before ever flipping visibility.*
