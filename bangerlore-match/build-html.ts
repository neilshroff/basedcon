import type { Blurb } from "./blurbs";
import type { GuestMatches } from "./match";
import { validAvatar } from "./lib/avatars";
import { renderMeetHtml } from "./lib/render-meet";

const blurbs = await Bun.file("data/blurbs.json").json() as Blurb[];
const matches = await Bun.file("data/matches.json").json() as GuestMatches[];

// Twitter links come from the scrape stage; keyed by guest name (same key the
// pipeline uses end-to-end).
type SocialLink = { name: string; twitterUrl: string | null };
const socialLinks = await Bun.file("data/social-links.json").json() as SocialLink[];
const twitterByName = new Map(
  socialLinks.filter((s) => s.twitterUrl).map((s) => [s.name, s.twitterUrl as string]),
);

// Hero collage: downscaled party photos committed in party/ (copied to
// public/party by the build). Sorted for reproducible builds.
const partyPhotos = (await Array.fromAsync(new Bun.Glob("*.jpg").scan({ cwd: "party" })))
  .sort()
  .map((f) => `party/${f}`);

// Prefer locally cached avatars (scripts/fetch-avatars.ts) over remote CDN
// URLs — the deployed page must not depend on Twitter/LinkedIn at party time.
let localAvatars = 0;
for (const blurb of blurbs) {
  if (blurb.profilePicUrl && await validAvatar(blurb.id)) {
    blurb.profilePicUrl = `avatars/${blurb.id}.jpg`;
    localAvatars += 1;
  } else if (blurb.profilePicUrl) {
    // No valid local copy (placeholder SVG, dead CDN) — initials beat a
    // remote URL that might be the same junk. The HTML img onerror handles
    // any survivors, but don't ship known-bad sources.
    blurb.profilePicUrl = null;
  }
}

// Rollback artifact: keep the previous build before overwriting.
const previous = Bun.file("matches.html");
if (await previous.exists()) {
  await Bun.write(`releases/matches-${Date.now()}.html`, await previous.arrayBuffer());
}

await Bun.write(
  "matches.html",
  renderMeetHtml(blurbs, matches, { twitterByName, partyPhotos }),
);
console.log(
  `Wrote matches.html (${blurbs.length} guests, ${matches.length} match sets, ` +
    `${localAvatars} local avatars, ${twitterByName.size} twitter links, ` +
    `${partyPhotos.length} party photos, open).`,
);
