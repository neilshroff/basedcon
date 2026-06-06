// Enrichment pass (raw MVP): squeeze more matching context out of what guests
// already pointed us at.
//
//   form text + scraped bios ──► personal site URLs ──► plain fetch (free)
//                            └─► @mentioned handles ──► ZenRows profile scrape
//                                        │
//                       Haiku summarizes everything into 2-4 factual
//                       sentences ──► data/enrichment.json (keyed by stable id)
//
// blurbs.ts folds the summary into each guest's context. Resumable: guests
// already in enrichment.json are skipped; site/handle fetches are cached
// globally so the same company account is scraped once.

import Anthropic from "@anthropic-ai/sdk";
import type { Blurb } from "../blurbs";
import { getTwitterProfile } from "../profiles";
import { runPool, writeJsonAtomic } from "../lib/pool";
import { stableId } from "../lib/identity";

type Guest = { Name: string } & Record<string, string>;
type ProfileResult = {
  twitterUrl: string | null;
  twitterProfile: { bio: string | null } | null;
  linkedinProfile: { bio: string | null } | null;
};
type Enrichment = {
  id: string;
  name: string;
  sources: { sites: string[]; mentions: string[] };
  summary: string;
};

const emailField = "Email address (no spam, we’ll just add it to your calendar)";
const socialField =
  "Any online social link X / LinkedIn / personal website just so we know who you are!";

const guests = await Bun.file("data/guests.json").json() as Guest[];
const profiles = await Bun.file("data/social-profiles.json").json() as ProfileResult[];

const enrichPath = "data/enrichment.json";
const cachePath = "data/enrichment-cache.json";
const existing: Enrichment[] = (await Bun.file(enrichPath).exists())
  ? await Bun.file(enrichPath).json()
  : [];
const done = new Set(existing.map((e) => e.id));
// Global fetch cache: null = tried and failed, string = extracted text
const cache: { sites: Record<string, string | null>; handles: Record<string, string | null> } =
  (await Bun.file(cachePath).exists())
    ? await Bun.file(cachePath).json()
    : { sites: {}, handles: {} };

// ---- lead extraction --------------------------------------------------------
const urlRe =
  /https?:\/\/[^\s,)]+|(?:[a-z0-9-]+\.)+(?:com|io|xyz|dev|ai|in|co|me|org|net|sh|app|tech|site|fun|build|so|gg)(?:\/[^\s,)]*)?/gi;
const skipUrl =
  /(x\.com|twitter\.com|linkedin\.com|instagram\.com|discord\.gg|wa\.me|mailto:)/i;
const degreeNoise = /^[bm]\.?tech$/i; // "B.Tech" in bios matches the URL regex
const mentionRe = /@([a-zA-Z0-9_]{2,15})/g;

function normalizeSite(raw: string) {
  let url = raw.trim().replace(/[),.]+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.toLowerCase().replace(/\/$/, "");
}

function leadsFor(index: number) {
  const guest = guests[index];
  const p = profiles[index];
  const texts = [
    guest[socialField] ?? "",
    p.twitterProfile?.bio ?? "",
    p.linkedinProfile?.bio ?? "",
  ];
  const own = (p.twitterUrl ?? "").split("/").pop()?.toLowerCase();

  const sites = [...new Set(
    texts.flatMap((t) => t.match(urlRe) ?? [])
      .filter((u) => !skipUrl.test(u) && !degreeNoise.test(u) && u.length > 5)
      .map(normalizeSite),
  )].slice(0, 3);

  const mentions = [...new Set(
    (texts[1].match(mentionRe) ?? [])
      .map((m) => m.slice(1).toLowerCase())
      .filter((m) => m !== own && m.length >= 3),
  )].slice(0, 2);

  return { sites, mentions };
}

// ---- fetchers ---------------------------------------------------------------
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSite(url: string): Promise<string | null> {
  if (url in cache.sites) return cache.sites[url];
  let text: string | null = null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "Mozilla/5.0 (party context bot)" },
      redirect: "follow",
    });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.includes("html")) {
      const html = (await res.text()).slice(0, 200_000);
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const desc = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
      const body = stripHtml(html).slice(0, 1500);
      text = stripHtml(`${title}. ${desc}. ${body}`).slice(0, 1800) || null;
    }
  } catch {
    text = null;
  }
  cache.sites[url] = text;
  return text;
}

async function fetchHandle(handle: string): Promise<string | null> {
  if (handle in cache.handles) return cache.handles[handle];
  let text: string | null = null;
  try {
    const profile = await getTwitterProfile(`https://x.com/${handle}`);
    if (profile.bio || profile.name) {
      text = `@${handle} (${profile.name ?? handle}): ${profile.bio ?? ""}`.trim();
    }
  } catch {
    text = null;
  }
  cache.handles[handle] = text;
  return text;
}

// ---- summarize --------------------------------------------------------------
const client = new Anthropic();
const summaryModel = Bun.env.ENRICH_MODEL ?? "claude-haiku-4-5";

async function summarize(name: string, chunks: string[]): Promise<string> {
  const response = await client.messages.create({
    model: summaryModel,
    max_tokens: 300,
    system:
      "You condense raw scraped text into matching context for a party guest. " +
      "Write 2-4 plain sentences of concrete facts: what they build/do, their company or project, domains, notable interests. " +
      "Only state what the text supports — never invent. If the material is junk (cookie banners, nav menus) or clearly " +
      "about an unrelated person/account, reply with exactly: UNRELATED",
    messages: [{
      role: "user",
      content: `Guest: ${name}\n\nScraped material:\n${chunks.join("\n---\n").slice(0, 6000)}`,
    }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}

// ---- main -------------------------------------------------------------------
const queue = guests
  .map((guest, index) => ({ guest, index, leads: leadsFor(index) }))
  .filter(({ guest, leads }) =>
    !done.has(stableId(guest[emailField], guest.Name)) &&
    (leads.sites.length || leads.mentions.length)
  );

console.log(`${queue.length} guests with leads to enrich (${existing.size ?? existing.length} already done).`);

const results: Enrichment[] = [...existing];

await runPool({
  items: queue,
  concurrency: 5,
  name: ({ guest }) => guest.Name,
  run: async ({ guest, leads }) => {
    const chunks: string[] = [];
    const usedSites: string[] = [];
    const usedMentions: string[] = [];
    for (const site of leads.sites) {
      const text = await fetchSite(site);
      if (text) { chunks.push(`[website ${site}] ${text}`); usedSites.push(site); }
    }
    for (const handle of leads.mentions) {
      const text = await fetchHandle(handle);
      if (text) { chunks.push(`[mentioned account] ${text}`); usedMentions.push(handle); }
    }
    if (!chunks.length) return; // all leads dead — nothing to add

    const summary = await summarize(guest.Name, chunks);
    if (!summary || /^UNRELATED/i.test(summary)) return;
    results.push({
      id: stableId(guest[emailField], guest.Name),
      name: guest.Name,
      sources: { sites: usedSites, mentions: usedMentions },
      summary,
    });
  },
  checkpoint: async () => {
    await writeJsonAtomic(enrichPath, results);
    await writeJsonAtomic(cachePath, cache);
  },
});

const deadLeads = queue.length - (results.length - existing.length);
console.log(
  `Enriched ${results.length} guests total (+${results.length - existing.length} this run, ${deadLeads} had only dead leads).`,
);
