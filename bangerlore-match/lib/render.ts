// HTML rendering for matches.html, extracted from build-html.ts during eng
// review (2026-06-05) so escaping and card logic are testable with fixtures.

import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";

// Privacy gate (eng review D15): client-side passphrase. This is a DETERRENT
// against casual link-forwarding and search indexing, not real security — the
// data is in the page source. Real access control would need tokenized
// per-guest links (deferred). Base64 keeps the phrase out of naive page-source
// scans only. Shared by matches.html and graph.html builders.
export function gateTokenFor(passphrase: string | undefined): string | null {
  return passphrase
    ? Buffer.from(passphrase.trim().toLowerCase()).toString("base64")
    : null;
}

export function gateMarkup(gateToken: string | null): string {
  if (!gateToken) return "";
  return `<div id="gate">
  <h1>Bangerlore Match</h1>
  <div class="hint">Enter the party passphrase (it&rsquo;s on the QR poster)</div>
  <input id="gate-input" type="text" autocomplete="off" autocapitalize="none" placeholder="passphrase">
</div>
<script>
  (function () {
    var TOKEN = "${gateToken}";
    var gate = document.getElementById("gate");
    var input = document.getElementById("gate-input");
    function ok(value) { return btoa(value.trim().toLowerCase()) === TOKEN; }
    if (localStorage.getItem("bm-gate") === TOKEN) { gate.remove(); return; }
    input.addEventListener("input", function () {
      if (ok(input.value)) {
        localStorage.setItem("bm-gate", TOKEN);
        gate.remove();
      }
    });
  })();
</script>`;
}

export function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatar(blurb: Blurb, size: string) {
  if (blurb.profilePicUrl) {
    return `<img class="avatar ${size}" src="${esc(blurb.profilePicUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'avatar ${size} fallback\\'>${esc(blurb.name[0] ?? "?")}</div>'">`;
  }
  return `<div class="avatar ${size} fallback">${esc(blurb.name[0] ?? "?")}</div>`;
}

// Reciprocal pairs: A's top-3 contains B AND B's top-3 contains A. The badge
// renders only on match rows inside a guest's own card (positive signal only —
// there is deliberately no "they didn't pick you" state anywhere in the UI).
export function mutualPairs(matches: GuestMatches[]): Set<string> {
  const picked = new Set<string>();
  for (const m of matches) {
    for (const x of m.matches) picked.add(`${m.id}→${x.id}`);
  }
  const mutual = new Set<string>();
  for (const key of picked) {
    const [a, b] = key.split("→");
    if (picked.has(`${b}→${a}`)) mutual.add(key);
  }
  return mutual;
}

function matchCard(
  ownerId: string,
  match: { id: string; reason: string; icebreaker: string },
  blurbById: Map<string, Blurb>,
  mutual: Set<string>,
) {
  const other = blurbById.get(match.id);
  if (!other) return "";
  const badge = mutual.has(`${ownerId}→${match.id}`)
    ? ` <span class="badge">&#9889; they picked you too</span>`
    : "";
  return `
    <div class="match">
      ${avatar(other, "small")}
      <div class="match-body">
        <div class="match-name">${esc(other.name)}${badge}</div>
        <div class="match-reason">${esc(match.reason)}</div>
        <div class="icebreaker">&ldquo;${esc(match.icebreaker)}&rdquo;</div>
      </div>
    </div>`;
}

function guestCard(
  blurb: Blurb,
  blurbById: Map<string, Blurb>,
  matchesById: Map<string, GuestMatches>,
  mutual: Set<string>,
) {
  const guestMatches = matchesById.get(blurb.id);
  const tags = blurb.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `
  <section class="card" data-name="${esc(blurb.name.toLowerCase())}" data-tags="${esc(blurb.tags.join(" ").toLowerCase())}">
    <header class="card-header">
      ${avatar(blurb, "large")}
      <div>
        <h2>${esc(blurb.name)}</h2>
        <div class="tags">${tags}</div>
      </div>
    </header>
    <p class="blurb">${esc(blurb.blurb)}</p>
    <p class="looking-for"><strong>Looking for:</strong> ${esc(blurb.lookingFor)}</p>
    ${
    guestMatches?.matches.length
      ? `<h3>People you should meet</h3>${
        guestMatches.matches.map((m) => matchCard(blurb.id, m, blurbById, mutual)).join("")
      }`
      : ""
  }
  </section>`;
}

export function renderHtml(
  blurbs: Blurb[],
  matches: GuestMatches[],
  options: { passphrase?: string } = {},
) {
  const blurbById = new Map(blurbs.map((b) => [b.id, b]));
  const matchesById = new Map(matches.map((m) => [m.id, m]));
  const mutual = mutualPairs(matches);
  const gateToken = gateTokenFor(options.passphrase);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Bangerlore Match</title>
<style>
  :root { --bg: #0d0d11; --card: #17171f; --text: #ececf1; --muted: #9b9ba8; --accent: #e8b04b; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 -apple-system, "Segoe UI", sans-serif; }
  .container { max-width: 760px; margin: 0 auto; padding: 24px 16px 80px; }
  h1 { font-size: 28px; margin: 8px 0 4px; }
  .subtitle { color: var(--muted); margin-bottom: 20px; }
  #search { width: 100%; padding: 12px 16px; font-size: 16px; border-radius: 12px; border: 1px solid #2a2a36;
    background: var(--card); color: var(--text); outline: none; margin-bottom: 24px; }
  #search:focus { border-color: var(--accent); }
  .card { background: var(--card); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
  .card-header { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
  .card h2 { margin: 0 0 6px; font-size: 20px; }
  .avatar { border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .avatar.large { width: 56px; height: 56px; }
  .avatar.small { width: 36px; height: 36px; }
  .avatar.fallback { display: flex; align-items: center; justify-content: center; background: #2a2a36;
    color: var(--accent); font-weight: 700; }
  .avatar.large.fallback { font-size: 24px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { background: #23232e; color: var(--muted); font-size: 12px; padding: 2px 10px; border-radius: 999px; }
  .blurb { margin: 8px 0; }
  .looking-for { color: var(--muted); font-size: 14px; margin: 8px 0 0; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin: 18px 0 10px; }
  .match { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid #23232e; }
  .match-name { font-weight: 600; }
  .badge { font-size: 11px; font-weight: 600; color: var(--accent); background: rgba(232, 176, 75, 0.12);
    padding: 2px 8px; border-radius: 999px; white-space: nowrap; vertical-align: middle; }
  .match-reason { font-size: 14px; color: var(--muted); }
  .icebreaker { font-size: 14px; color: var(--text); font-style: italic; margin-top: 4px; }
  .hidden { display: none; }
  #gate { position: fixed; inset: 0; background: var(--bg); z-index: 10; display: flex;
    flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; }
  #gate input { padding: 12px 16px; font-size: 18px; border-radius: 12px; border: 1px solid #2a2a36;
    background: var(--card); color: var(--text); outline: none; text-align: center; }
  #gate .hint { color: var(--muted); font-size: 14px; text-align: center; }
</style>
</head>
<body>
${gateMarkup(gateToken)}
<div class="container">
  <h1>Bangerlore Match</h1>
  <div class="subtitle">${blurbs.length} guests &middot; find your people</div>
  <input id="search" type="search" placeholder="Search your name or a tag (e.g. robotics)&hellip;" autofocus>
  ${blurbs.map((b) => guestCard(b, blurbById, matchesById, mutual)).join("\n")}
</div>
<script>
  const search = document.getElementById("search");
  const cards = [...document.querySelectorAll(".card")];
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const card of cards) {
      const hit = !q || card.dataset.name.includes(q) || card.dataset.tags.includes(q);
      card.classList.toggle("hidden", !hit);
    }
  });
</script>
</body>
</html>`;
}
