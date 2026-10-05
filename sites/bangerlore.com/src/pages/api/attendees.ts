import type { APIRoute } from 'astro';
import { list } from '@vercel/blob';

export const prerender = false;

function authorized(request: Request) {
    const key = process.env.ATTEND_ADMIN_KEY;
    if (!key) return false;
    const auth = request.headers.get('authorization') ?? '';
    const q = new URL(request.url).searchParams.get('key') ?? '';
    return auth === `Bearer ${key}` || q === key;
}

export const GET: APIRoute = async ({ request }) => {
    if (!authorized(request)) return new Response('Unauthorized', { status: 401 });

    const records: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    do {
        const page = await list({ prefix: 'attend/', cursor, limit: 1000 });
        for (const blob of page.blobs) {
            const res = await fetch(blob.url, { cache: 'no-store' });
            if (res.ok) records.push(await res.json());
        }
        cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    records.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const format = new URL(request.url).searchParams.get('format');
    if (format === 'csv') {
        const cols = ['created_at', 'name', 'email', 'bio', 'url', 'edition', 'referrer', 'user_agent', 'ip', 'id'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.join(','), ...records.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
        return new Response(csv, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="bangerlore-attendees.csv"' },
        });
    }

    return new Response(JSON.stringify({ count: records.length, attendees: records }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
    });
};
