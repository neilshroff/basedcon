import { ZenRows } from "zenrows";

const apiKey = Bun.env.ZENROWS_API_KEY;
if (!apiKey) throw new Error("ZENROWS_API_KEY is not set");

const client = new ZenRows(apiKey, { retries: 1 });

export async function fetchHtml(url: string): Promise<string> {
  const response = await client.get(url, {
    js_render: true,
    premium_proxy: true,
  });
  return response.text();
}
