// Saves and loads a signed-in visitor's chats and projects (private Vercel Blob, one file per person).
// The page sends everything it has; we merge by "last updated" so several devices stay in sync.
import { put, get, del } from '@vercel/blob';
import { readToken, userPath } from '../lib/session.js';

const MAX_BYTES = 3_000_000, KEEP_DELETED_MS = 30 * 86400000;
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const idOk = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

function cleanChat(c) {
  if (!c || !idOk(c.id)) return null;
  const out = { id: c.id, updatedAt: num(c.updatedAt), createdAt: num(c.createdAt) };
  if (c.deleted) return Object.assign(out, { deleted: true });
  out.title = str(c.title, 80) || 'New chat';
  out.projectId = idOk(c.projectId) ? c.projectId : null;
  out.messages = (Array.isArray(c.messages) ? c.messages : []).slice(-300).filter((m) => m && (m.role === 'user' || m.role === 'bot')).map((m) => ({ role: m.role, text: str(m.text, 12000), t: num(m.t) }));
  return out;
}
function cleanProject(p) {
  if (!p || !idOk(p.id)) return null;
  const out = { id: p.id, updatedAt: num(p.updatedAt), createdAt: num(p.createdAt) };
  if (p.deleted) return Object.assign(out, { deleted: true });
  return Object.assign(out, { name: str(p.name, 60) || 'Project', instructions: str(p.instructions, 2000), notes: str(p.notes, 8000) });
}
function merge(a, b) {
  const m = new Map();
  [...a, ...b].forEach((x) => { const o = m.get(x.id); if (!o || x.updatedAt > o.updatedAt) m.set(x.id, x); });
  const now = Date.now();
  return [...m.values()].filter((x) => !(x.deleted && now - x.updatedAt > KEEP_DELETED_MS));
}
const list = (v, f, max) => (Array.isArray(v) ? v.slice(0, max).map(f).filter(Boolean) : []);

async function load(path) {
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return { chats: [], projects: [] };
    const d = JSON.parse(await new Response(r.stream).text());
    return { chats: list(d.chats, cleanChat, 400), projects: list(d.projects, cleanProject, 100) };
  } catch (e) { return { chats: [], projects: [] }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = readToken(req);
  if (!user) return res.status(401).json({ error: 'Please sign in again' });
  const path = userPath(user.sub);
  try {
    if (req.method === 'GET') return res.status(200).json(await load(path));
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    if (Number(req.headers['content-length'] || 0) > MAX_BYTES) return res.status(413).json({ error: 'Too much chat data to save' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.action === 'wipe') { try { await del(path); } catch (e) {} return res.status(200).json({ chats: [], projects: [] }); }
    const mine = await load(path);
    const merged = {
      chats: merge(mine.chats, list(body.chats, cleanChat, 400)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 400),
      projects: merge(mine.projects, list(body.projects, cleanProject, 100)).slice(0, 100)
    };
    const json = JSON.stringify(merged);
    if (json.length > MAX_BYTES) return res.status(413).json({ error: 'Too much chat data to save. Delete some old chats.' });
    await put(path, json, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
    return res.status(200).json(merged);
  } catch (e) {
    console.error('sync failed:', e && e.message);
    return res.status(500).json({ error: 'Could not save your chats right now' });
  }
}
