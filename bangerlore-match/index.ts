import { getLinkedInProfile, getTwitterProfile, type SocialProfile } from "./profiles";
import { linkedinUrl, twitterUrl } from "./lib/parse";
import { runPool, writeJsonAtomic } from "./lib/pool";

type Guest = { Name: string } & Record<string, string>;

type ProfileResult = {
  name: string;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  twitterProfile: SocialProfile | null;
  linkedinProfile: SocialProfile | null;
  twitterError?: string;
  linkedinError?: string;
};

const socialField =
  "Any online social link X / LinkedIn / personal website just so we know who you are!";
const guestsPath = "data/guests.json";
const socialLinksPath = "data/social-links.json";
const socialProfilesPath = "data/social-profiles.json";

function keyFor(entry: { name: string; twitterUrl: string | null; linkedinUrl: string | null }) {
  return [entry.name, entry.twitterUrl ?? "", entry.linkedinUrl ?? ""].join("|");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readExistingResults() {
  const file = Bun.file(socialProfilesPath);
  if (!(await file.exists())) return new Map<string, ProfileResult>();

  const rows = await file.json() as ProfileResult[];
  return new Map(rows.map((row) => [keyFor(row), row]));
}

function writeResults(results: ProfileResult[]) {
  return writeJsonAtomic(socialProfilesPath, results);
}

const retryErrors = Bun.env.PROFILE_RETRY_ERRORS === "1";

function needsWork(result: ProfileResult) {
  return Boolean(
    (result.twitterUrl && !result.twitterProfile && (!result.twitterError || retryErrors)) ||
      (result.linkedinUrl && !result.linkedinProfile && (!result.linkedinError || retryErrors))
  );
}

async function enrich(result: ProfileResult) {
  if (result.twitterUrl && !result.twitterProfile && (!result.twitterError || retryErrors)) {
    try {
      delete result.twitterError;
      result.twitterProfile = await getTwitterProfile(result.twitterUrl);
    } catch (error) {
      result.twitterError = errorMessage(error);
    }
  }

  if (result.linkedinUrl && !result.linkedinProfile && (!result.linkedinError || retryErrors)) {
    try {
      delete result.linkedinError;
      result.linkedinProfile = await getLinkedInProfile(result.linkedinUrl);
    } catch (error) {
      result.linkedinError = errorMessage(error);
    }
  }
}

const guests = await Bun.file(guestsPath).json() as Guest[];
const links = guests.map((guest) => {
  const text = guest[socialField] ?? "";
  return {
    name: guest.Name,
    twitterUrl: twitterUrl(text),
    linkedinUrl: linkedinUrl(text),
  };
});

await Bun.write(socialLinksPath, JSON.stringify(links, null, 2));

const existing = await readExistingResults();
const results = links.map((link): ProfileResult =>
  existing.get(keyFor(link)) ?? {
    ...link,
    twitterProfile: null,
    linkedinProfile: null,
  }
);

const limit = Number(Bun.env.PROFILE_LIMIT ?? results.length);
const queue = results.filter((result) => needsWork(result)).slice(0, limit);

// Note: enrich() already records per-network errors on the row itself
// (twitterError/linkedinError) rather than throwing, so pool-level failures
// here are unexpected crashes only.
await runPool({
  items: queue,
  concurrency: Number(Bun.env.PROFILE_CONCURRENCY ?? 2),
  name: (result) => result.name,
  run: (result) => enrich(result),
  checkpoint: () => writeResults(results),
});

const twitterDone = results.filter((row) => row.twitterProfile).length;
const linkedinDone = results.filter((row) => row.linkedinProfile).length;
const errors = results.filter((row) => row.twitterError || row.linkedinError).length;

console.log(
  `Wrote ${links.length} links and ${results.length} profile rows. ` +
    `Twitter: ${twitterDone}, LinkedIn: ${linkedinDone}, errors: ${errors}.`,
);
