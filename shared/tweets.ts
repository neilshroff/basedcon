import tweets from './data/tweets.json';

export type Tweet = (typeof tweets)[number] & { featured?: boolean; quote?: string };
export type Site = 'basedcon' | 'bangerlore';

export function tweetsFor(site: Site): Tweet[] {
    return (tweets as Tweet[]).filter((t) => t.site === site && t.text);
}

export function featuredFor(site: Site): Tweet[] {
    return tweetsFor(site).filter((t) => t.featured);
}

export function quoteOf(t: Tweet) {
    return (t.quote ?? t.text).trim();
}
