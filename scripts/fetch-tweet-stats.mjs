// Refreshes likes / reposts / replies / bookmarks for every tweet in
// shared/data/tweets.json from the official X API v2, which (unlike the
// public syndication endpoint) returns repost and bookmark counts.
//
// Needs an X developer Bearer token (free tier is enough for reads):
//   X_BEARER_TOKEN=... node scripts/fetch-tweet-stats.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const token = process.env.X_BEARER_TOKEN;
if (!token) {
    console.error('Set X_BEARER_TOKEN (from developer.x.com) and run again.');
    process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'shared/data/tweets.json');
const tweets = JSON.parse(await readFile(file, 'utf8'));

// v2 lookup takes up to 100 ids per call.
const ids = tweets.map((t) => t.id);
for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100).join(',');
    const url = `https://api.x.com/2/tweets?ids=${batch}&tweet.fields=public_metrics`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        console.error(`X API ${res.status}: ${await res.text()}`);
        process.exit(1);
    }
    const { data = [], errors = [] } = await res.json();
    for (const d of data) {
        const t = tweets.find((x) => x.id === d.id);
        const m = d.public_metrics;
        t.likes = m.like_count;
        t.reposts = m.retweet_count + m.quote_count;
        t.replies = m.reply_count;
        t.bookmarks = m.bookmark_count;
        console.log(`✓ ${t.handle.padEnd(18)} ♥ ${String(t.likes).padStart(5)}  ⟳ ${String(t.reposts).padStart(4)}  ↩ ${String(t.replies).padStart(4)}  🔖 ${String(t.bookmarks).padStart(4)}`);
    }
    for (const e of errors) console.warn(`! ${e.value}: ${e.title}`);
}

await writeFile(file, JSON.stringify(tweets, null, 2) + '\n');
console.log(`\nwrote ${file}`);
