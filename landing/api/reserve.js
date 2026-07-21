// Stores reserve / founding-lab / notify submissions server-side.
// Storage backends, first configured wins (Vercel env vars):
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  -> insert into `reservations`
//     (create with: id uuid default gen_random_uuid() primary key,
//      email text, kind text, subject text, ua text, at timestamptz)
//   RESERVE_WEBHOOK_URL                       -> POST the record as JSON
// With neither configured this returns 501 and the client falls back to a
// prefilled mailto — no submission is silently dropped.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { email, kind, subject, company } = req.body ?? {};
  // Honeypot: the visible form never fills `company`; bots do. Pretend success.
  if (typeof company === 'string' && company.length > 0) {
    return res.status(200).json({ ok: true });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }
  const record = {
    email: email.slice(0, 200),
    kind: String(kind ?? 'reserve').slice(0, 40),
    subject: String(subject ?? '').slice(0, 200),
    ua: String(req.headers['user-agent'] ?? '').slice(0, 300),
    at: new Date().toISOString(),
  };

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESERVE_WEBHOOK_URL } = process.env;
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/reservations`, {
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
        body: JSON.stringify(record),
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
