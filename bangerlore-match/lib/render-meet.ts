// "Who to Meet" renderer — the v5 party UI (identify yourself → your matches
// with reasons + icebreakers → browse the whole room), ported from the React
// prototype in "Bangerlore intros" to the project's zero-dependency style:
// a self-contained HTML page rendered at build time, with data embedded as
// JSON and a small inline vanilla-JS app for interactivity.
//
// XSS model: guest data never touches HTML at build time — it ships inside a
// <script type="application/json"> block (with `<` escaped to < so the
// block can't be closed early) and the client app only writes it to the DOM
// via textContent. Build-time interpolations (photo paths, counts) go through
// esc() as belt-and-braces.

import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";
import { esc, mutualPairs } from "./render";

export type MeetMatch = {
  id: string;
  reason: string;
  icebreaker: string;
  mutual: boolean;
};

export type MeetPerson = {
  id: string;
  name: string;
  role: string; // tag line shown under the name (mono)
  bio: string; // AI blurb
  lookingFor: string;
  twitter: string | null; // full URL
  photo: string | null; // localized avatar path or null → initials
  search: string; // invisible keyword index for browse search
  matches: MeetMatch[];
};

// Flatten blurbs + matches + social links into the shape the client app uses.
export function toPeople(
  blurbs: Blurb[],
  matches: GuestMatches[],
  twitterByName: Map<string, string> = new Map(),
): MeetPerson[] {
  const matchesById = new Map(matches.map((m) => [m.id, m]));
  const mutual = mutualPairs(matches);
  return blurbs.map((b) => {
    const twitter = twitterByName.get(b.name) ?? null;
    const personMatches = (matchesById.get(b.id)?.matches ?? [])
      .filter((m) => blurbs.some((x) => x.id === m.id))
      .map((m) => ({
        id: m.id,
        reason: m.reason,
        icebreaker: m.icebreaker,
        mutual: mutual.has(`${b.id}→${m.id}`),
      }));
    return {
      id: b.id,
      name: b.name,
      role: b.tags.join(" · "),
      bio: b.blurb,
      lookingFor: b.lookingFor,
      twitter,
      photo: b.profilePicUrl,
      search: [
        b.name,
        b.tags.join(" "),
        b.blurb,
        b.lookingFor,
        twitter,
        twitter?.split("/").pop(),
      ].filter(Boolean).join(" ").toLowerCase(),
      matches: personMatches,
    };
  });
}

// JSON safe for embedding in a <script> block: `<` can't terminate the block,
// and U+2028/29 are valid JSON but illegal in JS string literals (paranoia —
// we parse, not eval, but escaping costs nothing).
export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

// The headline says "Four people you should meet" — derive the word from the
// modal match count so the copy stays honest if the pipeline changes top-N.
export function matchCountWord(matches: GuestMatches[]): string {
  const tally = new Map<number, number>();
  for (const m of matches) {
    if (m.matches.length) tally.set(m.matches.length, (tally.get(m.matches.length) ?? 0) + 1);
  }
  let best = 4, bestCount = -1;
  for (const [n, c] of tally) if (c > bestCount) { best = n; bestCount = c; }
  return NUMBER_WORDS[best] ?? String(best);
}

// Deterministic shuffle for the hero collage (same LCG as the prototype) so
// builds are reproducible and the collage still looks varied.
function shuffled<T>(items: T[], seed = 20260606): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function collageMarkup(partyPhotos: string[]): string {
  if (!partyPhotos.length) return "";
  const photos = shuffled(partyPhotos);
  const tiles = Array.from({ length: 63 }, (_, i) => photos[i % photos.length]);
  return `<div class="hero-bg hero-collage" aria-hidden="true">
    <div class="hero-grid">${tiles.map((src) => `<img src="${esc(src)}" alt="" loading="lazy">`).join("")}</div>
    <div class="hero-grain"></div>
    <div class="hero-scrim"></div>
  </div>`;
}

export function renderMeetHtml(
  blurbs: Blurb[],
  matches: GuestMatches[],
  options: {
    twitterByName?: Map<string, string>;
    partyPhotos?: string[];
  } = {},
) {
  const people = toPeople(blurbs, matches, options.twitterByName);
  const data = { people, matchWord: matchCountWord(matches) };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/v5/match/">
<meta name="robots" content="noindex, nofollow">
<title>Bangerlore — Who to Meet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0e0c0b;
    --bg2: #161311;
    --bg3: #1f1a16;
    --line: rgba(255,255,255,0.09);
    --line2: rgba(255,255,255,0.14);
    --text: #ece6dc;
    --muted: #9c938a;
    --faint: #6c645b;
    --accent: #e23b4e;
    --accent2: #f08a3c;
    --serif: "Newsreader", Georgia, "Times New Roman", serif;
    --sans: "Space Grotesk", system-ui, sans-serif;
    --mono: "Space Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
  }
  ::selection { background: var(--accent); color: #fff; }
  [hidden] { display: none !important; }

  /* topbar */
  .topbar {
    background: var(--accent);
    color: #1a0608;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    padding: 13px 16px;
    font-family: var(--serif); font-size: 18px;
  }
  .tb-tag {
    background: #1a0608; color: #fff;
    padding: 4px 11px; border-radius: 5px; font-weight: 700;
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em;
  }
  .tb-text { color: #1a0608; white-space: nowrap; }
  .tb-text b { font-weight: 600; }
  /* masthead */
  .masthead { text-align: center; padding: 56px 20px 30px; }
  .logo {
    font-family: var(--serif); font-weight: 500;
    font-size: clamp(44px, 6.5vw, 72px); margin: 0; letter-spacing: -0.01em;
  }
  .logo-link { color: inherit; text-decoration: none; }
  .logo-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 6px; border-radius: 6px; }
  .clink { font-family: var(--sans); font-size: 0.78em; }
  .tagline {
    font-family: var(--serif); color: var(--text);
    font-size: clamp(18px, 2.4vw, 27px); margin: 14px 0 20px; font-weight: 400;
  }
  .masthead.compact { padding: 28px 20px 18px; }
  .masthead.compact .logo { font-size: clamp(28px, 5vw, 40px); }
  .logo-btn {
    background: none; border: 0; padding: 0; margin: 0; cursor: pointer;
    font: inherit; color: inherit; letter-spacing: inherit;
  }
  .back-link {
    display: inline-block; margin-top: 10px; background: none; border: 0;
    color: var(--muted); font-family: var(--mono); font-size: 12px; cursor: pointer;
    letter-spacing: 0.04em; padding: 6px 8px; border-bottom: 1px dashed var(--faint);
  }
  .back-link:hover { color: var(--accent); border-color: var(--accent); }

  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px 40px; }

  /* sections */
  .sec-kicker, .id-kicker {
    display: inline-flex; align-items: center; gap: 9px;
    font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.18em;
    color: var(--muted); text-transform: uppercase; margin-bottom: 14px;
  }
  .sec-kicker::before, .id-kicker::before {
    content: ""; width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent); flex: none;
  }
  .sec-h {
    font-family: var(--serif); font-weight: 500;
    font-size: clamp(28px, 4.5vw, 44px); margin: 0; letter-spacing: -0.01em;
  }
  .sec-sub { color: var(--muted); max-width: 52ch; margin: 12px 0 0; font-size: 15px; }
  .sec-head { margin-bottom: 26px; }

  /* ---------- firstview hero ---------- */
  .firstview { min-height: 100svh; display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .firstview .masthead, .firstview-body { position: relative; z-index: 2; }
  .firstview .masthead { padding: 40px 20px 4px; }
  .firstview .masthead .logo { font-size: clamp(30px, 4.4vw, 46px); }
  .firstview .masthead .tagline { font-size: clamp(15px, 1.9vw, 19px); color: var(--muted); margin: 10px 0 0; }
  .firstview-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 64px; }

  /* hero collage — pure black behind masthead, fades in under the tagline */
  .hero-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
  .hero-collage .hero-grid {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    display: grid; grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(0, 1fr); gap: 0; align-content: stretch;
    filter: grayscale(1) brightness(0.6) contrast(1.18);
    opacity: 0.64; overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, transparent 0px, transparent 90px, #000 360px, #000 calc(100% - 170px), transparent 100%);
            mask-image: linear-gradient(180deg, transparent 0px, transparent 90px, #000 360px, #000 calc(100% - 170px), transparent 100%);
  }
  .hero-collage .hero-scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(180deg, var(--bg) 0%, rgba(14,12,11,0.72) 200px, rgba(14,12,11,0.5) 360px, rgba(14,12,11,0.66) 100%),
      radial-gradient(90% 55% at 50% 100%, rgba(226,59,78,0.16), transparent 70%);
  }
  .hero-collage .hero-grid img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 4 / 3; }
  .hero-collage .hero-grain {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    opacity: 0.9; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 180px 180px;
    -webkit-mask-image: linear-gradient(180deg, transparent 0px, transparent 90px, #000 360px, #000 calc(100% - 170px), transparent 100%);
            mask-image: linear-gradient(180deg, transparent 0px, transparent 90px, #000 360px, #000 calc(100% - 170px), transparent 100%);
  }
  @media (max-width: 760px) {
    .hero-collage .hero-grid {
      top: 132px;
      bottom: auto;
      height: calc(100svh - 132px);
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(6, minmax(0, 1fr));
      grid-auto-rows: 0;
      align-content: stretch;
      opacity: 0.42;
      -webkit-mask-image: linear-gradient(180deg, transparent 0px, #000 84px, #000 calc(100% - 110px), transparent 100%);
              mask-image: linear-gradient(180deg, transparent 0px, #000 84px, #000 calc(100% - 110px), transparent 100%);
    }
    .hero-collage .hero-grid img:nth-child(n + 19) { display: none; }
    .hero-collage .hero-grid img { aspect-ratio: auto; }
    .hero-collage .hero-grain {
      opacity: 0.58;
      -webkit-mask-image: linear-gradient(180deg, transparent 0px, transparent 120px, #000 240px, #000 calc(100% - 120px), transparent 100%);
              mask-image: linear-gradient(180deg, transparent 0px, transparent 120px, #000 240px, #000 calc(100% - 120px), transparent 100%);
    }
  }

  /* ---------- identify ---------- */
  .identify { text-align: center; padding: 8px 0; }
  .identify .id-kicker { justify-content: center; }
  .id-h { font-family: var(--serif); font-weight: 500; font-size: clamp(34px, 6vw, 60px); margin: 0; }
  .id-sub { color: var(--muted); margin: 10px 0 26px; }
  .id-search { position: relative; max-width: 460px; margin: 0 auto; text-align: left; }
  .id-search input {
    width: 100%; background: var(--bg2); border: 1px solid var(--line2);
    color: var(--text); font-family: var(--serif); font-size: 22px;
    padding: 16px 20px; border-radius: 12px; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .id-search input::placeholder { color: var(--faint); font-style: italic; }
  .id-search input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(226,59,78,0.18); }
  .lazy-link {
    display: inline-block; margin: 22px auto 0; background: none; border: 0;
    color: var(--muted); font-family: var(--mono); font-size: 13px; cursor: pointer;
    letter-spacing: 0.03em; padding: 8px; border-bottom: 1px dashed var(--faint);
  }
  .lazy-link:hover { color: var(--accent); border-color: var(--accent); }
  .id-drop {
    position: absolute; left: 0; right: 0; top: calc(100% + 8px);
    background: var(--bg2); border: 1px solid var(--line2); border-radius: 12px;
    overflow: hidden; z-index: 20; box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  }
  .id-opt {
    display: flex; align-items: center; gap: 12px; width: 100%;
    background: none; border: 0; border-bottom: 1px solid var(--line);
    padding: 11px 14px; cursor: pointer; color: var(--text); text-align: left;
  }
  .id-opt:last-child { border-bottom: 0; }
  .id-opt:hover { background: var(--bg3); }
  .id-opt-name { font-family: var(--serif); font-size: 17px; }
  .id-opt-role { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-left: auto;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
  .id-empty { padding: 16px; color: var(--faint); font-style: italic; font-family: var(--serif); }

  /* ---------- avatar ---------- */
  .avatar {
    display: inline-flex; align-items: center; justify-content: center;
    overflow: hidden; flex: none; color: #f4efe7;
    font-family: var(--serif); font-weight: 600; letter-spacing: 0.01em;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* ---------- board ---------- */
  .board { display: grid; grid-template-columns: 280px 1fr; gap: 40px; align-items: start; }
  .board-matches { min-width: 0; }

  .you-card {
    background: linear-gradient(180deg, var(--bg2), var(--bg));
    border: 1px solid var(--line2); border-radius: 18px;
    padding: 28px 24px; text-align: center; position: sticky; top: 22px;
  }
  .you-tag {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.2em;
    color: var(--accent); margin-bottom: 18px;
  }
  .you-card .avatar { margin: 0 auto; }
  .you-name { font-family: var(--serif); font-size: 26px; margin-top: 18px; line-height: 1.1; }
  .you-role { font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin-top: 8px; }
  .you-bio { color: var(--muted); font-size: 13.5px; margin: 14px 0 16px; line-height: 1.55; }
  .you-looking {
    border-top: 1px solid var(--line); padding-top: 14px; margin: 0 0 16px;
    font-size: 13px; color: var(--muted); line-height: 1.5;
  }
  .you-looking b {
    display: block; font-family: var(--mono); font-weight: 400; font-size: 10px;
    letter-spacing: 0.18em; color: var(--accent2); margin-bottom: 6px;
  }
  .you-change {
    display: block; margin: 18px auto 0; background: none; border: 0;
    color: var(--faint); font-family: var(--mono); font-size: 11px; cursor: pointer;
    letter-spacing: 0.04em;
  }
  .you-change:hover { color: var(--accent); }

  /* shared name/role */
  .m-name { font-family: var(--serif); font-size: 19px; line-height: 1.15; display: block; }
  .m-role { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .mutual {
    display: inline-block; font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
    color: var(--accent2); background: rgba(240,138,60,0.12); border-radius: 999px;
    padding: 2px 9px; margin-left: 8px; vertical-align: 2px; white-space: nowrap;
  }

  /* twitter btn */
  .tw-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--bg3); border: 1px solid var(--line2); color: var(--text);
    text-decoration: none; font-family: var(--mono); font-size: 12px;
    padding: 7px 13px; border-radius: 8px; transition: border-color .15s, background .15s;
  }
  .tw-btn:hover { border-color: var(--accent); background: var(--bg2); }
  .tw-x { font-size: 13px; }

  .detail-body { padding-top: 4px; }
  .detail-body .bio { color: var(--text); font-family: var(--serif); font-size: 16px; line-height: 1.6; margin: 0 0 14px; }
  .detail-body .bio.muted { color: var(--faint); font-style: italic; }
  .detail-body .looking { color: var(--muted); font-size: 13.5px; margin: 0 0 14px; }
  .detail-body .looking b {
    font-family: var(--mono); font-weight: 400; font-size: 10px;
    letter-spacing: 0.18em; color: var(--accent2); margin-right: 8px;
  }
  .icebreaker {
    border-left: 2px solid var(--accent); padding: 2px 0 2px 14px; margin: 0 0 14px;
  }
  .icebreaker b {
    display: block; font-family: var(--mono); font-weight: 400; font-size: 10px;
    letter-spacing: 0.18em; color: var(--accent); margin-bottom: 4px;
  }
  .icebreaker q { font-family: var(--serif); font-style: italic; font-size: 15.5px; color: var(--text); }
  .detail-actions { display: flex; gap: 10px; flex-wrap: wrap; }

  /* ===== match list (roster) ===== */
  .m-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .m-row {
    background: var(--bg2); border: 1px solid var(--line); border-radius: 14px;
    overflow: hidden; transition: border-color .15s;
  }
  .m-row:hover { border-color: var(--line2); }
  .m-row.open { border-color: var(--accent); }
  .m-row-head {
    display: flex; align-items: center; gap: 16px; width: 100%;
    background: none; border: 0; padding: 16px 18px; cursor: pointer; color: var(--text); text-align: left;
  }
  .m-num { font-family: var(--mono); font-size: 13px; color: var(--accent); width: 22px; flex: none; }
  .m-id { flex: 1; min-width: 0; }
  .m-id .m-role { display: block; margin-top: 3px; }
  .m-chev { font-family: var(--mono); font-size: 22px; color: var(--muted); flex: none; }
  .m-row .detail-body { padding: 0 18px 18px 56px; }

  .match-sec { margin-bottom: 80px; }

  /* ---------- browse ---------- */
  .browse { border-top: 1px solid var(--line); padding-top: 56px; margin-bottom: 70px; }
  .browse-controls { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .browse-search {
    flex: 1; min-width: 220px; background: var(--bg2); border: 1px solid var(--line2);
    color: var(--text); font-family: var(--sans); font-size: 15px; padding: 12px 16px;
    border-radius: 10px; outline: none;
  }
  .browse-search:focus { border-color: var(--accent); }
  .browse-search::placeholder { color: var(--faint); }
  .shuffle {
    background: var(--bg3); border: 1px solid var(--line2); color: var(--text);
    font-family: var(--mono); font-size: 13px; padding: 0 20px; border-radius: 10px;
    cursor: pointer; letter-spacing: 0.04em; transition: border-color .15s, color .15s;
  }
  .shuffle:hover { border-color: var(--accent); color: var(--accent); }
  .browse-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(238px, 1fr)); gap: 12px;
  }
  .b-card {
    display: flex; align-items: center; gap: 13px; width: 100%; text-align: left;
    background: var(--bg2); border: 1px solid var(--line); border-radius: 12px;
    padding: 12px 14px; cursor: pointer; color: var(--text); transition: border-color .15s, background .15s;
  }
  .b-card:hover { border-color: var(--accent); background: var(--bg3); }
  .b-id { min-width: 0; }
  .b-name { font-family: var(--serif); font-size: 16px; display: block; line-height: 1.2; }
  .b-role { font-family: var(--mono); font-size: 10.5px; color: var(--muted); display: block; margin-top: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }

  /* ---------- modal ---------- */
  .modal-scrim {
    position: fixed; inset: 0; background: rgba(6,5,4,0.78); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 50;
    animation: fade .15s ease;
  }
  @keyframes fade { from { opacity: 0; } }
  .modal {
    background: var(--bg2); border: 1px solid var(--line2); border-radius: 20px;
    padding: 34px; max-width: 440px; width: 100%; position: relative;
    box-shadow: 0 30px 80px rgba(0,0,0,0.7);
    max-height: 86svh; overflow-y: auto;
  }
  .modal-head { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
  .modal-name { font-family: var(--serif); font-size: 28px; line-height: 1.1; }
  .x-close {
    background: none; border: 0; color: var(--muted); font-size: 16px; cursor: pointer;
    width: 30px; height: 30px; border-radius: 50%; flex: none;
  }
  .x-close:hover { color: var(--text); background: var(--bg3); }
  .x-close.abs { position: absolute; top: 16px; right: 16px; }

  /* ---------- footer ---------- */
  .foot {
    text-align: center; padding: 28px 20px 60px; border-top: 1px solid var(--line);
    font-family: "Times New Roman", Times, serif; font-size: 16px; color: var(--muted);
  }
  .foot p { margin: 0 0 8px; }
  .foot nav { font-size: 16px; }
  .foot a { color: var(--text); text-decoration: underline; text-underline-offset: 2px; }
  .foot a:visited { color: var(--text); }
  .foot a:hover { color: var(--accent); }

  /* ---------- responsive ---------- */
  @media (max-width: 760px) {
    .wrap { padding: 0 16px 32px; }
    .topbar { gap: 8px; padding: 10px 14px; font-size: 14px; flex-wrap: wrap; }
    .tb-tag { font-size: 9.5px; padding: 3px 8px; }
    .firstview .masthead { padding: 30px 16px 4px; }
    .firstview-body { padding-bottom: 40px; }
    .id-h { font-size: clamp(38px, 13vw, 52px); }
    .id-search input { font-size: 19px; padding: 15px 18px; }

    .board { grid-template-columns: 1fr; gap: 20px; }
    .you-card { position: static; display: grid; grid-template-columns: auto 1fr; gap: 4px 18px; text-align: left; align-items: center; padding: 18px; }
    .you-card .avatar { grid-row: span 2; width: 64px !important; height: 64px !important; font-size: 22px !important; }
    .you-tag { grid-column: 1 / -1; margin-bottom: 4px; }
    .you-name { margin-top: 0; font-size: 22px; }
    .you-bio, .you-looking, .you-card .tw-btn, .you-change { grid-column: 1 / -1; }
    .you-bio { margin: 10px 0 12px; }

    .m-row-head { gap: 12px; padding: 14px; }
    .m-row .detail-body { padding: 0 14px 16px 14px; }
    .m-num { width: 18px; }

    .browse-grid { grid-template-columns: 1fr; }
    .browse-search { font-size: 16px; }
    .browse-controls { gap: 10px; }
    .shuffle { padding: 12px 18px; }
    .modal { padding: 26px 22px; border-radius: 16px; }
    .modal-name { font-size: 24px; }
  }
</style>
</head>
<body>
<div class="topbar">
  <span class="tb-tag">ANNOUNCEMENT</span>
  <span class="tb-text">Welcome to <b>Bangerlore v5</b></span>
</div>

<section class="firstview" id="firstview">
  ${collageMarkup(options.partyPhotos ?? [])}
  <header class="masthead">
    <h1 class="logo"><a class="logo-link" href="https://bangerlore.com/">Bangerlore <span class="clink">🍻</span></a></h1>
    <p class="tagline">the room is full of people you don't know yet</p>
  </header>
  <div class="wrap firstview-body">
    <div class="identify">
      <div class="id-kicker"><span>STEP ONE</span></div>
      <h2 class="id-h">Who are you?</h2>
      <p class="id-sub">${people.length} people in the house. Find yourself to see your ${esc(data.matchWord)}.</p>
      <div class="id-search">
        <input id="id-input" placeholder="Type your name…" autocomplete="off">
        <div class="id-drop" id="id-drop" hidden></div>
      </div>
      <button class="lazy-link" id="lazy-link">I'm lazy — just show me everyone ↓</button>
    </div>
  </div>
</section>

<header class="masthead compact" id="masthead-compact" hidden>
  <h1 class="logo"><button class="logo-btn" id="logo-back" title="Back to search">Bangerlore <span class="clink">🍻</span></button></h1>
  <button class="back-link" id="back-link">← not you? search someone else</button>
</header>
<main class="wrap" id="match-root" hidden></main>

<main class="wrap">
  <section class="browse" id="browse">
    <div class="sec-head">
      <div class="sec-kicker"><span>EVERYONE ELSE</span></div>
      <h2 class="sec-h">Browse the whole room</h2>
    </div>
    <div class="browse-controls">
      <input class="browse-search" id="browse-search" placeholder="search all attendees, random keywords ok too">
      <button class="shuffle" id="shuffle-btn">⤬ Shuffle</button>
    </div>
    <div class="browse-grid" id="browse-grid"></div>
    <div class="id-empty" id="browse-empty" hidden>Nobody by that name.</div>
  </section>
</main>

<footer class="foot">
  <p class="foot-hosts">
    <a href="https://x.com/5hroff">Kunal Shroff</a> ·
    <a href="https://namanmaheshwari.com">Naman Maheshwari</a>
  </p>
  <nav>
    <a href="https://bangerlore.com/hosts.html">conspirators</a> ·
    <a href="mailto:neil.shroff@gmail.com">contact us</a> ·
    <a href="https://x.com/search?q=bangerlore%20min_faves%3A15%20until%3A2026-01-01%20since%3A2024-05-01&amp;src=typed_query&amp;f=live">twitter</a> ·
    <a href="https://bangerlore.com/">bangerlore</a> ·
    <a href="#">fund</a>
  </nav>
</footer>

<div id="modal-root"></div>

<script type="application/json" id="bl-data">${embedJson(data)}</script>
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("bl-data").textContent);
  var PEOPLE = DATA.people;
  var byId = new Map(PEOPLE.map(function (p) { return [p.id, p]; }));
  var LS_ME = "bl_me_v1";

  /* ---------- tiny DOM helper (textContent only — no HTML from data) ---------- */
  function el(tag, className, children) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---------- helpers (ported from the prototype) ---------- */
  function initials(name) {
    var parts = (name || "").trim().split(/\\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function hueFromName(name) {
    var x = 0;
    for (var i = 0; i < name.length; i++) x = (x * 31 + name.charCodeAt(i)) >>> 0;
    return x % 360;
  }
  function twitterHandle(url) {
    var m = (url || "").match(/(?:twitter|x)\\.com\\/(@?[A-Za-z0-9_]+)/i);
    return m ? "@" + m[1].replace(/^@/, "") : null;
  }
  function rank(list, q) {
    q = q.trim().toLowerCase();
    if (!q) return list;
    return list
      .map(function (p) {
        var n = p.name.toLowerCase();
        var haystack = p.search || [p.name, p.role, p.bio, p.lookingFor, p.twitter].join(" ").toLowerCase();
        var score = -1;
        if (n === q) score = 100;
        else if (n.indexOf(q) === 0) score = 80;
        else if (n.indexOf(q) !== -1) score = 50;
        else if ((p.role || "").toLowerCase().indexOf(q) !== -1) score = 20;
        else if ((p.bio || "").toLowerCase().indexOf(q) !== -1) score = 10;
        else if (haystack.indexOf(q) !== -1) score = 8;
        return { p: p, score: score };
      })
      .filter(function (x) { return x.score >= 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (x) { return x.p; });
  }

  /* ---------- atoms ---------- */
  function avatarEl(p, size, ring) {
    var span = el("span", "avatar");
    span.style.width = size + "px";
    span.style.height = size + "px";
    span.style.borderRadius = "50%";
    span.style.fontSize = Math.round(size * 0.34) + "px";
    if (ring) span.style.boxShadow = "0 0 0 2px var(--accent), 0 0 0 4px var(--bg)";
    function showInitials() {
      var h = hueFromName(p.name || "");
      span.textContent = initials(p.name);
      span.style.background = "linear-gradient(140deg, oklch(0.46 0.11 " + h + "), oklch(0.28 0.09 " + ((h + 50) % 360) + "))";
    }
    if (p.photo) {
      span.style.background = "var(--bg3)";
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { img.remove(); showInitials(); };
      img.src = p.photo;
      span.appendChild(img);
    } else {
      showInitials();
    }
    return span;
  }

  function twBtn(p) {
    var handle = twitterHandle(p.twitter);
    if (!handle) return null;
    var a = el("a", "tw-btn", [el("span", "tw-x", ["𝕏"]), handle]);
    a.href = p.twitter;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.addEventListener("click", function (e) { e.stopPropagation(); });
    return a;
  }

  /* detail body for a PERSON (browse modal / your card context) */
  function personDetail(p) {
    var body = el("div", "detail-body");
    body.appendChild(p.bio
      ? el("p", "bio", [p.bio])
      : el("p", "bio muted", ["No intro yet — go find out in person."]));
    if (p.lookingFor) {
      body.appendChild(el("p", "looking", [el("b", null, ["LOOKING FOR"]), p.lookingFor]));
    }
    body.appendChild(el("div", "detail-actions", [twBtn(p)]));
    return body;
  }

  /* detail body for a MATCH (reason + icebreaker) */
  function matchDetail(person, match) {
    var body = el("div", "detail-body");
    body.appendChild(el("p", "bio", [match.reason]));
    if (match.icebreaker) {
      body.appendChild(el("div", "icebreaker", [
        el("b", null, ["SAY THIS"]),
        el("q", null, [match.icebreaker]),
      ]));
    }
    body.appendChild(el("div", "detail-actions", [twBtn(person)]));
    return body;
  }

  /* ---------- identify ---------- */
  var idInput = document.getElementById("id-input");
  var idDrop = document.getElementById("id-drop");
  var idFocused = false;

  function renderDrop() {
    var q = idInput.value;
    var open = idFocused && q.trim().length > 0;
    idDrop.hidden = !open;
    if (!open) return;
    idDrop.textContent = "";
    var results = rank(PEOPLE, q).slice(0, 6);
    if (!results.length) {
      idDrop.appendChild(el("div", "id-empty", ["No match — try another spelling."]));
      return;
    }
    results.forEach(function (p) {
      var opt = el("button", "id-opt", [
        avatarEl(p, 34),
        el("span", "id-opt-name", [p.name]),
        p.role ? el("span", "id-opt-role", [p.role]) : null,
      ]);
      opt.addEventListener("mousedown", function () { pick(p); });
      idDrop.appendChild(opt);
    });
  }
  idInput.addEventListener("input", renderDrop);
  idInput.addEventListener("focus", function () { idFocused = true; renderDrop(); });
  idInput.addEventListener("blur", function () {
    setTimeout(function () { idFocused = false; renderDrop(); }, 150);
  });

  document.getElementById("lazy-link").addEventListener("click", function () {
    document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- match section ---------- */
  var firstview = document.getElementById("firstview");
  var compact = document.getElementById("masthead-compact");
  var matchRoot = document.getElementById("match-root");
  var openMatchId = null;

  function numberWord(n) {
    var words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    return words[n] || String(n);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function youCard(me) {
    var card = el("aside", "you-card", [
      el("div", "you-tag", ["THIS IS YOU"]),
      avatarEl(me, 120, true),
      el("div", "you-name", [me.name]),
      me.role ? el("div", "you-role", [me.role]) : null,
      me.bio ? el("p", "you-bio", [me.bio]) : null,
      me.lookingFor ? el("p", "you-looking", [el("b", null, ["LOOKING FOR"]), me.lookingFor]) : null,
      twBtn(me),
    ]);
    var change = el("button", "you-change", ["← not you? change"]);
    change.addEventListener("click", reset);
    card.appendChild(change);
    return card;
  }

  function renderMatchSection(me) {
    matchRoot.textContent = "";
    var resolved = (me.matches || [])
      .map(function (m) {
        var p = byId.get(m.id);
        return p ? { person: p, match: m } : null;
      })
      .filter(Boolean);

    var list = el("ol", "m-list");
    resolved.forEach(function (entry, i) {
      var p = entry.person, m = entry.match;
      var open = openMatchId === p.id;
      var row = el("li", "m-row" + (open ? " open" : ""));
      var nameSpan = el("span", "m-name", [p.name]);
      if (m.mutual) nameSpan.appendChild(el("span", "mutual", ["⚡ picked you too"]));
      var head = el("button", "m-row-head", [
        el("span", "m-num", [String(i + 1).padStart(2, "0")]),
        avatarEl(p, 52),
        el("span", "m-id", [nameSpan, p.role ? el("span", "m-role", [p.role]) : null]),
        el("span", "m-chev", [open ? "–" : "+"]),
      ]);
      head.addEventListener("click", function () {
        openMatchId = openMatchId === p.id ? null : p.id;
        renderMatchSection(me);
      });
      row.appendChild(head);
      if (open) row.appendChild(matchDetail(p, m));
      list.appendChild(row);
    });

    var n = resolved.length;
    var section = el("section", "match-sec", [
      el("div", "sec-head", [
        el("div", "sec-kicker", [el("span", null, ["STEP TWO · CURATED FOR YOU"])]),
        el("h2", "sec-h", [cap(numberWord(n)) + " " + (n === 1 ? "person" : "people") + " you should meet"]),
        el("p", "sec-sub", ["Matched on what you're both into — tap anyone for the why and an opening line."]),
      ]),
      el("div", "board", [youCard(me), el("div", "board-matches", [list])]),
    ]);
    matchRoot.appendChild(section);
  }

  /* ---------- pick / reset ---------- */
  var me = null;

  function setMode(hasMe) {
    firstview.hidden = hasMe;
    compact.hidden = !hasMe;
    matchRoot.hidden = !hasMe;
  }

  function pick(p) {
    me = p;
    openMatchId = null;
    try { localStorage.setItem(LS_ME, p.id); } catch (e) {}
    renderMatchSection(p);
    setMode(true);
    renderBrowse();
    window.scrollTo({ top: 0 });
  }

  function reset() {
    me = null;
    try { localStorage.removeItem(LS_ME); } catch (e) {}
    setMode(false);
    renderBrowse();
    idInput.value = "";
    window.scrollTo({ top: 0 });
    // straight back into "search another person" — one less tap
    setTimeout(function () { idInput.focus(); }, 0);
  }
  document.getElementById("back-link").addEventListener("click", reset);
  document.getElementById("logo-back").addEventListener("click", reset);

  /* ---------- browse ---------- */
  var browseInput = document.getElementById("browse-search");
  var browseGrid = document.getElementById("browse-grid");
  var browseEmpty = document.getElementById("browse-empty");
  var shuffleSeed = (Date.now() % 100000) + 1;

  function browseList() {
    var l = PEOPLE.filter(function (p) { return !me || p.id !== me.id; });
    var q = browseInput.value;
    if (q.trim()) return rank(l, q);
    if (shuffleSeed) {
      l = l.slice();
      var s = shuffleSeed;
      for (var i = l.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) >>> 0;
        var j = s % (i + 1);
        var t = l[i]; l[i] = l[j]; l[j] = t;
      }
    }
    return l;
  }

  function renderBrowse() {
    var list = browseList();
    browseGrid.textContent = "";
    list.forEach(function (p) {
      var card = el("button", "b-card", [
        avatarEl(p, 48),
        el("span", "b-id", [
          el("span", "b-name", [p.name]),
          p.role ? el("span", "b-role", [p.role]) : null,
        ]),
      ]);
      card.addEventListener("click", function () { openModal(p); });
      browseGrid.appendChild(card);
    });
    browseEmpty.hidden = list.length > 0;
  }
  browseInput.addEventListener("input", renderBrowse);
  document.getElementById("shuffle-btn").addEventListener("click", function () {
    browseInput.value = "";
    shuffleSeed = (Date.now() % 100000) + 1;
    renderBrowse();
  });

  /* ---------- modal ---------- */
  var modalRoot = document.getElementById("modal-root");
  function closeModal() { modalRoot.textContent = ""; }
  function openModal(p) {
    closeModal();
    var x = el("button", "x-close abs", ["✕"]);
    x.addEventListener("click", closeModal);
    var modal = el("div", "modal", [
      x,
      el("div", "modal-head", [
        avatarEl(p, 88),
        el("div", null, [
          el("div", "modal-name", [p.name]),
          p.role ? el("div", "m-role", [p.role]) : null,
        ]),
      ]),
      personDetail(p),
    ]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var scrim = el("div", "modal-scrim", [modal]);
    scrim.addEventListener("click", closeModal);
    modalRoot.appendChild(scrim);
  }
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- boot ---------- */
  var savedId = null;
  try { savedId = localStorage.getItem(LS_ME); } catch (e) {}
  var saved = savedId && byId.get(savedId);
  if (saved) {
    me = saved;
    renderMatchSection(saved);
    setMode(true);
  }
  renderBrowse();
})();
</script>
</body>
</html>`;
}
