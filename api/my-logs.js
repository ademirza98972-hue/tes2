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
  const cookies = parseCookie(req.headers.cookie);
  const sessionRaw = cookies['nova_session'];
  if (!sessionRaw) return res.status(401).json({ error: 'Not logged in' });

  try {
    const session = JSON.parse(Buffer.from(sessionRaw, 'base64').toString());
    if (!session.id) return res.status(401).json({ error: 'Invalid session' });

    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/activity_logs?user_id=eq.${session.id}&action=eq.export_detail&order=created_at.desc&limit=50`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const logs = await dbRes.json();
    res.status(200).json(Array.isArray(logs) ? logs : []);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
