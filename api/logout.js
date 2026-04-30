module.exports = function handler(req, res) {
  res.setHeader('Set-Cookie', 'nova_session=; Path=/; HttpOnly; Secure; Max-Age=0; SameSite=Lax');
  res.redirect('/');
};
