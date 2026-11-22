// Owner-only: list or delete suggestions. Protected by the ADMIN_KEY environment variable.
import { list, del } from '@vercel/blob';
import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest();

function authed(req) {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 8) return false;
  const given = req.headers['x-admin-key'];
  return typeof given === 'string' && timingSafeEqual(sha(given), sha(key));
}

function isSuggestionUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com') && /^\/suggestions\/[^/]+\.json$/.test(decodeURIComponent(u.pathname));
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authed(req)) { await new Promise((r) => setTimeout(r, 500)); return res.status(401).json({ error: 'Wrong or missing admin key' }); }
  try {
    if (req.method === 'GET') {
      const r = await list({ prefix: 'suggestions/', limit: 300 });
      const blobs = r.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const items = await Promise.all(blobs.map(async (b) => {
        try { const j = await (await fetch(b.url)).json(); return { url: b.url, category: String(j.category || 'Other'), idea: String(j.idea || ''), name: String(j.name || ''), at: j.at || b.uploadedAt }; }
        catch (e) { return null; }
      }));
      return res.status(200).json({ items: items.filter(Boolean) });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (body.action !== 'delete' || !isSuggestionUrl(body.url)) return res.status(400).json({ error: 'Invalid request' });
      await del(body.url);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'GET or POST only' });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Server error' });
  }
}
