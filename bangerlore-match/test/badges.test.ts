import { describe, expect, test } from "bun:test";
import { mutualPairs, renderHtml } from "../lib/render";
import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";

const blurb = (id: string): Blurb => ({
  id,
  name: `Name ${id}`,
  blurb: "b",
  tags: [],
  lookingFor: "x",
  profilePicUrl: null,
});
const set = (id: string, picks: string[]): GuestMatches => ({
  id,
  name: `Name ${id}`,
  matches: picks.map((p) => ({ id: p, name: `Name ${p}`, reason: "r", icebreaker: "i" })),
});

describe("mutualPairs", () => {
  test("detects reciprocal picks in both directions", () => {
    const mutual = mutualPairs([set("a", ["b"]), set("b", ["a", "c"]), set("c", ["a"])]);
    expect(mutual.has("a→b")).toBe(true);
    expect(mutual.has("b→a")).toBe(true);
    expect(mutual.has("b→c")).toBe(false); // c didn't pick b
    expect(mutual.has("c→a")).toBe(false); // a didn't pick c
  });
});

describe("mutual badge rendering — own-card-only, positive-only", () => {
  const blurbs = [blurb("a"), blurb("b"), blurb("c")];
  const matches = [set("a", ["b", "c"]), set("b", ["a"]), set("c", ["b"])];
  const html = renderHtml(blurbs, matches);

  test("badge appears on both sides of a reciprocal pair", () => {
    // a↔b are mutual: badge in a's card (on b's row) and b's card (on a's row)
    const badges = html.split("they picked you too").length - 1;
    expect(badges).toBe(2);
  });

  test("one-way picks get no badge", () => {
    // a→c is one-way; c's row inside a's card must not carry a badge
    const aCard = html.slice(html.indexOf("Name a"), html.indexOf("Name b</h2>"));
    const cRow = aCard.slice(aCard.indexOf("Name c"));
    expect(cRow.slice(0, 200)).not.toContain("they picked you too");
  });

  test("no negative signal exists anywhere", () => {
    expect(html).not.toContain("didn't pick");
    expect(html).not.toContain("nobody picked");
  });
});
