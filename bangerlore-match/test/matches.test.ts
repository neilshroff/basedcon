import { describe, expect, test } from "bun:test";
import { validateMatches } from "../lib/matches";

const ids = new Set(["a", "b", "c", "d", "self"]);
const m = (id: string) => ({ id, reason: `r-${id}`, icebreaker: `i-${id}` });

describe("validateMatches", () => {
  test("passes through four valid matches", () => {
    expect(validateMatches([m("a"), m("b"), m("c"), m("d")], "self", ids).map((x) => x.id))
      .toEqual(["a", "b", "c", "d"]);
  });
  test("drops self-matches", () => {
    expect(validateMatches([m("self"), m("a"), m("b"), m("c")], "self", ids).map((x) => x.id))
      .toEqual(["a", "b", "c"]);
  });
  test("drops duplicate ids, keeps first occurrence", () => {
    expect(validateMatches([m("a"), m("a"), m("b"), m("c")], "self", ids).map((x) => x.id))
      .toEqual(["a", "b", "c"]);
  });
  test("drops ids not in the roster (model hallucination)", () => {
    expect(validateMatches([m("zzz"), m("a"), m("b")], "self", ids).map((x) => x.id))
      .toEqual(["a", "b"]);
  });
  test("caps at four", () => {
    expect(validateMatches([m("a"), m("b"), m("c"), m("d"), m("a")], "self", ids)).toHaveLength(4);
  });
  test("returns fewer than four when input is thin — never throws", () => {
    expect(validateMatches([m("self"), m("self")], "self", ids)).toEqual([]);
    expect(validateMatches([], "self", ids)).toEqual([]);
  });
});
