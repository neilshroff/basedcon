import tweets from './data/tweets.json';

export type Tweet = (typeof tweets)[number];
export type Site = 'basedcon' | 'bangerlore';

export function tweetsFor(site: Site) {
    return tweets.filter((t) => t.site === site && t.text);
}
