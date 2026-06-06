export type SocialProfileWithPic = {
  profilePicUrl?: string | null;
};

export type ProfilePicSources = {
  twitterProfile?: SocialProfileWithPic | null;
  linkedinProfile?: SocialProfileWithPic | null;
};

function cleanUrl(url: string | null | undefined) {
  const value = url?.trim();
  return value || null;
}

export function profilePicCandidates(profile: ProfilePicSources | undefined): string[] {
  const seen = new Set<string>();
  const candidates = [
    cleanUrl(profile?.twitterProfile?.profilePicUrl),
    cleanUrl(profile?.linkedinProfile?.profilePicUrl),
  ];
  return candidates.filter((url): url is string => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function preferredProfilePic(profile: ProfilePicSources | undefined): string | null {
  return profilePicCandidates(profile)[0] ?? null;
}
