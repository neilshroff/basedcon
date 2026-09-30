import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { profileFor, stableId } from "./lib/identity";
import { preferredProfilePic } from "./lib/profile-pics";
import { runPool, writeJsonAtomic } from "./lib/pool";

type Guest = { Name: string } & Record<string, string>;

type SocialProfile = {
  url: string;
  name: string | null;
  profilePicUrl: string | null;
  bio: string | null;
};

type ProfileResult = {
  name: string;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  twitterProfile: SocialProfile | null;
  linkedinProfile: SocialProfile | null;
};

export type Blurb = {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  lookingFor: string;
  profilePicUrl: string | null;
};

const guestsPath = "data/guests.json";
const socialProfilesPath = "data/social-profiles.json";
const blurbsPath = "data/blurbs.json";

const introField =
  "A 2-line intro: what you do / what you're into these days / who you're looking to meet, etc. anything that makes it easier for someone to come say hi to you!";
const inviterField = "Who invited you?";
const emailField = "Email address (no spam, we’ll just add it to your calendar)";

const BlurbSchema = z.object({
  blurb: z.string().describe(
    "2-3 sentence third-person blurb about this person: what they do, what they're into, what makes them interesting to talk to",
  ),
  tags: z.array(z.string()).describe(
    "3-6 lowercase domain tags, e.g. robotics, ai, crypto, design, founder, investor, music",
  ),
  looking_for: z.string().describe(
    "One sentence on who they'd most want to meet, inferred from their intro if not stated",
  ),
});

const client = new Anthropic();
// Default: cheapest current-gen model (user decision 2026-06-05).
const model = Bun.env.MODEL ?? "claude-haiku-4-5";

function guestContext(
  guest: Guest,
  profile: ProfileResult | undefined,
  enrichment?: string,
) {
  const parts = [`Name: ${guest.Name}`];
  const intro = guest[introField]?.trim();
  if (intro) parts.push(`Self-written intro: ${intro}`);
  const twitterBio = profile?.twitterProfile?.bio?.trim();
  if (twitterBio) parts.push(`Twitter bio: ${twitterBio}`);
  const linkedinBio = profile?.linkedinProfile?.bio?.trim();
  if (linkedinBio) parts.push(`LinkedIn bio: ${linkedinBio}`);
  if (enrichment) {
    parts.push(`Extra context from their website / projects they mention: ${enrichment}`);
  }
  const inviter = guest[inviterField]?.trim();
  if (inviter) parts.push(`Invited by: ${inviter}`);
  return parts.join("\n");
}

async function generateBlurb(context: string) {
  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    system:
      "You write short profiles of party guests for a recommendation system that matches attendees with similar interests. " +
      "Work only from the information given — never invent facts. The self-written intro is the most reliable signal. " +
      "If information is thin, keep the blurb short and honest rather than padding it.",
    messages: [
      {
        role: "user",
        content: `Write the profile for this guest:\n\n${context}`,
      },
    ],
    output_config: { format: zodOutputFormat(BlurbSchema) },
  });
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("No parsed output");
  return parsed;
}

const guests = await Bun.file(guestsPath).json() as Guest[];
const profiles = await Bun.file(socialProfilesPath).json() as ProfileResult[];

// Optional enrichment layer (scripts/enrich.ts): stable id → summary
const enrichmentPath = "data/enrichment.json";
const enrichmentById = new Map<string, string>(
  (await Bun.file(enrichmentPath).exists())
    ? (await Bun.file(enrichmentPath).json() as { id: string; summary: string }[])
      .map((e) => [e.id, e.summary])
    : [],
);

const existingFile = Bun.file(blurbsPath);
const existing = new Map<string, Blurb>(
  (await existingFile.exists())
    ? (await existingFile.json() as Blurb[]).map((b) => [b.id, b])
    : [],
);

const blurbs: (Blurb | null)[] = guests.map((guest) =>
  existing.get(stableId(guest[emailField], guest.Name)) ?? null
);

const limit = Number(Bun.env.BLURB_LIMIT ?? guests.length);
const queue = guests
  .map((guest, index) => ({ guest, index }))
  .filter(({ index }) => !blurbs[index])
  .slice(0, limit);

console.log(`${queue.length} blurbs to generate (${existing.size} already done).`);

await runPool({
  items: queue,
  concurrency: Number(Bun.env.BLURB_CONCURRENCY ?? 8),
  name: ({ guest }) => guest.Name,
  run: async ({ guest, index }) => {
    const profile = profileFor(profiles, index, guest.Name);
    const id = stableId(guest[emailField], guest.Name);
    const result = await generateBlurb(guestContext(guest, profile, enrichmentById.get(id)));
    blurbs[index] = {
      id,
      name: guest.Name,
      blurb: result.blurb,
      tags: result.tags,
      lookingFor: result.looking_for,
      profilePicUrl: preferredProfilePic(profile),
    };
  },
  checkpoint: () => writeJsonAtomic(blurbsPath, blurbs.filter(Boolean)),
});

console.log(`Wrote ${blurbs.filter(Boolean).length}/${guests.length} blurbs to ${blurbsPath}.`);
