// Owner-only: list or delete suggestions. Protected by the ADMIN_KEY environment variable.
import { list, get, del } from '@vercel/blob';
import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest();

function authed(req) {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 8) return false;
  const given = req.headers['x-admin-key'];
  return typeof given === 'string' && timingSafeEqual(sha(given), sha(key));
}

const isSuggestionPath = (p) => typeof p === 'string' && /^suggestions\/[\w.\-]{1,160}\.json$/.test(p);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authed(req)) { await new Promise((r) => setTimeout(r, 500)); return res.status(401).json({ error: 'Wrong or missing admin key' }); }
  try {
    if (req.method === 'GET') {
      const r = await list({ prefix: 'suggestions/', limit: 300 });
      const blobs = r.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const problems = [];
      const read = async (b) => {
        let r = null, err = '';
        for (const ref of [b.pathname, b.url]) {          // try the path first, then the full URL
          try { r = await get(ref, { access: 'private' }); if (r && r.statusCode === 200) break; r = null; } catch (e) { err = String((e && e.message) || e); r = null; }
        }
        if (!r) { problems.push((b.pathname || '?') + ': ' + (err || 'not found')); return null; }
        try {
          const j = JSON.parse(await new Response(r.stream).text());
          return { path: b.pathname, category: String(j.category || 'Other'), idea: String(j.idea || ''), name: String(j.name || ''), at: j.at || b.uploadedAt };
        } catch (e) { problems.push((b.pathname || '?') + ': unreadable (' + String((e && e.message) || e) + ')'); return null; }
      };
      const items = (await Promise.all(blobs.map(read))).filter(Boolean);
      return res.status(200).json({ items, stored: blobs.length, problems: problems.slice(0, 5) });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (body.action !== 'delete' || !isSuggestionPath(body.path)) return res.status(400).json({ error: 'Invalid request' });
      await del(body.path);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'GET or POST only' });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Server error' });
  }
}
