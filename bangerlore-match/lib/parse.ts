// Pure URL-extraction helpers shared by index.ts and tests.
// Moved verbatim from index.ts during eng review (2026-06-05).

export function normalizeUrl(value: string) {
  const url = value.trim().replace(/[),.]+$/, "");
  return /^https?:\/\//i.test(url) ? url.replace(/^https?:\/\//i, "https://") : `https://${url}`;
}

export function twitterUrl(text: string) {
  const url = text.match(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})/);
  const handle = url?.[1] ?? text.match(/@([a-zA-Z0-9_]{1,15})/)?.[1];
  return handle ? `https://x.com/${handle}` : null;
}

export function linkedinUrl(text: string) {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,)]+/i);
  if (!match) return null;

  const url = new URL(normalizeUrl(match[0]));
  return `${url.origin}${url.pathname}`.replace(/\/$/, "");
}
