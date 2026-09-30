import { stableId, profileFor } from "../lib/identity";

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
  twitterError?: string;
  linkedinError?: string;
};

type Blurb = {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  lookingFor: string;
  profilePicUrl: string | null;
};

type Match = {
  id: string;
  name: string;
  reason: string;
  icebreaker: string;
};

type GuestMatches = {
  id: string;
  name: string;
  matches: Match[];
};

const guestsPath = "data/guests.json";
const socialProfilesPath = "data/social-profiles.json";
const blurbsPath = "data/blurbs.json";
const matchesPath = "data/matches.json";

const introField =
  "A 2-line intro: what you do / what you're into these days / who you're looking to meet, etc. anything that makes it easier for someone to come say hi to you!";
const inviterField = "Who invited you?";
const emailField = "Email address (no spam, we’ll just add it to your calendar)";
const socialField =
  "Any online social link X / LinkedIn / personal website just so we know who you are!";
const anythingElseField =
  "Anything else you'd like to let us know? Are you flying in for the party (need urgent response), do you want to contribute, etc. anything else? If you have plus 1s pls ask them to sign up separately.";

async function exportDataset() {
  console.log("Loading files...");
  
  const guestsFile = Bun.file(guestsPath);
  const socialProfilesFile = Bun.file(socialProfilesPath);
  const blurbsFile = Bun.file(blurbsPath);
  const matchesFile = Bun.file(matchesPath);

  if (!(await guestsFile.exists())) {
    console.error(`Error: ${guestsPath} does not exist.`);
    return;
  }

  const guests = await guestsFile.json() as Guest[];
  const profiles = (await socialProfilesFile.exists()) ? await socialProfilesFile.json() as ProfileResult[] : [];
  const blurbs = (await blurbsFile.exists()) ? await blurbsFile.json() as Blurb[] : [];
  const matches = (await matchesFile.exists()) ? await matchesFile.json() as GuestMatches[] : [];

  const blurbMap = new Map(blurbs.map((b) => [b.id, b]));
  const matchMap = new Map(matches.map((m) => [m.id, m]));

  const dataset: any[] = [];

  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    const email = guest[emailField];
    const name = guest.Name;
    const id = stableId(email, name);

    // Retrieve corresponding scraped profile
    const profile = profileFor(profiles, i, name);

    // Retrieve corresponding AI-generated blurb
    const blurb = blurbMap.get(id);

    // Retrieve corresponding AI-generated matches
    const matchData = matchMap.get(id);

    dataset.push({
      id,
      name,
      status: guest.Status ?? null,
      rsvpDate: guest["RSVP date"] ?? null,
      invitedBy: guest[inviterField] ?? null,
      email: email ?? null,
      socialLinksInput: guest[socialField] ?? null,
      selfWrittenIntro: guest[introField] ?? null,
      anythingElse: guest[anythingElseField] ?? null,
      scrapedProfiles: {
        twitter: profile?.twitterProfile ?? null,
        linkedin: profile?.linkedinProfile ?? null,
      },
      aiProfile: blurb ? {
        blurb: blurb.blurb,
        tags: blurb.tags,
        lookingFor: blurb.lookingFor,
        profilePicUrl: blurb.profilePicUrl,
      } : null,
      matches: matchData?.matches ?? [],
    });
  }

  // Write JSON dataset
  const jsonOutPath = "data/exported_dataset.json";
  await Bun.write(jsonOutPath, JSON.stringify(dataset, null, 2));
  console.log(`Exported JSON dataset to ${jsonOutPath}`);

  // Write CSV dataset
  const csvOutPath = "data/exported_dataset.csv";
  const csvHeaders = [
    "id",
    "name",
    "status",
    "rsvpDate",
    "invitedBy",
    "email",
    "socialLinksInput",
    "selfWrittenIntro",
    "anythingElse",
    "twitterUrl",
    "twitterBio",
    "linkedinUrl",
    "linkedinBio",
    "aiBlurb",
    "aiTags",
    "aiLookingFor",
    "match1_name",
    "match1_reason",
    "match1_icebreaker",
    "match2_name",
    "match2_reason",
    "match2_icebreaker",
    "match3_name",
    "match3_reason",
    "match3_icebreaker"
  ];

  function escapeCsv(val: any): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const csvRows = [csvHeaders.join(",")];

  for (const row of dataset) {
    const twitter = row.scrapedProfiles.twitter;
    const linkedin = row.scrapedProfiles.linkedin;
    const ai = row.aiProfile;
    const m1 = row.matches[0];
    const m2 = row.matches[1];
    const m3 = row.matches[2];

    const values = [
      row.id,
      row.name,
      row.status,
      row.rsvpDate,
      row.invitedBy,
      row.email,
      row.socialLinksInput,
      row.selfWrittenIntro,
      row.anythingElse,
      twitter?.url ?? "",
      twitter?.bio ?? "",
      linkedin?.url ?? "",
      linkedin?.bio ?? "",
      ai?.blurb ?? "",
      ai?.tags ? ai.tags.join("; ") : "",
      ai?.lookingFor ?? "",
      m1?.name ?? "",
      m1?.reason ?? "",
      m1?.icebreaker ?? "",
      m2?.name ?? "",
      m2?.reason ?? "",
      m2?.icebreaker ?? "",
      m3?.name ?? "",
      m3?.reason ?? "",
      m3?.icebreaker ?? ""
    ];

    csvRows.push(values.map(escapeCsv).join(","));
  }

  await Bun.write(csvOutPath, csvRows.join("\n"));
  console.log(`Exported CSV dataset to ${csvOutPath}`);
}

exportDataset().catch(console.error);
