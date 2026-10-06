import tweets from './data/tweets.json';

export type Tweet = (typeof tweets)[number] & {
    featured?: boolean;
    quote?: string;
    media?: string;
    mediaCount?: number;
    likes?: number;
    reposts?: number;
    replies?: number;
};

export function compact(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n);
}
export type Site = 'basedcon' | 'bangerlore';

export function tweetsFor(site: Site): Tweet[] {
    return (tweets as Tweet[]).filter((t) => t.site === site && t.text);
}

export function featuredFor(site: Site): Tweet[] {
    return shuffle(tweetsFor(site).filter((t) => t.featured));
}

// Deterministic shuffle (fixed seed) so the wall order is stable between
// builds, then nudge so photo cards and text-only cards alternate.
function shuffle<T extends { media?: string }>(items: T[]): T[] {
    let seed = 20240601;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    const withPhoto = a.filter((t) => t.media);
    const textOnly = a.filter((t) => !t.media);
    const out: T[] = [];
    while (withPhoto.length || textOnly.length) {
        if (withPhoto.length) out.push(withPhoto.shift()!);
        if (withPhoto.length) out.push(withPhoto.shift()!);
        if (textOnly.length) out.push(textOnly.shift()!);
    }
    return out;
}

export function quoteOf(t: Tweet) {
    return (t.quote ?? t.text).trim();
}
