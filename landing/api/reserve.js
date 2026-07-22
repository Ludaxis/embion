// Stores reserve / notify / founding-lab submissions server-side.
// Storage backends, first configured wins (Vercel env vars):
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  -> insert into `signups`
//     (create with: id uuid default gen_random_uuid() primary key,
//      created_at timestamptz default now(), email text, name text,
//      kind text, message text, page text)
//   RESERVE_WEBHOOK_URL                       -> POST the record as JSON
// With neither configured this returns 501 and the client falls back to a
// prefilled mailto — no submission is silently dropped.
const KINDS = new Set(['reserve', 'notify', 'founding_lab']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { email, name, kind, message, page, company } = req.body ?? {};
  // Honeypot: the visible form never fills `company`; bots do. Pretend success.
  if (typeof company === 'string' && company.length > 0) {
    return res.status(200).json({ ok: true });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }
  const record = {
    email: email.slice(0, 200),
    name: String(name ?? '').slice(0, 200),
    kind: KINDS.has(kind) ? kind : 'reserve',
    message: String(message ?? '').slice(0, 2000),
    page: String(page ?? '').slice(0, 200),
  };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESERVE_WEBHOOK_URL } = process.env;
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/signups`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      return res.status(200).json({ ok: true });
    }
    if (RESERVE_WEBHOOK_URL) {
      const r = await fetch(RESERVE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...record, at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`webhook ${r.status}`);
      return res.status(200).json({ ok: true });
    }
    return res.status(501).json({ ok: false, error: 'storage not configured' });
  } catch (err) {
    console.error('reserve failed:', err);
    return res.status(502).json({ ok: false, error: 'storage failed' });
  }
}
