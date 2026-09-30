// Download every guest's profile pic into avatars/ so the deployed page never
// depends on Twitter/LinkedIn CDNs at party time (hotlink blocks, rate limits,
// venue wifi). build-html.ts swaps in the local copy when it exists.
// Resumable: already-downloaded avatars are skipped; rerun freely.

import type { Blurb } from "../blurbs";
import { isRasterImage, validAvatar } from "../lib/avatars";
import { profilePicCandidates, preferredProfilePic, type ProfilePicSources } from "../lib/profile-pics";
import { runPool } from "../lib/pool";

const blurbs = await Bun.file("data/blurbs.json").json() as Blurb[];
const profileFile = Bun.file("data/social-profiles.json");
const profiles = (await profileFile.exists())
  ? await profileFile.json() as ProfilePicSources[]
  : [];

type AvatarJob = {
  blurb: Blurb;
  candidates: string[];
};

function candidatesFor(blurb: Blurb, index: number) {
  const candidates = profilePicCandidates(profiles[index]);
  if (blurb.profilePicUrl) candidates.push(blurb.profilePicUrl);
  return [...new Set(candidates)];
}

const jobs: AvatarJob[] = blurbs
  .map((blurb, index) => ({ blurb, candidates: candidatesFor(blurb, index) }))
  .filter((job) => job.candidates.length > 0);

let repairedBlurbs = 0;
for (let index = 0; index < blurbs.length; index++) {
  const preferred = preferredProfilePic(profiles[index]);
  if (preferred && blurbs[index].profilePicUrl !== preferred) {
    blurbs[index].profilePicUrl = preferred;
    repairedBlurbs++;
  }
}

if (repairedBlurbs > 0) {
  await Bun.write("data/blurbs.json", JSON.stringify(blurbs, null, 2));
}

const queue: AvatarJob[] = [];
for (const job of jobs) {
  if (!(await validAvatar(job.blurb.id))) queue.push(job);
}
console.log(
  `${queue.length} avatars to fetch (${jobs.length - queue.length} valid cached, ` +
    `${repairedBlurbs} blurb URLs repaired).`,
);

await runPool({
  items: queue,
  concurrency: 8,
  name: (job) => job.blurb.name,
  run: async ({ blurb, candidates }) => {
    const errors: string[] = [];
    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (party avatar cache)" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        // Reject placeholder SVGs / HTML error pages served with HTTP 200
        if (!isRasterImage(bytes)) throw new Error("not a raster image (placeholder/error page)");
        await Bun.write(`avatars/${blurb.id}.jpg`, bytes);
        blurb.profilePicUrl = url;
        return;
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    blurb.profilePicUrl = null;
    console.warn(`No usable avatar for ${blurb.name}; using initials. ${errors.join("; ")}`);
  },
  checkpoint: () => Bun.write("data/blurbs.json", JSON.stringify(blurbs, null, 2)),
});

const have = (await Promise.all(
  jobs.map((job) => validAvatar(job.blurb.id)),
)).filter(Boolean).length;
console.log(`avatars/: ${have}/${jobs.length} cached locally.`);
