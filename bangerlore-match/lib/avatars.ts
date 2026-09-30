// Avatar file validation: a cached avatar is only usable if it's an actual
// raster image. CDNs happily serve placeholder SVGs / error pages with HTTP
// 200 (LinkedIn's default "ghost person" avatar is a 451-byte SVG), and SVG
// <image> elements have no onerror fallback — junk files render as empty
// bubbles. Magic-byte check beats trusting content-type or status codes.

const MAGIC = [
  Buffer.from([0xff, 0xd8, 0xff]), // jpeg
  Buffer.from([0x89, 0x50, 0x4e, 0x47]), // png
  Buffer.from("GIF8"), // gif
  Buffer.from("RIFF"), // webp
];

export function isRasterImage(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 100) return false;
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(4, bytes.byteLength));
  return MAGIC.some((m) => head.subarray(0, m.length).equals(m.subarray(0, Math.min(m.length, head.length))));
}

export async function validAvatar(id: string): Promise<boolean> {
  const file = Bun.file(`avatars/${id}.jpg`);
  if (!(await file.exists()) || file.size < 100) return false;
  const head = new Uint8Array(await file.slice(0, 100).arrayBuffer());
  return isRasterImage(head);
}
