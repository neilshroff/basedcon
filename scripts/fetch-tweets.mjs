// Fills shared/data/tweets.json from X's public oEmbed endpoint and
// downloads author avatars into shared/data/avatars/. Needs network
// access to x.com; run locally: `node scripts/fetch-tweets.mjs`
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'shared/data/tweets.json');
const avatarDir = path.join(root, 'shared/data/avatars');
await mkdir(avatarDir, { recursive: true });

const tweets = JSON.parse(await readFile(file, 'utf8'));
const decode = (s) =>
    s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

for (const t of tweets) {
    if (t.text && t.name && !process.argv.includes('--force')) continue;
    const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(t.url)}&omit_script=true&dnt=true`);
    if (!res.ok) {
        console.warn(`! ${t.handle} ${t.id}: HTTP ${res.status} (deleted or private?)`);
        continue;
    }
    const o = await res.json();
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(o.html);
    let text = p ? p[1] : '';
    text = text.replace(/<br\s*\/?>/g, '\n').replace(/<a [^>]*>(pic\.twitter\.com\/\S+)<\/a>/g, '').replace(/<[^>]+>/g, '');
    t.name = o.author_name;
    t.text = decode(text).trim();
    const d = /<\/a>\s*([A-Z][a-z]+ \d{1,2}, \d{4})<\/blockquote>/.exec(o.html);
    if (d) t.date = new Date(d[1]).toISOString().slice(0, 10);
    console.log(`✓ ${t.handle}: ${t.text.slice(0, 60).replace(/\n/g, ' ')}…`);

    // Avatar: the author's public profile page carries a profile_image URL.
    try {
        const html = await (await fetch(o.author_url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
        const m = /https:\/\/pbs\.twimg\.com\/profile_images\/[^"']+?_(?:normal|200x200|400x400)\.(?:jpg|png)/.exec(html);
        if (m) {
            const url = m[0].replace(/_normal\./, '_200x200.');
            const img = await fetch(url);
            if (img.ok) {
                const ext = url.endsWith('.png') ? 'png' : 'jpg';
                const name = `${t.handle.replace('@', '').toLowerCase()}.${ext}`;
                await writeFile(path.join(avatarDir, name), Buffer.from(await img.arrayBuffer()));
                t.avatar = `avatars/${name}`;
            }
        }
    } catch (e) {
        console.warn(`  (no avatar for ${t.handle}: ${e.message})`);
    }
}

await writeFile(file, JSON.stringify(tweets, null, 2) + '\n');
console.log(`\nwrote ${file}`);
