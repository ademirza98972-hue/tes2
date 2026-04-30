const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async function handler(req, res) {
  // Verifikasi secret biar tidak bisa dipanggil sembarangan
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date(Date.now() + 8*60*60*1000).toISOString().split('T')[0];

    // Reset semua user yang bypass_reset_date-nya bukan hari ini
    const result = await fetch(
      `${SUPABASE_URL}/rest/v1/users?bypass_reset_date=neq.${today}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ bypass_count: 0, bypass_reset_date: today }),
      }
    );

    const data = await result.json();
    const count = Array.isArray(data) ? data.length : 0;

    res.status(200).json({
      ok: true,
      reset: count,
      date: today,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
