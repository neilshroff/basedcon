// One-time migration (eng review Issue 2, 2026-06-05): re-key blurbs.json and
// matches.json from positional IDs (g042 = row 42 of guests.json) to stable
// salted-email IDs. Safe to run only while guests.json is still in the exact
// order the blurbs were generated in — i.e. run it BEFORE any RSVP re-export.
// Idempotent: already-migrated ids (u...) pass through unchanged.

import { stableId } from "../lib/identity";
import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";

type Guest = { Name: string } & Record<string, string>;
const emailField = "Email address (no spam, we’ll just add it to your calendar)";

const guests = await Bun.file("data/guests.json").json() as Guest[];
const blurbs = await Bun.file("data/blurbs.json").json() as Blurb[];
const matches = await Bun.file("data/matches.json").json() as GuestMatches[];

const oldToNew = new Map<string, string>();
guests.forEach((guest, i) => {
  oldToNew.set(`g${String(i).padStart(3, "0")}`, stableId(guest[emailField], guest.Name));
});

const remap = (id: string) => {
  if (id.startsWith("u")) return id; // already migrated
  const next = oldToNew.get(id);
  if (!next) throw new Error(`No mapping for id ${id} — guests.json changed since generation? Aborting, nothing written.`);
  return next;
};

// Sanity: positional blurb id must point at the guest with the same name.
blurbs.forEach((b, i) => {
  if (b.id.startsWith("g")) {
    const row = Number(b.id.slice(1));
    if (guests[row]?.Name !== b.name) {
      throw new Error(`blurbs.json[${i}] (${b.id} "${b.name}") does not match guests.json row ${row} ("${guests[row]?.Name}"). Aborting, nothing written.`);
    }
  }
});

const newBlurbs = blurbs.map((b) => ({ ...b, id: remap(b.id) }));
const newMatches = matches.map((m) => ({
  ...m,
  id: remap(m.id),
  matches: m.matches.map((x) => ({ ...x, id: remap(x.id) })),
}));

// All-or-nothing: validate before writing either file.
const ids = new Set(newBlurbs.map((b) => b.id));
if (ids.size !== newBlurbs.length) throw new Error("Duplicate stable IDs after migration. Aborting.");
for (const m of newMatches) {
  if (!ids.has(m.id)) throw new Error(`matches.json id ${m.id} not in blurbs. Aborting.`);
  for (const x of m.matches) {
    if (!ids.has(x.id)) throw new Error(`match ref ${x.id} not in blurbs. Aborting.`);
  }
}

await Bun.write("data/blurbs.json", JSON.stringify(newBlurbs, null, 2));
await Bun.write("data/matches.json", JSON.stringify(newMatches, null, 2));
console.log(`Re-keyed ${newBlurbs.length} blurbs and ${newMatches.length} match sets to stable IDs.`);
