import { describe, expect, test } from "bun:test";
import { renderHtml } from "../lib/render";
import type { Blurb } from "../blurbs";

const blurbs: Blurb[] = [{
  id: "a",
  name: "A",
  blurb: "b",
  tags: [],
  lookingFor: "x",
  profilePicUrl: null,
}];

describe("privacy gate", () => {
  test("noindex meta always present", () => {
    expect(renderHtml(blurbs, [])).toContain(`<meta name="robots" content="noindex, nofollow">`);
  });

  test("no gate markup when passphrase omitted", () => {
    const html = renderHtml(blurbs, []);
    expect(html).not.toContain(`id="gate"`);
  });

  test("gate present when passphrase set; plaintext phrase never in page", () => {
    const html = renderHtml(blurbs, [], { passphrase: "Disco Banger" });
    expect(html).toContain(`id="gate"`);
    expect(html).not.toContain("Disco Banger");
    // normalized (trim+lowercase) base64 token is what's embedded
    expect(html).toContain(Buffer.from("disco banger").toString("base64"));
  });

  test("gate token normalizes case and whitespace at build time", () => {
    const a = renderHtml(blurbs, [], { passphrase: "  BANGER " });
    const b = renderHtml(blurbs, [], { passphrase: "banger" });
    const token = (html: string) => html.match(/var TOKEN = "([^"]+)"/)?.[1];
    expect(token(a)).toBe(token(b));
  });
});
