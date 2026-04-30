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

const rateLimitMap = new Map();
function rateLimit(ip, max=30, windowMs=60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > max;
}

function getPlanInfo(user) {
  const now = new Date();
  let plan = user.plan || 'free';

  // Cek apakah plan sudah expired
  if (plan !== 'free' && user.plan_expiry) {
    const expiry = new Date(user.plan_expiry);
    if (now > expiry) {
      plan = 'free'; // expired, downgrade ke free
    }
  }

  const isUnlimited = plan === 'basic' || plan === 'premium';
  const exportLimit = isUnlimited ? 999 : 2;

  return { plan, isUnlimited, exportLimit, planExpiry: user.plan_expiry };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (rateLimit(ip)) return res.status(429).json({ error: 'Too many requests' });

  const cookies = parseCookie(req.headers.cookie);
  const sessionRaw = cookies['nova_session'];
  if (!sessionRaw) return res.status(200).json({ loggedIn: false });

  try {
    const session = JSON.parse(Buffer.from(sessionRaw, 'base64').toString());
    if (!session.id) return res.status(200).json({ loggedIn: false });

    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${session.id}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    const users = await dbRes.json();
    const user = users?.[0];
    if (!user) return res.status(200).json({ loggedIn: false });

    const { plan, isUnlimited, exportLimit, planExpiry } = getPlanInfo(user);

    // Auto downgrade di database kalau plan expired
    if (plan === 'free' && user.plan !== 'free') {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'free', plan_expiry: null }),
      });
    }

    // Reset bypass count harian
    const today = new Date(Date.now() + 8*60*60*1000).toISOString().split('T')[0];
    if (user.bypass_reset_date !== today && !isUnlimited) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypass_count: 0, bypass_reset_date: today }),
      });
      user.bypass_count = 0;
    }

    const exportLeft = isUnlimited ? 999 : Math.max(0, exportLimit - user.bypass_count);

    res.status(200).json({
      loggedIn: true,
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      plan,
      planExpiry,
      isUnlimited,
      exportLeft,
    });
  } catch (err) {
    res.status(200).json({ loggedIn: false });
  }
};
