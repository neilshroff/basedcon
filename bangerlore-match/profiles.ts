export type SocialProfile = {
  url: string;
  name: string | null;
  profilePicUrl: string | null;
  bio: string | null;
};

type FetchHtml = (url: string) => Promise<string>;

let fetchHtmlPromise: Promise<{ fetchHtml: FetchHtml }> | null = null;

function fetcher() {
  fetchHtmlPromise ??= import("./lib/zenrows.ts") as Promise<{ fetchHtml: FetchHtml }>;
  return fetchHtmlPromise;
}

export function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function attrs(tag: string) {
  const entries = [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)]
    .map(([, key, , value]) => [key.toLowerCase(), decodeHtml(value)]);
  return Object.fromEntries(entries);
}

function meta(html: string, keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attr = attrs(tag);
    const key = attr.property ?? attr.name;
    if (key && wanted.has(key.toLowerCase()) && attr.content) {
      return attr.content;
    }
  }
  return null;
}

function zenRowsError(html: string, url: string) {
  const trimmed = html.trim();
  if (!trimmed.startsWith("{")) return;

  try {
    const data = JSON.parse(trimmed) as { code?: string; status?: number; title?: string };
    if (data.code || data.status || data.title) {
      throw new Error(`ZenRows failed for ${url}: ${data.title ?? data.code ?? data.status}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ZenRows failed")) throw error;
  }
}

function title(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1].replace(/<[^>]+>/g, "")) : null;
}

function twitterHandle(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? null;
}

function twitterInitialState(html: string) {
  const marker = "window.__INITIAL_STATE__=";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd === -1) return null;

  const raw = html.slice(jsonStart, jsonEnd).replace(/;\s*$/, "");
  try {
    return JSON.parse(raw) as {
      entities?: {
        users?: {
          entities?: Record<string, {
            name?: string;
            screen_name?: string;
            description?: string;
            profile_image_url_https?: string;
          }>;
        };
      };
    };
  } catch {
    return null;
  }
}

function unescapeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return decodeHtml(value.replace(/\\"/g, '"'));
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lastJsonField(chunk: string, field: string) {
  const matches = [...chunk.matchAll(
    new RegExp(`"${escapeRegExp(field)}":"((?:\\\\.|[^"\\\\])*)"`, "g"),
  )];
  return matches.at(-1)?.[1] ? unescapeJsonString(matches.at(-1)![1]) : null;
}

function firstJsonField(chunk: string, field: string) {
  const match = chunk.match(
    new RegExp(`"${escapeRegExp(field)}":"((?:\\\\.|[^"\\\\])*)"`, "g"),
  )?.[0];
  const value = match?.match(/:"((?:\\.|[^"\\])*)"/)?.[1];
  return value ? unescapeJsonString(value) : null;
}

function twitterUserFromRawState(html: string, url: string) {
  const handle = twitterHandle(url);
  if (!handle) return null;

  const screenName = `"screen_name":"${escapeRegExp(handle)}"`;
  const index = html.search(new RegExp(screenName, "i"));
  if (index === -1) return null;

  const before = html.slice(Math.max(0, index - 3000), index);
  const after = html.slice(index, index + 3000);
  return {
    name: lastJsonField(before, "name"),
    description: lastJsonField(before, "description"),
    profile_image_url_https: firstJsonField(after, "profile_image_url_https"),
  };
}

function twitterUser(html: string, url: string) {
  const users = twitterInitialState(html)?.entities?.users?.entities;
  if (!users) return twitterUserFromRawState(html, url);

  const handle = twitterHandle(url);
  const allUsers = Object.values(users);
  return allUsers.find((user) => user.screen_name?.toLowerCase() === handle) ?? allUsers[0] ?? null;
}

function jsonLdPeople(html: string) {
  const people: Record<string, unknown>[] = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  function collect(value: unknown) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== "object") return;

    const item = value as Record<string, unknown>;
    const type = item["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => String(entry).toLowerCase() === "person")) {
      people.push(item);
    }
    Object.values(item).forEach(collect);
  }

  for (const [, raw] of scripts) {
    try {
      collect(JSON.parse(decodeHtml(raw)));
    } catch {
      // Ignore invalid embedded JSON.
    }
  }

  return people;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? decodeHtml(value) : null;
}

function imageValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const image = value as Record<string, unknown>;
  return textValue(image.contentUrl) ?? textValue(image.url);
}

export function cleanTwitterName(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\s+\(@[^)]+\).*$/, "")
    .replace(/\s+(?:\/ X|on X|on Twitter|\| Twitter).*$/i, "")
    .trim() || null;
}

export function cleanTwitterBio(value: string | null) {
  if (!value) return null;

  const latestPosts = value.match(/^The latest posts from .+?\(@[^)]+\)\.?\s*(.*)$/i);
  return (latestPosts?.[1] ?? value).trim() || null;
}

export function cleanLinkedInName(value: string | null) {
  if (!value) return null;
  return value.replace(/\s+\| LinkedIn.*$/i, "").trim() || null;
}

export function cleanLinkedInBio(value: string | null) {
  if (!value) return null;

  const generic = value.match(/^View .+?'?s profile on LinkedIn,\s*(.*)$/i);
  return (generic?.[1] ?? value).trim() || null;
}

export async function getTwitterProfile(url: string): Promise<SocialProfile> {
  const { fetchHtml } = await fetcher();
  const html = await fetchHtml(url);
  zenRowsError(html, url);

  const user = twitterUser(html, url);
  const pageTitle = meta(html, ["og:title", "twitter:title"]) ?? title(html);
  const description = meta(html, ["og:description", "twitter:description"]);
  const name = textValue(user?.name) ?? cleanTwitterName(pageTitle);
  const profilePicUrl = textValue(user?.profile_image_url_https)?.replace("_normal.", ".") ??
    meta(html, ["og:image", "twitter:image"]);
  const bio = textValue(user?.description) ?? cleanTwitterBio(description);

  if (!name && !profilePicUrl && !bio && html.includes("ScriptLoadFailure")) {
    throw new Error(`X profile data was not available in ZenRows response for ${url}`);
  }

  return {
    url,
    name,
    profilePicUrl,
    bio,
  };
}

export async function getLinkedInProfile(url: string): Promise<SocialProfile> {
  const { fetchHtml } = await fetcher();
  const html = await fetchHtml(url);
  zenRowsError(html, url);

  const person = jsonLdPeople(html)[0];
  const pageTitle = textValue(person?.name) ?? meta(html, ["og:title"]) ?? title(html);
  const description = textValue(person?.description) ?? meta(html, ["og:description"]);

  return {
    url,
    name: cleanLinkedInName(pageTitle),
    profilePicUrl: imageValue(person?.image) ?? meta(html, ["og:image"]),
    bio: cleanLinkedInBio(description),
  };
}

if (import.meta.main) {
  const [twitter, linkedin] = Bun.argv.slice(2);
  if (twitter) console.log(await getTwitterProfile(twitter));
  if (linkedin) console.log(await getLinkedInProfile(linkedin));
}
