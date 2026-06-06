// Guest identity helpers.
//
// data/social-profiles.json is built from data/guests.json via guests.map()
// in index.ts, so the two arrays are INDEX-ALIGNED per scrape run. Joining by
// display name is wrong: names are not unique (the guest list has two
// Anirudhs). Join by index, and verify the name as a misalignment tripwire.

type Named = { name: string };

// Stable, salted guest ID. Derived from email (unique across the list) with a
// lowercase-name fallback for the 6 guests who left email blank (verified to
// have unique names). Salting keeps the private JSON files from containing
// directly reversible email hashes (eng review D15 / Codex finding). IDs stay
// glued to the person across RSVP re-exports — never derived from row order.
const DEFAULT_SALT = "bangerlore-2026";

export function stableId(
  email: string | null | undefined,
  name: string,
  salt: string = Bun.env.ID_SALT ?? DEFAULT_SALT,
): string {
  const key = email?.trim().toLowerCase() || `name:${name.trim().toLowerCase()}`;
  const hash = new Bun.CryptoHasher("sha256").update(`${salt}|${key}`).digest("hex");
  return `u${hash.slice(0, 10)}`;
}

export function profileFor<T extends Named>(
  profiles: T[],
  index: number,
  guestName: string,
): T | undefined {
  const profile = profiles[index];
  if (!profile) return undefined;
  if (profile.name !== guestName) {
    // Arrays drifted out of alignment (e.g. stale social-profiles.json after
    // a guests.json re-export). Refuse the join rather than attach the wrong
    // person's bio — caller treats this guest as having no scraped profile.
    console.warn(
      `Profile/guest misalignment at index ${index}: profile "${profile.name}" vs guest "${guestName}" — skipping profile join. Re-run \`bun index.ts\` to rebuild social-profiles.json.`,
    );
    return undefined;
  }
  return profile;
}
