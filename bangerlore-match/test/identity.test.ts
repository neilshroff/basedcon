import { describe, expect, test } from "bun:test";
import { profileFor } from "../lib/identity";

// REGRESSION GUARD (eng review Issue 1): two guests named "Anirudh" must each
// get their OWN profile. The old name-keyed Map collapsed them onto one entry.
describe("profileFor — duplicate names", () => {
  const profiles = [
    { name: "Anirudh", bio: "robotics anirudh" },
    { name: "Zara", bio: "designer" },
    { name: "Anirudh", bio: "fintech anirudh" },
  ];

  test("each duplicate-name guest resolves to their own row", () => {
    expect(profileFor(profiles, 0, "Anirudh")?.bio).toBe("robotics anirudh");
    expect(profileFor(profiles, 2, "Anirudh")?.bio).toBe("fintech anirudh");
  });

  test("misaligned arrays refuse the join instead of attaching the wrong person", () => {
    // Simulates a stale social-profiles.json after guests.json was re-exported
    expect(profileFor(profiles, 1, "Anirudh")).toBeUndefined();
  });

  test("out-of-range index returns undefined", () => {
    expect(profileFor(profiles, 99, "Anirudh")).toBeUndefined();
  });
});
