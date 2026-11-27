// Makes pictures for the website chat via OpenRouter's Images API. The key stays on the server.
// Optional Vercel env vars: IMAGE_MODEL (default bytedance-seed/seedream-4.5, about $0.05 per picture), IMAGES_PER_HOUR_LIMIT is not needed;
// a simple per-visitor limit below protects your credits.
export const config = { maxDuration: 60 };

const MODEL = process.env.IMAGE_MODEL || 'bytedance-seed/seedream-4.5';
const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const hits = new Map();   // ip -> [timestamps]  (resets when the server instance restarts; good enough as a brake)
const LIMIT = Number(process.env.IMAGES_PER_HOUR) || 6;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'the AI key is not set on the server' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600000);
    if (list.length >= LIMIT) return res.status(429).json({ error: 'picture limit reached (' + LIMIT + ' per hour). Please try later' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = typeof body.prompt === 'string' ? body.prompt.replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ').trim().slice(0, 1000) : '';
    if (prompt.length < 3) return res.status(400).json({ error: 'describe the picture you want' });
    const ratio = RATIOS.includes(body.ratio) ? body.ratio : '1:1';
    const payload = { model: MODEL, prompt, n: 1, aspect_ratio: ratio };
    const ref = body.reference;
    if (typeof ref === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(ref) && ref.length < 3000000) payload.input_references = [{ type: 'image_url', image_url: { url: ref } }];

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 55000);
    let r;
    try {
      r = await fetch('https://openrouter.ai/api/v1/images', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'X-Title': 'MRSHADOW site images' },
        body: JSON.stringify(payload)
      });
    } finally { clearTimeout(timer); }
    const d = await r.json().catch(() => null);
    const it = d && Array.isArray(d.data) && d.data[0];
    if (it && it.b64_json) {
      list.push(now); hits.set(ip, list);
      const type = /^image\/(png|jpeg|webp)$/.test(d.media_type || it.media_type || '') ? (d.media_type || it.media_type) : 'image/png';
      return res.status(200).json({ image: 'data:' + type + ';base64,' + it.b64_json });
    }
    if (it && typeof it.url === 'string' && /^https:\/\//.test(it.url)) { list.push(now); hits.set(ip, list); return res.status(200).json({ image: it.url }); }
    console.error('image error', r.status, JSON.stringify(d && d.error || d).slice(0, 300));
    const why = r.status === 401 ? 'the AI key was rejected'
      : r.status === 402 ? 'the AI account is out of credits'
      : r.status === 429 ? 'the picture maker is busy, try again in a minute'
      : r.status === 400 ? 'that picture request was not accepted (try different words)'
      : ((d && d.error && d.error.message) ? String(d.error.message).slice(0, 140) : 'the picture maker returned an error (' + r.status + ')');
    return res.status(502).json({ error: why });
  } catch (e) {
    console.error('image failed:', e && e.message);
    return res.status(500).json({ error: e && e.name === 'AbortError' ? 'the picture took too long' : 'the picture service had a problem' });
  }
}
