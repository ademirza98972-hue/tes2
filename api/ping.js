const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
