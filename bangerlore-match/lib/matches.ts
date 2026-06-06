// Pure validation of model-proposed matches, extracted from match.ts during
// eng review (2026-06-05). Rules: never the guest themselves, never an id
// outside the roster, never the same person twice, at most 4.

export type RawMatch = { id: string; reason: string; icebreaker: string };

export function validateMatches(
  raw: RawMatch[],
  selfId: string,
  validIds: ReadonlySet<string>,
): RawMatch[] {
  const seen = new Set<string>();
  const valid: RawMatch[] = [];
  for (const match of raw) {
    if (match.id === selfId) continue;
    if (!validIds.has(match.id)) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    valid.push(match);
    if (valid.length === 4) break;
  }
  return valid;
}
