// "Sign in with Google": the page sends the Google ID token, we verify it with Google, then return our own session token.
import { makeToken } from '../lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Sign-in is not set up on the server (GOOGLE_CLIENT_ID is missing)' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const cred = typeof body.credential === 'string' ? body.credential : '';
    if (cred.length < 100 || cred.length > 4000) return res.status(400).json({ error: 'Invalid sign-in' });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    const g = await r.json().catch(() => null);
    const okIss = g && (g.iss === 'accounts.google.com' || g.iss === 'https://accounts.google.com');
    if (!r.ok || !g || g.aud !== clientId || !okIss || String(g.email_verified) !== 'true' || !g.sub || Number(g.exp) * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Google sign-in could not be verified' });
    }
    const user = { sub: g.sub, email: g.email || '', name: g.name || (g.email || '').split('@')[0], picture: typeof g.picture === 'string' && g.picture.startsWith('https://') ? g.picture : '' };
    return res.status(200).json({ token: makeToken(user), user: { name: user.name, email: user.email, picture: user.picture } });
  } catch (e) {
    console.error('auth failed:', e && e.message);
    return res.status(500).json({ error: /SESSION_SECRET/.test(String(e && e.message)) ? 'Sign-in is not set up on the server (SESSION_SECRET is missing)' : 'Sign-in failed' });
  }
}
