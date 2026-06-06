import { describe, expect, test } from "bun:test";
import {
  cleanLinkedInBio,
  cleanLinkedInName,
  cleanTwitterBio,
  cleanTwitterName,
  decodeHtml,
} from "../profiles";

describe("cleanTwitterName", () => {
  test("strips (@handle) suffix", () => {
    expect(cleanTwitterName("Jane Doe (@janedoe) / X")).toBe("Jane Doe");
  });
  test("strips 'on X' / 'on Twitter' suffixes", () => {
    expect(cleanTwitterName("Jane Doe on X")).toBe("Jane Doe");
    expect(cleanTwitterName("Jane Doe | Twitter")).toBe("Jane Doe");
  });
  test("null and empty stay null", () => {
    expect(cleanTwitterName(null)).toBeNull();
    expect(cleanTwitterName("  ")).toBeNull();
  });
});

describe("cleanTwitterBio", () => {
  test("strips 'The latest posts from' prefix", () => {
    expect(cleanTwitterBio("The latest posts from Jane (@janedoe). builds robots")).toBe(
      "builds robots",
    );
  });
  test("plain bio passes through", () => {
    expect(cleanTwitterBio("builds robots")).toBe("builds robots");
  });
  test("null stays null", () => {
    expect(cleanTwitterBio(null)).toBeNull();
  });
});

describe("cleanLinkedInName", () => {
  test("strips | LinkedIn suffix", () => {
    expect(cleanLinkedInName("Abdul Maajith | LinkedIn")).toBe("Abdul Maajith");
  });
  test("null stays null", () => {
    expect(cleanLinkedInName(null)).toBeNull();
  });
});

describe("cleanLinkedInBio", () => {
  test("strips 'View X's profile on LinkedIn,' prefix", () => {
    expect(cleanLinkedInBio("View Jane's profile on LinkedIn, a professional community"))
      .toBe("a professional community");
  });
  test("plain bio passes through", () => {
    expect(cleanLinkedInBio("Engineer at Acme")).toBe("Engineer at Acme");
  });
});

describe("decodeHtml", () => {
  test("decodes entities", () => {
    expect(decodeHtml("Tom &amp; Jerry &quot;show&quot; &#8211; &lt;live&gt;"))
      .toBe(`Tom & Jerry "show" ${String.fromCharCode(8211)} <live>`);
  });
  test("collapses whitespace", () => {
    expect(decodeHtml("a\n  b\t c")).toBe("a b c");
  });
});
