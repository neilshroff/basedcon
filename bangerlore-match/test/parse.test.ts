import { describe, expect, test } from "bun:test";
import { linkedinUrl, normalizeUrl, twitterUrl } from "../lib/parse";

describe("twitterUrl", () => {
  test("full x.com URL", () => {
    expect(twitterUrl("https://x.com/aakancvedi")).toBe("https://x.com/aakancvedi");
  });
  test("twitter.com URL normalizes to x.com", () => {
    expect(twitterUrl("https://twitter.com/foo_bar")).toBe("https://x.com/foo_bar");
  });
  test("www and no protocol", () => {
    expect(twitterUrl("www.x.com/someone")).toBe("https://x.com/someone");
    expect(twitterUrl("x.com/someone")).toBe("https://x.com/someone");
  });
  test("bare @handle in free text", () => {
    expect(twitterUrl("find me @cool_guy on the bird app")).toBe("https://x.com/cool_guy");
  });
  test("trailing punctuation from form text", () => {
    expect(twitterUrl("https://x.com/foo),")).toBe("https://x.com/foo");
  });
  test("URL takes precedence over @mention", () => {
    expect(twitterUrl("@other https://x.com/primary")).toBe("https://x.com/primary");
  });
  test("no handle present", () => {
    expect(twitterUrl("https://linkedin.com/in/foo")).toBeNull();
    expect(twitterUrl("just my name")).toBeNull();
  });
  test("handle longer than 15 chars truncates to valid prefix (documented current behavior)", () => {
    expect(twitterUrl("x.com/abcdefghijklmnopqr")).toBe("https://x.com/abcdefghijklmno");
  });
});

describe("linkedinUrl", () => {
  test("standard /in/ URL", () => {
    expect(linkedinUrl("https://linkedin.com/in/abdul-maajith-3190bb1b9"))
      .toBe("https://linkedin.com/in/abdul-maajith-3190bb1b9");
  });
  test("www prefix preserved, protocol added", () => {
    expect(linkedinUrl("www.linkedin.com/in/foo")).toBe("https://www.linkedin.com/in/foo");
  });
  test("query string stripped", () => {
    expect(linkedinUrl("https://linkedin.com/in/foo?utm_source=share")).toBe(
      "https://linkedin.com/in/foo",
    );
  });
  test("trailing slash stripped", () => {
    expect(linkedinUrl("https://linkedin.com/in/foo/")).toBe("https://linkedin.com/in/foo");
  });
  test("company pages match too", () => {
    expect(linkedinUrl("linkedin.com/company/acme")).toBe("https://linkedin.com/company/acme");
  });
  test("embedded in prose with trailing comma", () => {
    expect(linkedinUrl("here: linkedin.com/in/foo, and also twitter"))
      .toBe("https://linkedin.com/in/foo");
  });
  test("absent", () => {
    expect(linkedinUrl("https://x.com/foo")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  test("adds https", () => {
    expect(normalizeUrl("example.com/x")).toBe("https://example.com/x");
  });
  test("upgrades http and strips trailing punctuation", () => {
    expect(normalizeUrl("http://example.com/x),")).toBe("https://example.com/x");
  });
});
