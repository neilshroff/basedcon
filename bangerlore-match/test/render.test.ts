import { describe, expect, test } from "bun:test";
import { esc, renderHtml } from "../lib/render";
import type { Blurb } from "../blurbs";
import type { GuestMatches } from "../match";

const blurb = (id: string, over: Partial<Blurb> = {}): Blurb => ({
  id,
  name: `Name ${id}`,
  blurb: `Blurb for ${id}`,
  tags: ["ai", "robotics"],
  lookingFor: "people",
  profilePicUrl: null,
  ...over,
});

describe("esc", () => {
  test("escapes the four HTML metacharacters", () => {
    expect(esc(`<script>alert("&")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;&amp;&quot;)&lt;/script&gt;",
    );
  });
  test("passes safe text through", () => {
    expect(esc("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(esc("plain")).toBe("plain");
  });
});

describe("renderHtml — XSS resistance", () => {
  test("script tag in bio renders inert", () => {
    const html = renderHtml(
      [blurb("a", { blurb: `<script>alert(1)</script>` })],
      [],
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  test("attribute breakout via name is neutralized", () => {
    const html = renderHtml(
      [blurb("a", { name: `x" onmouseover="alert(1)` })],
      [],
    );
    expect(html).not.toContain(`onmouseover="alert(1)"`);
  });
  test("malicious profile pic URL cannot break out of src attribute", () => {
    const html = renderHtml(
      [blurb("a", { profilePicUrl: `x" onerror="alert(1)` })],
      [],
    );
    expect(html).not.toContain(`" onerror="alert(1)"`);
  });
  test("tag injection in tags is escaped in data attribute", () => {
    const html = renderHtml([blurb("a", { tags: [`"><img src=x>`] })], []);
    expect(html).not.toContain(`"><img src=x>`);
  });
});

describe("renderHtml — structure", () => {
  const blurbs = [blurb("a"), blurb("b"), blurb("c")];
  const matches: GuestMatches[] = [
    {
      id: "a",
      name: "Name a",
      matches: [
        { id: "b", name: "Name b", reason: "shared ai", icebreaker: "hey b" },
      ],
    },
  ];

  test("guest with matches gets the meet section", () => {
    const html = renderHtml(blurbs, matches);
    expect(html).toContain("People you should meet");
    expect(html).toContain("hey b");
  });
  test("guest without matches renders a card with no empty meet section", () => {
    const html = renderHtml(blurbs, matches);
    const cards = html.split('<section class="card"').length - 1;
    expect(cards).toBe(3);
    const meetSections = html.split("People you should meet").length - 1;
    expect(meetSections).toBe(1);
  });
  test("match referencing an unknown id renders empty, not broken", () => {
    const html = renderHtml(blurbs, [
      { id: "a", name: "Name a", matches: [{ id: "ghost", name: "?", reason: "r", icebreaker: "i" }] },
    ]);
    expect(html).not.toContain("ghost");
  });
  test("guest count appears in subtitle", () => {
    expect(renderHtml(blurbs, matches)).toContain("3 guests");
  });
  test("no-pic guest gets initial-letter fallback avatar", () => {
    const html = renderHtml([blurb("a", { name: "Zara" })], []);
    expect(html).toContain(`class="avatar large fallback">Z</div>`);
  });
  test("search data attributes are lowercased", () => {
    const html = renderHtml([blurb("a", { name: "MiXeD CaSe" })], []);
    expect(html).toContain(`data-name="mixed case"`);
  });
});
