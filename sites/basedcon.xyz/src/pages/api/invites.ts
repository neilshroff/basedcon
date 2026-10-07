import type { APIRoute } from 'astro';
import { authorized, readAll } from '@sites/shared/intake';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    if (!authorized(request, process.env.INVITES_ADMIN_KEY)) return new Response('Unauthorized', { status: 401 });

    const records = await readAll('invites');

    const format = new URL(request.url).searchParams.get('format');
    if (format === 'csv') {
        const cols = ['created_at', 'name', 'email', 'bio', 'url', 'event', 'referrer', 'user_agent', 'ip', 'id'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.join(','), ...records.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
        return new Response(csv, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment; filename="basedcon-invites.csv"' },
        });
    }

    return new Response(JSON.stringify({ count: records.length, invites: records }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
};
