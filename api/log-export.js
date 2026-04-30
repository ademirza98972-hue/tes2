const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function parseCookie(str) {
  const obj = {};
  (str || '').split(';').forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) obj[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
  });
  return obj;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const cookies = parseCookie(req.headers.cookie);
  const sessionRaw = cookies['nova_session'];
  if (!sessionRaw) return res.status(401).end();

  try {
    const session = JSON.parse(Buffer.from(sessionRaw, 'base64').toString());
    if (!session.id) return res.status(401).end();

    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: session.id,
        action: 'export_detail',
        detail: body.detail,
      }),
    });

    res.status(200).json({ ok: true });
  } catch(e) {
    res.status(500).end();
  }
};
