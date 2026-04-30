const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const adminAttempts = new Map();
function adminRateLimit(ip) {
  const now = Date.now();
  const entry = adminAttempts.get(ip) || { count: 0, start: now, blocked: false };
  if (entry.blocked && now - entry.start < 60000) return true; // 1 menit saja
  if (now - entry.start > 300000) { entry.count = 0; entry.start = now; entry.blocked = false; }
  entry.count++;
  if (entry.count > 20) { entry.blocked = true; entry.start = now; } // limit lebih longgar
  adminAttempts.set(ip, entry);
  return entry.blocked;
}


async function logActivity(userId, action, detail) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, detail }),
    });
  } catch(e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (adminRateLimit(ip)) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) return res.status(400).json({ error: 'Empty body' });

  const { secret, userId, action, plan, duration } = body;

  if (!ADMIN_SECRET) return res.status(500).json({ error: 'Server tidak dikonfigurasi' });
  if (!secret || secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Secret salah' });
  if (!userId || !action) return res.status(400).json({ error: 'Missing userId atau action' });

  let updateData = {};

  if (action === 'set_plan') {
    // Set plan dengan durasi
    if (!plan) return res.status(400).json({ error: 'Missing plan' });

    let expiry = null;
    if (plan !== 'free' && duration) {
      const now = new Date();
      if (duration === 'weekly') {
        now.setDate(now.getDate() + 7);
      } else if (duration === 'monthly') {
        now.setMonth(now.getMonth() + 1);
      } else if (duration === 'lifetime') {
        now.setFullYear(now.getFullYear() + 100); // practically forever
      }
      expiry = now.toISOString();
    }

    updateData = { plan, plan_expiry: expiry, is_premium: plan !== 'free' };

  } else if (action === 'reset_export') {
    const exportCount = typeof body.count === 'number' ? body.count : 0;
    updateData = { bypass_count: exportCount, bypass_reset_date: new Date().toISOString().split('T')[0] };

  } else if (action === 'activate') {
    updateData = { plan: 'premium', is_premium: true, plan_expiry: null };
  } else if (action === 'deactivate') {
    updateData = { plan: 'free', is_premium: false, plan_expiry: null };
  } else if (action === 'delete_user') {
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!delRes.ok) return res.status(500).json({ error: 'Gagal hapus user' });
    return res.status(200).json({ ok: true, userId, deleted: true });
  } else {
    return res.status(400).json({ error: 'Action tidak valid' });
  }

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(updateData),
  });

  const result = await patchRes.json();
  if (!result || result.length === 0) {
    return res.status(404).json({ error: 'User tidak ditemukan. Pastikan user sudah pernah login.' });
  }

  // Log aktivitas
    if (action === 'set_plan') {
      await logActivity(userId, 'plan_change', `${plan}:${duration||'lifetime'}`);
    } else if (action === 'delete_user') {
      // tidak log karena user sudah dihapus
    } else if (action === 'reset_export') {
      await logActivity(userId, 'export_reset', 'by admin');
    }
    res.status(200).json({ ok: true, userId, updateData, user: result[0] });
};

// Tambah fungsi log (append ke file yang sudah ada)
