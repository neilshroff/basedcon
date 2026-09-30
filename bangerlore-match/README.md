# bangerlore-match

Matchmaking for the party: every guest gets an AI-written profile and 3
recommended people to meet, with personalized icebreakers. Two views:

- **`matches.html`** — searchable card deck (search your name or a tag)
- **`graph.html`** — constellation map; click a bubble → your 3 people light up

All generated data is committed, so viewing costs **zero API keys and $0**.

## Getting Started

Follow these steps to get the project up and running locally.

### 1. Prerequisites
You need [Bun](https://bun.sh/) installed on your machine to manage dependencies and run scripts. If you don't have it, install it using:
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Installation & Environment Setup
Clone the repository and install dependencies:
```bash
bun install
```

Create a `.env` file in the root directory:
```env
# Required for scraping profiles
ZENROWS_API_KEY=your_zenrows_api_key_here

# Required for AI profile blurbs and matchmaking
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Passphrase to unlock build HTML pages (required to run build scripts)
PASS=bangerlore
```

---

## Running the Project

### A. View Local Pages (No API keys needed)
Since generated data is committed in the repository, you can build and view the frontend views immediately without any API keys:
```bash
# Build the HTML pages (requires the PASS env variable)
PASS=bangerlore bun run html
PASS=bangerlore bun run graph

# Open the compiled views
open graph.html          # Use 'bangerlore' (or your PASS) to unlock the page
```
Avatars are already committed in `avatars/` (to refresh/download new avatars, run `bun scripts/fetch-avatars.ts` — this runs plain downloads without needing keys).

### B. Run Tests
Ensure everything is working correctly by running the test suite:
```bash
bun test
```

### C. Regenerate Data (API keys required)
Only run these commands if `data/guests.json` has changed and you need to rebuild the AI recommendations and blurbs. All stages are fully resumable:
```bash
# 1. Scrape new or changed social profile links
bun index.ts

# 2. Run the pipeline (generates blurbs, computes matches, and renders frontend pages)
MODEL=claude-sonnet-4-6 bun run pipeline
```

*Model selection note:* Use `MODEL=claude-sonnet-4-6` for fast, cost-effective runs, or default to `claude-opus-4-8` if preferred. Incremental reruns only compute missing guest profiles, making them very cheap. See [RUNBOOK.md](file:///Users/sunny/projects/recc-systems/bangerlore-match/RUNBOOK.md) for full deployment details.


## How it works

```
guests.json ─► index.ts (ZenRows scrape) ─► social-profiles.json
                                                  │
self-written intros + scraped bios ─► blurbs.ts ─► blurbs.json   (1 call/guest)
                                                  │
roster prompt-cached, 1 call/guest ─► match.ts ──► matches.json  (top-3 + icebreakers)
                                                  │
                      build-html.ts / build-graph.ts ─► matches.html, graph.html
```

Design notes: matching is LLM-over-cached-roster (not embeddings — the model
catches semantic fits like "robotics perception ↔ drone builder"), and single
API calls (not agents — the roster is already in context; agents are reserved
for the deep-enrichment roadmap). Measured quality: 190 mutual pairs vs ~4.5
expected by chance (42×). `bun test` runs 74 tests.

## Layout

```
index.ts / blurbs.ts / match.ts   pipeline stages (resumable, fail-loud)
build-html.ts, scripts/build-graph.ts   renderers ($0, pure)
lib/        identity (stable IDs), pool (worker+atomic checkpoints), render, parse
scripts/    fetch-avatars, rekey migration
data/       guests + scraped profiles + generated blurbs/matches (committed)
test/       bun:test suite
RUNBOOK.md  party-day ops   ·   TODOS.md  deferred work
```
