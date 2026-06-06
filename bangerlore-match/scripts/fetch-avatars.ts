// Download every guest's profile pic into avatars/ so the deployed page never
// depends on Twitter/LinkedIn CDNs at party time (hotlink blocks, rate limits,
// venue wifi). build-html.ts swaps in the local copy when it exists.
// Resumable: already-downloaded avatars are skipped; rerun freely.

import type { Blurb } from "../blurbs";
import { isRasterImage } from "../lib/avatars";
import { runPool } from "../lib/pool";

const blurbs = await Bun.file("data/blurbs.json").json() as Blurb[];
const withPics = blurbs.filter((b) => b.profilePicUrl);

const queue: Blurb[] = [];
for (const blurb of withPics) {
  if (!(await Bun.file(`avatars/${blurb.id}.jpg`).exists())) queue.push(blurb);
}
console.log(`${queue.length} avatars to fetch (${withPics.length - queue.length} cached).`);

await runPool({
  items: queue,
  concurrency: 8,
  name: (b) => b.name,
  run: async (blurb) => {
    const response = await fetch(blurb.profilePicUrl!, {
      headers: { "user-agent": "Mozilla/5.0 (party avatar cache)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Reject placeholder SVGs / HTML error pages served with HTTP 200
    if (!isRasterImage(bytes)) throw new Error("not a raster image (placeholder/error page)");
    await Bun.write(`avatars/${blurb.id}.jpg`, bytes);
  },
  checkpoint: async () => {},
});

const have = (await Promise.all(
  withPics.map((b) => Bun.file(`avatars/${b.id}.jpg`).exists()),
)).filter(Boolean).length;
console.log(`avatars/: ${have}/${withPics.length} cached locally.`);
