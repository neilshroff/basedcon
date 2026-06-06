// Party map: force-directed graph of all guests, in the style of the
// reference mock — cream background, dot grid, dashed rings, initials in the
// bubble, names beneath. Click a guest → their top-4 matches light up, the
// rest dims, and a bottom sheet shows reasons + icebreakers.
//
//   blurbs.json ─┐
//                ├─► force layout (build time, deterministic) ─► static SVG
//   matches.json ┘                                                + vanilla JS
//
// Layout runs HERE in Bun (~300 iterations over 296 nodes), not on the phone:
// party devices get a static SVG with pan/zoom, no physics engine.
// Usage: PASS=<phrase> bun scripts/build-graph.ts   → graph.html

import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";
import { validAvatar } from "../lib/avatars";
import { esc, gateMarkup, gateTokenFor, mutualPairs } from "../lib/render";

const blurbs = await Bun.file("data/blurbs.json").json() as Blurb[];
const matches = await Bun.file("data/matches.json").json() as GuestMatches[];
const mutual = mutualPairs(matches);

// --- deterministic RNG (stable layout across rebuilds of the same data) ----
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(296);

// --- graph model ------------------------------------------------------------
const SIZE = 4200; // virtual canvas
const index = new Map(blurbs.map((b, i) => [b.id, i]));

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const a = words[0]?.[0] ?? "?";
  const b = words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}

// Tribe color: hash of the guest's first tag → fixed palette (reference uses
// scattered orange/purple/green initials).
const PALETTE = ["#c2571b", "#5b4bc4", "#4a7a1e", "#1d6f8f", "#a8336e", "#8a6d1a"];
function tribeColor(tags: string[]) {
  const tag = tags[0] ?? "";
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const nodes = blurbs.map((b) => ({
  id: b.id,
  name: b.name,
  initials: initials(b.name),
  color: tribeColor(b.tags),
  x: SIZE / 2 + (rand() - 0.5) * SIZE * 0.85,
  y: SIZE / 2 + (rand() - 0.5) * SIZE * 0.85,
  vx: 0,
  vy: 0,
}));

// Undirected edge set (a→b and b→a collapse into one drawn line).
const edgeKeys = new Set<string>();
for (const m of matches) {
  for (const x of m.matches) {
    if (!index.has(x.id)) continue;
    const [a, b] = [m.id, x.id].sort();
    edgeKeys.add(`${a}|${b}`);
  }
}
const edges = [...edgeKeys].map((key) => {
  const [a, b] = key.split("|");
  return { a, b, ai: index.get(a)!, bi: index.get(b)! };
});

// --- force simulation (repulsion + springs + center gravity) ----------------
const ITER = 320;
for (let iteration = 0; iteration < ITER; iteration++) {
  const temperature = 1 - iteration / ITER; // cool down
  // O(n²) repulsion — 296² ≈ 88k pairs, trivial at build time
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i], n2 = nodes[j];
      let dx = n1.x - n2.x, dy = n1.y - n2.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = rand() - 0.5; dy = rand() - 0.5; d2 = 1; }
      const force = Math.min(60000 / d2, 50) * temperature;
      const d = Math.sqrt(d2);
      n1.vx += (dx / d) * force; n1.vy += (dy / d) * force;
      n2.vx -= (dx / d) * force; n2.vy -= (dy / d) * force;
    }
  }
  // spring along edges
  for (const e of edges) {
    const n1 = nodes[e.ai], n2 = nodes[e.bi];
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (d - 260) * 0.012 * temperature;
    n1.vx += (dx / d) * force; n1.vy += (dy / d) * force;
    n2.vx -= (dx / d) * force; n2.vy -= (dy / d) * force;
  }
  // gentle center gravity + integrate
  for (const n of nodes) {
    n.vx += (SIZE / 2 - n.x) * 0.002 * temperature;
    n.vy += (SIZE / 2 - n.y) * 0.002 * temperature;
    n.x = Math.max(80, Math.min(SIZE - 80, n.x + n.vx * 0.6));
    n.y = Math.max(80, Math.min(SIZE - 80, n.y + n.vy * 0.6));
    n.vx *= 0.55; n.vy *= 0.55;
  }
}

// --- SVG ---------------------------------------------------------------------
const round = (v: number) => Math.round(v * 10) / 10;
const nodeById = new Map(nodes.map((n) => [n.id, n]));

// Locally cached profile pics (scripts/fetch-avatars.ts) — bubbles with a
// VALID raster image render the photo; the rest keep tribe-colored initials
// (SVG <image> has no onerror, so junk files must be excluded at build time).
const hasAvatar = new Set<string>();
for (const b of blurbs) {
  if (await validAvatar(b.id)) hasAvatar.add(b.id);
}

const edgeSvg = edges.map((e) => {
  const n1 = nodeById.get(e.a)!, n2 = nodeById.get(e.b)!;
  return `<line class="edge" data-key="${e.a}|${e.b}" x1="${round(n1.x)}" y1="${round(n1.y)}" x2="${round(n2.x)}" y2="${round(n2.y)}"/>`;
}).join("\n");

const nodeSvg = nodes.map((n) => {
  const face = hasAvatar.has(n.id)
    ? `<image href="avatars/${n.id}.jpg" x="-26" y="-26" width="52" height="52" clip-path="url(#avclip)" preserveAspectRatio="xMidYMid slice"/>
  <circle class="bubble rim" r="26"/>`
    : `<circle class="bubble" r="26"/>
  <text class="initials" dy="0.36em" fill="${n.color}">${esc(n.initials)}</text>`;
  return `
<g class="node" data-id="${n.id}" transform="translate(${round(n.x)},${round(n.y)})">
  <circle class="ring" r="34"/>
  ${face}
  <text class="label" y="50">${esc(n.name)}</text>
</g>`;
}).join("\n");

// Bottom-sheet payload: id → {name, matches: [{id, name, reason, icebreaker, mutual}]}
const sheetData: Record<string, unknown> = {};
for (const m of matches) {
  sheetData[m.id] = {
    name: m.name,
    matches: m.matches.filter((x) => index.has(x.id)).map((x) => ({
      id: x.id,
      name: x.name,
      reason: x.reason,
      icebreaker: x.icebreaker,
      mutual: mutual.has(`${m.id}→${x.id}`) && mutual.has(`${x.id}→${m.id}`),
      pic: hasAvatar.has(x.id),
    })),
  };
}

const passphrase = Bun.env.PASS?.trim() || undefined;
if (!passphrase) {
  console.warn("PASS not set — building graph WITHOUT the passphrase gate. Fine locally; set PASS=... for the deployed build.");
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Bangerlore Match — Party Map</title>
<style>
  :root { --bg: #faf9f5; --ink: #4a4a45; --muted: #a8a69e; --line: #dcdad2; --hot: #c2571b; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg);
    font: 15px/1.45 -apple-system, "Segoe UI", sans-serif; color: var(--ink); }
  body { background-image: radial-gradient(#e4e2da 1px, transparent 1px); background-size: 26px 26px; }
  #gate { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: flex;
    flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; }
  #gate input { padding: 12px 16px; font-size: 18px; border-radius: 12px; border: 1px solid var(--line);
    background: #fff; color: var(--ink); outline: none; text-align: center; }
  #gate .hint { color: var(--muted); font-size: 14px; text-align: center; }
  #topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 20; display: flex; gap: 10px;
    padding: 12px 14px; align-items: center; pointer-events: none; }
  #topbar > * { pointer-events: auto; }
  #find { flex: 1; max-width: 340px; padding: 10px 14px; font-size: 15px; border-radius: 999px;
    border: 1px solid var(--line); background: rgba(255,255,255,0.92); color: var(--ink); outline: none; }
  #find:focus { border-color: var(--hot); }
  .zbtn { width: 38px; height: 38px; border-radius: 999px; border: 1px solid var(--line);
    background: rgba(255,255,255,0.92); color: var(--ink); font-size: 19px; cursor: pointer; }
  #deck-link { margin-left: auto; font-size: 13px; color: var(--muted); text-decoration: none;
    background: rgba(255,255,255,0.92); border: 1px solid var(--line); border-radius: 999px; padding: 9px 14px; }
  #stage { position: fixed; inset: 0; touch-action: none; cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  svg { width: 100%; height: 100%; display: block; }
  /* Pan/zoom = vector transform per frame: always crisp, no raster layers,
     no blur. The per-frame paint is made cheap by stripping the expensive
     features WHILE moving: dashed strokes (≈10× the paint cost of solid)
     become solid hairlines and labels skip painting; both restore the
     instant motion settles. */
  svg.moving .edge { stroke-dasharray: none; opacity: 0.35; }
  svg.moving .node .ring { stroke-dasharray: none; opacity: 0.6; }
  svg.moving .node .label { visibility: hidden; }
  svg.moving .edge, svg.moving .node, svg.moving .node .bubble, svg.moving .node .ring { transition: none; }
  .edge { stroke: var(--line); stroke-width: 1; stroke-dasharray: 5 6; opacity: 0.55;
    transition: opacity 0.3s ease, stroke 0.3s ease; }
  .node { cursor: pointer; transition: opacity 0.3s ease; }
  .node .bubble { fill: #fff; stroke: #d6d4cb; stroke-width: 1.4; transition: stroke 0.25s ease, stroke-width 0.25s ease; }
  .node .bubble.rim { fill: none; } /* photo bubbles: circle is just the border over the image */
  .node image { pointer-events: none; }
  .node .ring { fill: none; stroke: #cfcdc4; stroke-width: 1.2; stroke-dasharray: 4 7; transition: stroke 0.25s ease; }
  .node .initials { font: 600 16px ui-monospace, "SF Mono", monospace; text-anchor: middle; }
  .node .label { font-size: 15px; fill: var(--ink); text-anchor: middle; opacity: 0;
    visibility: hidden; transition: opacity 0.15s; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; }
  svg.zoomed .label { opacity: 1; visibility: visible; }
  svg.has-sel .node.sel .label, svg.has-sel .node.hit .label { visibility: visible; }
  /* selection states */
  svg.has-sel .node { opacity: 0.16; }
  svg.has-sel .edge { opacity: 0.08; }
  svg.has-sel .node.sel, svg.has-sel .node.hit { opacity: 1; }
  svg.has-sel .node.sel .label, svg.has-sel .node.hit .label { opacity: 1; font-weight: 600; }
  .node.sel .bubble { stroke: var(--hot); stroke-width: 2.5; }
  .node.sel .ring { stroke: var(--hot); }
  .node.hit .bubble { stroke: #4a7a1e; stroke-width: 2.2; }
  .node.hit .ring { stroke: #4a7a1e; }
  svg.has-sel .edge.lit { opacity: 1; stroke: var(--hot); stroke-width: 1.8; stroke-dasharray: none; }
  #hint { position: fixed; bottom: 14px; left: 0; right: 0; text-align: center; color: var(--muted);
    font-size: 14px; pointer-events: none; }
  #sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: #fff;
    border-radius: 18px 18px 0 0; box-shadow: 0 -8px 30px rgba(60,58,50,0.13); padding: 18px 18px 26px;
    max-height: 52vh; overflow-y: auto; transform: translateY(105%); transition: transform 0.22s ease; }
  #sheet.open { transform: translateY(0); }
  #sheet h2 { margin: 0 0 2px; font-size: 18px; }
  #sheet .sub { color: var(--muted); font-size: 13px; margin-bottom: 10px; }
  #sheet .m { padding: 10px 0; border-top: 1px solid #efede6; display: flex; gap: 10px; }
  #sheet .m-pic { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px; }
  #sheet .m-body { min-width: 0; }
  #sheet .m-name { font-weight: 600; }
  #sheet .m-name button { font: inherit; font-weight: 600; color: var(--ink); background: none;
    border: none; padding: 0; cursor: pointer; text-decoration: underline dotted var(--muted); }
  #sheet .badge { font-size: 11px; font-weight: 600; color: var(--hot); background: rgba(194,87,27,0.1);
    padding: 2px 8px; border-radius: 999px; margin-left: 6px; white-space: nowrap; }
  #sheet .m-reason { color: #76746c; font-size: 14px; }
  #sheet .m-ice { font-size: 14px; font-style: italic; margin-top: 3px; }
  #sheet .close { position: absolute; top: 10px; right: 12px; border: none; background: none;
    font-size: 22px; color: var(--muted); cursor: pointer; }
</style>
</head>
<body>
${gateMarkup(gateTokenFor(passphrase))}
<div id="topbar">
  <input id="find" type="search" placeholder="Find yourself&hellip;" autocomplete="off">
  <button class="zbtn" id="zin">+</button>
  <button class="zbtn" id="zout">&minus;</button>
  <a id="deck-link" href="matches.html">card view &rarr;</a>
</div>
<div id="stage">
  <svg id="map">
    <defs><clipPath id="avclip"><circle r="26"/></clipPath></defs>
    <g id="world">
      ${edgeSvg}
      ${nodeSvg}
    </g>
  </svg>
</div>
<div id="hint">Click any guest to see their top 4 matches</div>
<div id="sheet"><button class="close" id="sheet-close">&times;</button><div id="sheet-body"></div></div>
<script>
const DATA = ${JSON.stringify(sheetData)};
const svg = document.getElementById("map");
const stage = document.getElementById("stage");
const sheet = document.getElementById("sheet");
const sheetBody = document.getElementById("sheet-body");
const SIZE = ${SIZE};

// ---- pan / zoom: GPU transform on #world. cur eases toward target every
// frame; dragging writes both for 1:1 finger tracking; release throws with
// inertia. All math in screen pixels. ----
const world = document.getElementById("world");
const r0 = stage.getBoundingClientRect();
const baseScale = Math.min(r0.width, r0.height) / SIZE;
let cur = {
  s: baseScale,
  x: (r0.width - SIZE * baseScale) / 2,
  y: (r0.height - SIZE * baseScale) / 2,
};
let target = { ...cur };
let settled = true;
const pointers = new Map();
function render() {
  world.setAttribute("transform", "translate(" + cur.x + " " + cur.y + ") scale(" + cur.s + ")");
  svg.classList.toggle("zoomed", cur.s > baseScale * 2.4);
}
// While the camera moves, strip expensive paint (dashes, labels) so every
// frame is a cheap crisp vector repaint; restore on settle.
function beginMotion() {
  if (settled) { settled = false; svg.classList.add("moving"); }
}
(function tick() {
  const k = 0.18; // easing — higher = snappier, lower = floatier
  const dx = target.x - cur.x, dy = target.y - cur.y, ds = target.s - cur.s;
  if (Math.abs(dx) + Math.abs(dy) > 0.25 || Math.abs(ds) > baseScale * 0.002) {
    beginMotion();
    cur.x += dx * k; cur.y += dy * k; cur.s += ds * k;
    render();
  } else if (!settled && !pointers.size) {
    cur = { ...target };
    render();
    svg.classList.remove("moving");
    settled = true;
  }
  requestAnimationFrame(tick);
})();
function zoomAt(clientX, clientY, factor, immediate) {
  const r = stage.getBoundingClientRect();
  const px = clientX - r.left, py = clientY - r.top;
  const base = immediate ? cur : target;
  const s = Math.min(baseScale * 16, Math.max(baseScale * 0.65, base.s * factor));
  const f = s / base.s;
  const next = { s: s, x: px - (px - base.x) * f, y: py - (py - base.y) * f };
  target = next;
  beginMotion();
  if (immediate) { cur = { ...next }; render(); }
}
document.getElementById("zin").onclick = () => {
  const r = stage.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.6);
};
document.getElementById("zout").onclick = () => {
  const r = stage.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.62);
};
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0018));
}, { passive: false });

let lastPinch = 0, moved = false;
let velocity = { x: 0, y: 0 }, lastMoveAt = 0;
stage.addEventListener("pointerdown", (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = false;
  velocity = { x: 0, y: 0 };
  stage.classList.add("dragging");
  try { stage.setPointerCapture(e.pointerId); } catch {}
});
stage.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  if (pointers.size === 1) {
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (moved) {
      // 1:1 tracking while the finger is down — no lag, no rubber band
      beginMotion();
      cur.x += dx; cur.y += dy;
      target = { ...cur };
      const now = performance.now();
      const dt = Math.max(now - lastMoveAt, 8);
      velocity = { x: dx / dt, y: dy / dt };
      lastMoveAt = now;
      render();
    }
  } else if (pointers.size === 2) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastPinch) {
      zoomAt((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, dist / lastPinch, true);
      moved = true;
    }
    lastPinch = dist;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
function endPointer(e) {
  const wasDrag = pointers.delete(e.pointerId);
  if (pointers.size < 2) lastPinch = 0;
  if (!pointers.size) {
    stage.classList.remove("dragging");
    const speed = Math.hypot(velocity.x, velocity.y);
    if (moved && speed > 0.15 && performance.now() - lastMoveAt < 80) {
      // inertia: throw the target ahead, the easing loop glides there
      target.x = cur.x + velocity.x * 320;
      target.y = cur.y + velocity.y * 320;
    }
    // Tap (no drag) = selection. setPointerCapture retargets the derived
    // click event to #stage, so hit-test here instead of a click listener.
    if (wasDrag && !moved && e.target.id !== "gate-input") {
      const node = nodeAtPoint(e.clientX, e.clientY);
      if (node) select(node.dataset.id);
      else clearSel();
    }
  }
}
stage.addEventListener("pointerup", endPointer);
stage.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); lastPinch = 0; if (!pointers.size) stage.classList.remove("dragging"); });

// ---- selection ----
// Tap slop: a tap that misses the exact pixel still selects the nearest
// bubble within 30px — fat fingers on phones at a party.
function nodeAtPoint(cx, cy) {
  const el = document.elementFromPoint(cx, cy);
  const direct = el && el.closest(".node");
  if (direct) return direct;
  let best = null, bestDist = 30;
  for (const n of svg.querySelectorAll(".node")) {
    const c = n.querySelector(".bubble").getBoundingClientRect();
    if (!c.width) continue;
    const d = Math.hypot(c.left + c.width / 2 - cx, c.top + c.height / 2 - cy) - c.width / 2;
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}
function clearSel() {
  svg.classList.remove("has-sel");
  svg.querySelectorAll(".sel, .hit").forEach((n) => n.classList.remove("sel", "hit"));
  svg.querySelectorAll(".edge.lit").forEach((n) => n.classList.remove("lit"));
  sheet.classList.remove("open");
}
function select(id) {
  clearSel();
  const entry = DATA[id];
  const node = svg.querySelector('.node[data-id="' + id + '"]');
  if (!entry || !node) return;
  svg.classList.add("has-sel");
  node.classList.add("sel");
  let body = "<h2>" + entry.name + "</h2><div class='sub'>top " + entry.matches.length + " people to meet</div>";
  for (const m of entry.matches) {
    const hit = svg.querySelector('.node[data-id="' + m.id + '"]');
    if (hit) hit.classList.add("hit");
    const key = [id, m.id].sort().join("|");
    const edge = svg.querySelector('.edge[data-key="' + key + '"]');
    if (edge) edge.classList.add("lit");
    const face = m.pic ? "<img class='m-pic' src='avatars/" + m.id + ".jpg' alt=''>" : "";
    body += "<div class='m'>" + face + "<div class='m-body'><div class='m-name'><button data-go='" + m.id + "'>" + m.name + "</button>" +
      (m.mutual ? "<span class='badge'>&#9889; they picked you too</span>" : "") + "</div>" +
      "<div class='m-reason'>" + m.reason + "</div>" +
      "<div class='m-ice'>&ldquo;" + m.icebreaker + "&rdquo;</div></div></div>";
  }
  sheetBody.innerHTML = body;
  sheet.classList.add("open");
}
sheetBody.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) focusOn(go.dataset.go);
});
document.getElementById("sheet-close").onclick = clearSel;

// ---- find ----
const names = Object.entries(DATA).map(([id, v]) => [id, v.name.toLowerCase()]);
function nodePos(id) {
  const node = svg.querySelector('.node[data-id="' + id + '"]');
  if (!node) return null;
  const t = node.getAttribute("transform").match(/([\\d.]+),([\\d.]+)/);
  return { x: +t[1], y: +t[2] };
}
// Fit the viewport around a guest AND their matches so the whole highlighted
// constellation is on screen (sheet covers the bottom half on mobile, so bias
// the group toward the top).
function fitTo(ids) {
  const pts = ids.map(nodePos).filter(Boolean);
  if (!pts.length) return;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = 220;
  const w = Math.max(900, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = stage.getBoundingClientRect();
  const s = Math.min(baseScale * 16, Math.min(r.width, r.height) / w);
  // bias the group upward — the bottom sheet covers the lower half on mobile
  target = { s: s, x: r.width / 2 - cx * s, y: r.height / 2 - cy * s - r.height * 0.1 };
}
function focusOn(id) {
  const entry = DATA[id];
  fitTo([id].concat(entry ? entry.matches.map((m) => m.id) : []));
  select(id);
}
document.getElementById("find").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (q.length < 2) return;
  const found = names.find(([, n]) => n.startsWith(q)) || names.find(([, n]) => n.includes(q));
  if (found) focusOn(found[0]);
});
render();
</script>
</body>
</html>`;

await Bun.write("graph.html", html);
console.log(
  `Wrote graph.html (${nodes.length} guests, ${edges.length} edges${passphrase ? ", gated" : ", UNGATED"}).`,
);
