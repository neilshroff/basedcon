// Form submissions live in a PRIVATE Vercel Blob store (BLOB_READ_WRITE_TOKEN):
// every read needs the store token, so nothing is reachable by URL.
//
// LEGACY_BLOB_READ_WRITE_TOKEN, when set, points at the old public store.
// readAll() moves anything still there into the private store and deletes the
// public copy, so the first export after deploy completes the migration.

import { put, list, get, del } from '@vercel/blob';

type Rec = Record<string, unknown>;

const safeTimingEqual = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
};

export function authorized(request: Request, key: string | undefined) {
    if (!key) return false;
    const auth = request.headers.get('authorization') ?? '';
    const q = new URL(request.url).searchParams.get('key') ?? '';
    return safeTimingEqual(auth, `Bearer ${key}`) || safeTimingEqual(q, key);
}

export async function save(prefix: string, id: string, record: Rec) {
    await put(`${prefix}/${id}.json`, JSON.stringify(record, null, 2), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
    });
}

async function migrateLegacy(prefix: string) {
    const token = process.env.LEGACY_BLOB_READ_WRITE_TOKEN;
    if (!token) return;
    let cursor: string | undefined;
    do {
        const page = await list({ prefix: `${prefix}/`, cursor, limit: 1000, token });
        for (const b of page.blobs) {
            const res = await fetch(b.url, { cache: 'no-store' });
            if (!res.ok) continue;
            const rec = (await res.json()) as Rec;
            const id = String(rec.id ?? b.pathname.replace(/^.*\//, '').replace(/\.json$/, ''));
            await save(prefix, id, rec);
            await del(b.url, { token });
        }
        cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
}

export async function readAll(prefix: string): Promise<Rec[]> {
    try {
        await migrateLegacy(prefix);
    } catch (err) {
        console.error('intake: legacy migration failed', err);
    }
    const records: Rec[] = [];
    let cursor: string | undefined;
    do {
        const page = await list({ prefix: `${prefix}/`, cursor, limit: 1000 });
        for (const b of page.blobs) {
            const r = await get(b.pathname, { access: 'private', useCache: false });
            if (r?.statusCode === 200) records.push(JSON.parse(await new Response(r.stream).text()));
        }
        cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return records.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
