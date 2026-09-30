import { describe, expect, test } from "bun:test";
import { isRasterImage } from "../lib/avatars";

describe("isRasterImage", () => {
  test("accepts PNG magic bytes", () => {
    const bytes = new Uint8Array(128);
    bytes.set([0x89, 0x50, 0x4e, 0x47]);

    expect(isRasterImage(bytes)).toBe(true);
  });

  test("rejects SVG and HTML placeholders", () => {
    expect(isRasterImage(new TextEncoder().encode("<svg></svg>".padEnd(128, " ")))).toBe(false);
    expect(isRasterImage(new TextEncoder().encode("<html></html>".padEnd(128, " ")))).toBe(false);
  });
});
