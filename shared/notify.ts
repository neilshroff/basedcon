// Emails the organizers about a new form submission via Resend.
// Never throws: a failed email must not fail the submission.

export interface Submission {
    site: 'Basedcon' | 'Bangerlore';
    kind: string; // e.g. "invite request", "attend request"
    event: string; // e.g. "Delhi 31 October 2026", "v6"
    name: string;
    email: string;
    bio: string;
    url: string | null;
    referrer: string | null;
    id: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function notify(s: Submission): Promise<void> {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.NOTIFY_TO;
    const from = process.env.NOTIFY_FROM;
    if (!key || !to || !from) {
        console.warn('notify: RESEND_API_KEY / NOTIFY_TO / NOTIFY_FROM not set; skipping email');
        return;
    }

    const subject = `[${s.site}] ${s.kind}: ${s.name}`;
    const text = [
        `${s.name} <${s.email}>`,
        s.url ? `${s.url}` : null,
        '',
        s.bio,
        '',
        `— ${s.site} · ${s.event}`,
        s.referrer ? `from ${s.referrer}` : null,
        `id ${s.id}`,
    ].filter((l) => l !== null).join('\n');

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;line-height:1.5">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b6b">${esc(s.site)} · ${esc(s.kind)}</p>
  <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-.02em">${esc(s.name)}</h2>
  <p style="margin:0 0 4px"><a href="mailto:${esc(s.email)}" style="color:#e63946">${esc(s.email)}</a></p>
  ${s.url ? `<p style="margin:0 0 16px"><a href="${esc(s.url)}" style="color:#e63946">${esc(s.url)}</a></p>` : '<div style="height:12px"></div>'}
  <p style="margin:0 0 20px;font-size:17px;padding:14px 16px;background:#f3f1ec;border-left:3px solid #e63946">${esc(s.bio)}</p>
  <p style="margin:0;font-size:13px;color:#6b6b6b">${esc(s.event)}${s.referrer ? ` · from ${esc(s.referrer)}` : ''}<br>Reply to this email to answer them directly.</p>
</div>`.trim();

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from,
                to: to.split(',').map((a) => a.trim()),
                reply_to: s.email,
                subject,
                text,
                html,
                tags: [{ name: 'site', value: s.site.toLowerCase() }, { name: 'kind', value: s.kind.replace(/\s+/g, '-') }],
            }),
        });
        if (!res.ok) console.error('notify: resend', res.status, await res.text());
    } catch (err) {
        console.error('notify: resend request failed', err);
    }
}
