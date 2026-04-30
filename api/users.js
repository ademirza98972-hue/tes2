const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { secret } = req.query;

  if (!ADMIN_SECRET) return res.status(500).json({ error: 'Server tidak dikonfigurasi' });
  if (!secret || secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const users = await dbRes.json();
  res.status(200).json(Array.isArray(users) ? users : []);
};
