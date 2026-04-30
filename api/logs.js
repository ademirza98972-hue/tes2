const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { secret, userId, limit = 50 } = req.query;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  try {
    let url = `${SUPABASE_URL}/rest/v1/activity_logs?select=*&order=created_at.desc&limit=${limit}`;
    if (userId) url += `&user_id=eq.${userId}`;

    const dbRes = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    const logs = await dbRes.json();

    // Ambil username dari tabel users untuk setiap log
    if (Array.isArray(logs) && logs.length > 0) {
      const userIds = [...new Set(logs.map(l => l.user_id))];
      const usersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,username,avatar`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const users = await usersRes.json();
      const userMap = {};
      if (Array.isArray(users)) users.forEach(u => userMap[u.id] = u);
      logs.forEach(log => { log.user = userMap[log.user_id] || null; });
    }

    res.status(200).json(Array.isArray(logs) ? logs : []);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
