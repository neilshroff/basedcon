import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Blurb } from "./blurbs";
import { validateMatches } from "./lib/matches";
import { runPool, writeJsonAtomic } from "./lib/pool";

export type Match = {
  id: string;
  name: string;
  reason: string;
  icebreaker: string;
};

export type GuestMatches = {
  id: string;
  name: string;
  matches: Match[];
};

const blurbsPath = "data/blurbs.json";
const matchesPath = "data/matches.json";

const MatchSchema = z.object({
  matches: z.array(
    z.object({
      id: z.string().describe("The roster id of the matched guest, e.g. g042"),
      reason: z.string().describe("One sentence: why these two should talk"),
      icebreaker: z.string().describe("A short, natural opening line one could use"),
    }),
    ).describe("Exactly 4 matches, best first"),
});

const client = new Anthropic();
// Default: Sonnet. Measured 2026-06-05: Haiku matching collapsed mutual pairs
// 190→49 and hallucinated roster IDs (37 incomplete sets). Matching is the one
// reasoning-critical step — Haiku stays the default for blurbs/enrichment only.
const model = Bun.env.MODEL ?? "claude-sonnet-4-6";

const blurbs = await Bun.file(blurbsPath).json() as Blurb[];
const blurbById = new Map(blurbs.map((b) => [b.id, b]));

const roster = blurbs
  .map((b) =>
    `[${b.id}] ${b.name} — ${b.blurb} (tags: ${b.tags.join(", ")}) Looking for: ${b.lookingFor}`
  )
  .join("\n");

const system: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text:
      "You are the matchmaker for a tech/builder party. Below is the full guest roster. " +
      "For the guest given in each request, pick the 4 best people for them to meet, best first. " +
      "Match on shared domains and complementary interests (e.g. a robotics builder with another robotics person, " +
      "or a founder with an investor in their space). Honor what each person says they're looking for. " +
      "Never match a guest with themselves. Prefer specific, real overlaps over generic ones — " +
      "the reason and icebreaker must reference concrete details from both profiles.\n\n" +
      `ROSTER:\n${roster}`,
    cache_control: { type: "ephemeral" },
  },
];

async function matchGuest(blurb: Blurb): Promise<GuestMatches> {
  const response = await client.messages.parse({
    model,
    // Generous cap: adaptive thinking bills against max_tokens, and a tight
    // cap truncates the JSON mid-string ("No parsed output", seen 2026-06-05
    // when Sonnet + enriched roster thought longer than Opus had).
    max_tokens: 8192,
    // Adaptive thinking is supported on Opus 4.6+ and Sonnet 4.6, not Haiku
    ...(model.includes("haiku") ? {} : { thinking: { type: "adaptive" as const } }),
    system,
    messages: [
      {
        role: "user",
        content:
          `Find the top 4 matches for [${blurb.id}] ${blurb.name}.\n` +
          `Their profile: ${blurb.blurb} (tags: ${blurb.tags.join(", ")}) Looking for: ${blurb.lookingFor}`,
      },
    ],
    output_config: { format: zodOutputFormat(MatchSchema) },
  });
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("No parsed output");

  const matches = validateMatches(parsed.matches, blurb.id, new Set(blurbById.keys()))
    .map((m) => ({
      id: m.id,
      name: blurbById.get(m.id)!.name,
      reason: m.reason,
      icebreaker: m.icebreaker,
    }));
  return { id: blurb.id, name: blurb.name, matches };
}

const existingFile = Bun.file(matchesPath);
const existing = new Map<string, GuestMatches>(
  (await existingFile.exists())
    ? (await existingFile.json() as GuestMatches[]).map((m) => [m.id, m])
    : [],
);

const results = new Map<string, GuestMatches>(existing);

function writeResults() {
  return writeJsonAtomic(matchesPath, blurbs.map((b) => results.get(b.id)).filter(Boolean));
}

const limit = Number(Bun.env.MATCH_LIMIT ?? blurbs.length);
const queue = blurbs.filter((b) => !results.has(b.id)).slice(0, limit);

console.log(`${queue.length} guests to match (${existing.size} already done).`);

const matchOne = async (blurb: Blurb) => {
  results.set(blurb.id, await matchGuest(blurb));
};

// Warm the prompt cache with one request before fanning out, so the remaining
// requests read the cached roster instead of all paying the full write.
const warm = queue.length
  ? await runPool({
    items: [queue.shift()!],
    concurrency: 1,
    name: (b) => `${b.name} (cache warm)`,
    run: matchOne,
    checkpoint: writeResults,
  })
  : { failures: [] };

const rest = await runPool({
  items: queue,
  concurrency: Number(Bun.env.MATCH_CONCURRENCY ?? 8),
  name: (b) => b.name,
  run: matchOne,
  checkpoint: writeResults,
});

const failed = warm.failures.length + rest.failures.length;
console.log(
  `Wrote ${results.size}/${blurbs.length} match sets to ${matchesPath}.` +
    (failed ? ` ${failed} failed.` : ""),
);
