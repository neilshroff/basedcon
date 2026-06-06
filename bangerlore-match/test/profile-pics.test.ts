import { describe, expect, test } from "bun:test";
import { preferredProfilePic, profilePicCandidates } from "../lib/profile-pics";

describe("profilePicCandidates", () => {
  test("uses Twitter before LinkedIn", () => {
    const profile = {
      twitterProfile: { profilePicUrl: "https://x.com/avatar.jpg" },
      linkedinProfile: { profilePicUrl: "https://linkedin.com/avatar.jpg" },
    };

    expect(profilePicCandidates(profile)).toEqual([
      "https://x.com/avatar.jpg",
      "https://linkedin.com/avatar.jpg",
    ]);
    expect(preferredProfilePic(profile)).toBe("https://x.com/avatar.jpg");
  });

  test("falls back to LinkedIn when Twitter has no image", () => {
    const profile = {
      twitterProfile: { profilePicUrl: null },
      linkedinProfile: { profilePicUrl: "https://linkedin.com/avatar.jpg" },
    };

    expect(profilePicCandidates(profile)).toEqual(["https://linkedin.com/avatar.jpg"]);
    expect(preferredProfilePic(profile)).toBe("https://linkedin.com/avatar.jpg");
  });

  test("dedupes blank and repeated URLs", () => {
    const profile = {
      twitterProfile: { profilePicUrl: " https://cdn.example/avatar.jpg " },
      linkedinProfile: { profilePicUrl: "https://cdn.example/avatar.jpg" },
    };

    expect(profilePicCandidates(profile)).toEqual(["https://cdn.example/avatar.jpg"]);
  });
});
