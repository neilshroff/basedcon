import { describe, expect, test } from "bun:test";
import { stableId } from "../lib/identity";

// REGRESSION GUARD (eng review Issue 2): IDs must be glued to the person, not
// the row. A re-exported guests.json with different ordering must produce the
// same ID for the same human.
describe("stableId", () => {
  test("same person, same id — independent of any ordering context", () => {
    expect(stableId("a@x.com", "Anirudh", "s")).toBe(stableId("a@x.com", "Anirudh", "s"));
  });

  test("email is case/whitespace normalized", () => {
    expect(stableId(" A@X.com ", "Anirudh", "s")).toBe(stableId("a@x.com", "Anirudh", "s"));
  });

  test("two guests with the same name but different emails get distinct ids", () => {
    expect(stableId("anirudh1@x.com", "Anirudh", "s"))
      .not.toBe(stableId("anirudh2@x.com", "Anirudh", "s"));
  });

  test("missing email falls back to normalized name", () => {
    expect(stableId(null, " Jatin ", "s")).toBe(stableId("", "jatin", "s"));
  });

  test("name change with same email keeps the id (email is the anchor)", () => {
    expect(stableId("a@x.com", "Anirudh", "s")).toBe(stableId("a@x.com", "Anirudh Kumar", "s"));
  });

  test("salt changes the id (emails not directly reverse-hashable)", () => {
    expect(stableId("a@x.com", "Anirudh", "salt1")).not.toBe(stableId("a@x.com", "Anirudh", "salt2"));
  });

  test("id shape is stable and html-safe", () => {
    expect(stableId("a@x.com", "Anirudh", "s")).toMatch(/^u[0-9a-f]{10}$/);
  });

  test("simulated re-export: reordering guests does not change anyone's id", () => {
    const guests = [
      { email: "a@x.com", name: "A" },
      { email: "b@x.com", name: "B" },
      { email: "c@x.com", name: "C" },
    ];
    const before = guests.map((g) => stableId(g.email, g.name, "s"));
    const reordered = [guests[2], guests[0], guests[1]];
    const after = reordered.map((g) => stableId(g.email, g.name, "s"));
    expect(new Set(after)).toEqual(new Set(before));
    expect(after[1]).toBe(before[0]); // A keeps A's id wherever the row moved
  });
});
