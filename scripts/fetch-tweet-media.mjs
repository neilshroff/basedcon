// Downloads the first attached photo of each tweet in shared/data/tweets.json
// into shared/data/tweet-media/ and records it as `media` on the entry.
// Uses X's public syndication endpoint (no API key). Needs network access
// to x.com; run locally: `node scripts/fetch-tweet-media.mjs`
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'shared/data/tweets.json');
const dir = path.join(root, 'shared/data/tweet-media');
await mkdir(dir, { recursive: true });

// The syndication endpoint wants a short token derived from the id.
const token = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

const tweets = JSON.parse(await readFile(file, 'utf8'));
let found = 0;
for (const t of tweets) {
    if (t.media && !process.argv.includes('--force')) { found++; continue; }
    const url = `https://cdn.syndication.twimg.com/tweet-result?id=${t.id}&token=${token(t.id)}`;
    let data;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) { console.warn(`! ${t.handle}: HTTP ${res.status}`); continue; }
        data = await res.json();
    } catch (e) {
        console.warn(`! ${t.handle}: ${e.message}`);
        continue;
    }
    const photos = (data.mediaDetails ?? []).filter((m) => m.type === 'photo');
    if (!photos.length) { console.log(`- ${t.handle}: no photo`); delete t.media; continue; }
    const src = photos[0].media_url_https.replace(/\.(jpg|png)$/, '') + '?format=jpg&name=large';
    const img = await fetch(src);
    if (!img.ok) { console.warn(`! ${t.handle}: media HTTP ${img.status}`); continue; }
    const name = `${t.id}.jpg`;
    await writeFile(path.join(dir, name), Buffer.from(await img.arrayBuffer()));
    t.media = `tweet-media/${name}`;
    t.mediaCount = photos.length;
    found++;
    console.log(`✓ ${t.handle}: ${photos.length} photo${photos.length > 1 ? 's' : ''} (saved first)`);
}

await writeFile(file, JSON.stringify(tweets, null, 2) + '\n');
console.log(`\n${found} tweets with photos; wrote ${file}`);
