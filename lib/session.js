// Tiny signed-session helper (no extra packages). A session token proves who the visitor is after "Sign in with Google".
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const b64 = (b) => Buffer.from(b).toString('base64url');
const secret = () => { const s = process.env.SESSION_SECRET; if (!s || s.length < 16) throw new Error('SESSION_SECRET is missing or too short (use 16+ random characters)'); return s; };

export function makeToken(user, days = 30) {
  const payload = b64(JSON.stringify({ sub: String(user.sub), email: user.email || '', name: user.name || '', picture: user.picture || '', exp: Date.now() + days * 86400000 }));
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

export function readToken(req) {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = t.split('.');
  if (!payload || !sig) return null;
  let expect;
  try { expect = createHmac('sha256', secret()).update(payload).digest('base64url'); } catch (e) { return null; }
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const u = JSON.parse(Buffer.from(payload, 'base64url').toString()); return u && u.sub && u.exp > Date.now() ? u : null; } catch (e) { return null; }
}

export const userPath = (sub) => 'users/' + createHash('sha256').update(String(sub)).digest('hex').slice(0, 40) + '.json';
