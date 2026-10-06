import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import { notify } from '@sites/shared/notify';

export const prerender = false;

const MAX = { name: 120, email: 200, bio: 500, url: 300, edition: 40 };
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > PER_WINDOW;
}

function clean(v: unknown, max: number) {
    return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
    let data: Record<string, unknown>;
    try {
        data = await request.json();
    } catch {
        return json({ error: 'Invalid request.' }, 400);
    }

    // Honeypot: real users never see this field.
    if (clean(data.company, 50)) return json({ ok: true });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'unknown';
    if (rateLimited(ip)) return json({ error: 'Too many requests. Please try again later.' }, 429);

    const name = clean(data.name, MAX.name);
    const email = clean(data.email, MAX.email).toLowerCase();
    const bio = clean(data.bio, MAX.bio);
    const url = clean(data.url, MAX.url);
    const edition = clean(data.edition, MAX.edition);

    if (!name || !email || !bio) return json({ error: 'Name, email and a line about you are required.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'That email address does not look right.' }, 400);
    if (url && !/^https?:\/\/\S+$/i.test(url)) return json({ error: 'Links need to start with http:// or https://.' }, 400);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('attend: BLOB_READ_WRITE_TOKEN is not set');
        return json({ error: 'Storage is not configured yet. Please email us instead.' }, 503);
    }

    const createdAt = new Date().toISOString();
    const id = `${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
    const record = {
        id,
        name,
        email,
        bio,
        url: url || null,
        edition,
        created_at: createdAt,
        user_agent: request.headers.get('user-agent') ?? null,
        referrer: request.headers.get('referer') ?? null,
        ip,
    };

    try {
        await put(`attend/${id}.json`, JSON.stringify(record, null, 2), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });
    } catch (err) {
        console.error('attend: blob put failed', err);
        return json({ error: 'Could not save your request. Please try again.' }, 500);
    }

    await notify({ site: 'Bangerlore', kind: 'attend request', event: edition, name, email, bio, url: url || null, referrer: record.referrer, id });

    return json({ ok: true, id });
};

export const GET: APIRoute = () => json({ error: 'Method not allowed.' }, 405);
