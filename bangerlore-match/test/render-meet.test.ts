import { describe, expect, test } from "bun:test";
import { embedJson, matchCountWord, renderMeetHtml, toPeople } from "../lib/render-meet";
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

const guestMatches = (id: string, targets: string[]): GuestMatches => ({
  id,
  name: `Name ${id}`,
  matches: targets.map((t) => ({
    id: t,
    name: `Name ${t}`,
    reason: `reason ${id}->${t}`,
    icebreaker: `icebreaker ${id}->${t}`,
  })),
});

describe("embedJson — script-block safety", () => {
  test("escapes < so data cannot close the script block", () => {
    const out = embedJson({ bio: `</script><script>alert(1)</script>` });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
  test("round-trips through JSON.parse", () => {
    const value = { name: `x" onerror="alert(1)`, bio: "<b>hi</b> line" };
    expect(JSON.parse(embedJson(value))).toEqual(value);
  });
});

describe("toPeople", () => {
  test("maps blurbs + matches + twitter into the client shape", () => {
    const people = toPeople(
      [blurb("a"), blurb("b")],
      [guestMatches("a", ["b"])],
      new Map([["Name a", "https://x.com/namea"]]),
    );
    expect(people[0]).toEqual({
      id: "a",
      name: "Name a",
      role: "ai · robotics",
      bio: "Blurb for a",
      lookingFor: "people",
      twitter: "https://x.com/namea",
      photo: null,
      search: "name a ai robotics blurb for a people https://x.com/namea namea",
      matches: [{ id: "b", reason: "reason a->b", icebreaker: "icebreaker a->b", mutual: false }],
    });
    expect(people[1].twitter).toBeNull();
    expect(people[1].matches).toEqual([]);
  });
  test("flags mutual picks", () => {
    const people = toPeople(
      [blurb("a"), blurb("b")],
      [guestMatches("a", ["b"]), guestMatches("b", ["a"])],
    );
    expect(people[0].matches[0].mutual).toBe(true);
    expect(people[1].matches[0].mutual).toBe(true);
  });
  test("drops matches pointing at unknown guests", () => {
    const people = toPeople([blurb("a")], [guestMatches("a", ["ghost"])]);
    expect(people[0].matches).toEqual([]);
  });
});

describe("matchCountWord", () => {
  test("uses the modal match count", () => {
    expect(matchCountWord([
      guestMatches("a", ["b", "c", "d", "e"]),
      guestMatches("b", ["a", "c", "d", "e"]),
      guestMatches("c", ["a"]),
    ])).toBe("four");
  });
  test("defaults to four when there are no matches", () => {
    expect(matchCountWord([])).toBe("four");
  });
});

describe("renderMeetHtml — XSS resistance", () => {
  test("script tag in blurb cannot escape the JSON block", () => {
    const html = renderMeetHtml(
      [blurb("a", { blurb: `</script><script>alert(1)</script>` })],
      [],
    );
    expect(html).not.toContain(`</script><script>alert(1)`);
  });
  test("malicious party photo path cannot break out of src attribute", () => {
    const html = renderMeetHtml([blurb("a")], [], {
      partyPhotos: [`x" onerror="alert(1)`],
    });
    expect(html).not.toContain(`" onerror="alert(1)"`);
  });
});

describe("renderMeetHtml — structure", () => {
  const blurbs = [blurb("a"), blurb("b"), blurb("c")];
  const matches = [guestMatches("a", ["b"])];

  test("embeds every guest in the data block", () => {
    const html = renderMeetHtml(blurbs, matches);
    const json = html.match(/<script type="application\/json" id="bl-data">(.*?)<\/script>/s)?.[1];
    expect(json).toBeTruthy();
    const data = JSON.parse(json!);
    expect(data.people).toHaveLength(3);
    expect(data.matchWord).toBe("one");
  });
  test("guest count appears in identify copy", () => {
    const html = renderMeetHtml(blurbs, matches);
    expect(html).toContain("3 people in the house");
  });
  test("browse search invites keyword search", () => {
    const html = renderMeetHtml(blurbs, matches);
    expect(html).toContain(`placeholder="search all attendees, random keywords ok too"`);
    expect(html).not.toContain(`placeholder="Search 3 attendees`);
    expect(html).toContain(`var shuffleSeed = (Date.now() % 100000) + 1;`);
  });
  test("uses the Bangerlore favicon and welcoming tagline", () => {
    const html = renderMeetHtml(blurbs, matches);
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`);
    expect(html).toContain(`the room is full of people who would love to meet you`);
    expect(html).not.toContain(`the room is full of people you don't know yet`);
  });
  test("party photos render collage tiles; none → no collage", () => {
    const withPhotos = renderMeetHtml(blurbs, matches, { partyPhotos: ["party/x.jpg"] });
    expect(withPhotos).toContain(`class="hero-bg hero-collage"`);
    expect(withPhotos).toContain(`src="party/x.jpg"`);
    const without = renderMeetHtml(blurbs, matches);
    expect(without).not.toContain(`class="hero-bg hero-collage"`);
  });
  test("does not render a passphrase gate or graph link", () => {
    expect(renderMeetHtml(blurbs, matches)).not.toContain(`id="gate"`);
    expect(renderMeetHtml(blurbs, matches)).not.toContain(`graph view`);
    expect(renderMeetHtml(blurbs, matches)).not.toContain(`href="graph.html"`);
  });
  test("links the first-view logo to the main site and renders circular avatars", () => {
    const html = renderMeetHtml(blurbs, matches);
    expect(html).toContain(`href="https://bangerlore.com/"`);
    expect(html).toContain(`span.style.borderRadius = "50%"`);
    expect(html).not.toContain(`size > 90 ? "16px"`);
  });
  test("renders the Bangerlore footer with linked hosts", () => {
    const html = renderMeetHtml(blurbs, matches);
    expect(html).not.toContain(`hosts:`);
    expect(html).toContain(`href="https://x.com/5hroff">Kunal Shroff</a>`);
    expect(html).toContain(`href="https://namanmaheshwari.com">Naman Maheshwari</a>`);
    expect(html).not.toContain(`href="https://x.com/neilshroff">Neil Shroff</a>`);
    expect(html).toContain(`href="https://bangerlore.com/hosts.html">conspirators</a>`);
  });
});
