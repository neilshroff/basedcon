// Downloads the first attached photo of each tweet in shared/data/tweets.json
// into shared/data/tweet-media/, and records likes / reposts / replies on
// the entry. Uses X's public syndication endpoint (no API key). Needs
// network access to x.com; run locally: `node scripts/fetch-tweet-media.mjs`
// Pass --stats to refresh counts for every tweet (photos are kept).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'shared/data/tweets.json');
const dir = path.join(root, 'shared/data/tweet-media');
await mkdir(dir, { recursive: true });

// The syndication endpoint wants a short token derived from the id.
const token = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
const force = process.argv.includes('--force');
const statsOnly = process.argv.includes('--stats');

const tweets = JSON.parse(await readFile(file, 'utf8'));
let found = 0;
for (const t of tweets) {
    const haveMedia = 'media' in t || t.mediaChecked;
    if (haveMedia && t.likes !== undefined && !force && !statsOnly) { if (t.media) found++; continue; }
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

    t.likes = data.favorite_count ?? 0;
    t.reposts = (data.retweet_count ?? 0) + (data.quote_count ?? 0);
    t.replies = data.conversation_count ?? 0;

    if (!t.media && (!haveMedia || force)) {
        const photos = (data.mediaDetails ?? []).filter((m) => m.type === 'photo');
        if (photos.length) {
            const src = photos[0].media_url_https.replace(/\.(jpg|png)$/, '') + '?format=jpg&name=large';
            const img = await fetch(src);
            if (img.ok) {
                const name = `${t.id}.jpg`;
                await writeFile(path.join(dir, name), Buffer.from(await img.arrayBuffer()));
                t.media = `tweet-media/${name}`;
                t.mediaCount = photos.length;
            }
        }
        t.mediaChecked = true;
    }
    if (t.media) found++;
    console.log(`✓ ${t.handle}: ♥ ${t.likes}  ⟳ ${t.reposts}  ↩ ${t.replies}${t.media ? '  📷' : ''}`);
}

await writeFile(file, JSON.stringify(tweets, null, 2) + '\n');
console.log(`\n${found} tweets with photos; wrote ${file}`);
