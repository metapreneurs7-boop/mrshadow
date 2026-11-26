// Receives a suggestion from the website and stores it as a small JSON file in your (private) Vercel Blob store under suggestions/.
// Only you can read them: open /admin.html and sign in with your ADMIN_KEY.
import { put } from '@vercel/blob';

const CATEGORIES = ['Tech', 'Share Market', 'Life Vlog', 'Other'];
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    if (Number(req.headers['content-length'] || 0) > 5000) return res.status(413).json({ error: 'Too long' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this hidden field, people do not
    // keep line breaks inside the idea but strip other control characters
    const idea = String(body.idea == null ? '' : body.idea).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);
    if (idea.length < 10) return res.status(400).json({ error: 'Please write a little more (at least 10 characters).' });
    const rec = {
      category: CATEGORIES.includes(body.category) ? body.category : 'Other',
      idea,
      name: clean(body.name, 40),
      at: new Date().toISOString()
    };
    await put('suggestions/' + Date.now() + '.json', JSON.stringify(rec), {
      access: 'private',         // your Blob store is Private: nothing here has a public link, only your admin page can read it
      addRandomSuffix: true,
      contentType: 'application/json'
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Suggestion box unavailable. Is a Blob store connected to this project?' });
  }
}
