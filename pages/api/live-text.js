// pages/api/live-text.js
// Συλλογή σύντομου γραπτού λόγου (ανοιχτού τύπου) — ίδιο πρότυπο με quiz-results.js.
//
// POST  ?start        auth    → { code }  δημιουργία { prompt }
// POST  (public)              → { ok, id } υποβολή { code, text, studentKey? }
// GET   ?code=XXXX    public  → { data }  όλες οι υποβολές (polling προβολής)
// GET   ?active=1     auth    → { code, data }
// GET   ?teacher=...  public  → { code, data }  για /class
// PATCH               auth    → { ok }    { code, id, pinned }  ή  { code, action:'clear' }
// DELETE ?code=XXXX   auth    → { ok }
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

const TTL = 14400;
const getKV = () => createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const key = (code) => `text:${code}`;
const activeKey = (email) => `text_active:${email}`;

const MAX_LEN = 280;    // μέγιστο μήκος υποβολής
const MAX_ITEMS = 500;  // μέγιστο πλήθος υποβολών ανά συνεδρία

function emptySession({ code, teacher, prompt }) {
  return {
    code,
    teacher: teacher || 'Εκπαιδευτικός',
    prompt: (prompt || 'Γράψε την απάντησή σου').toString().slice(0, 240),
    items: [],  // [{ id, text, pinned, ts }]
    count: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Μόνο ο κάτοχος του ενεργού session μπορεί να κάνει pin/clear.
async function ownsCode(kv, email, code) {
  const activeCode = await kv.get(activeKey(email));
  return activeCode && String(activeCode) === String(code);
}

export default async function handler(req, res) {
  const kv = getKV();

  if (req.method === 'GET') {
    const { code, active, teacher } = req.query;

    if (teacher) {
      try {
        const email = teacher.includes('@') ? teacher : teacher + '@gmail.com';
        const activeCode = await kv.get(activeKey(email));
        if (!activeCode) return res.status(200).json({ code: null });
        const data = await kv.get(key(activeCode));
        return res.status(200).json({ code: activeCode, data: data || null });
      } catch (e) { return res.status(200).json({ code: null }); }
    }

    if (active) {
      const session = await getServerSession(req, res, authOptions);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const activeCode = await kv.get(activeKey(session.user?.email));
        if (!activeCode) return res.status(200).json({ code: null });
        const data = await kv.get(key(activeCode));
        if (!data) { await kv.del(activeKey(session.user?.email)); return res.status(200).json({ code: null }); }
        return res.status(200).json({ code: activeCode, data });
      } catch (e) { return res.status(500).json({ error: 'Failed' }); }
    }

    if (!code) return res.status(400).json({ error: 'Missing code' });
    try {
      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ data });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  if (req.method === 'POST') {
    if (req.query.start !== undefined) {
      const session = await getServerSession(req, res, authOptions);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { prompt } = req.body || {};
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const s = emptySession({ code, prompt, teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός' });
        await kv.set(key(code), s, { ex: TTL });
        await kv.set(activeKey(session.user?.email), code, { ex: TTL });
        return res.status(200).json({ ok: true, code });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    // Υποβολή σύντομου λόγου — ΔΗΜΟΣΙΟ
    try {
      const { code, text, studentKey } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Missing code' });
      const clean = (text || '').toString().replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      if (!clean) return res.status(200).json({ ok: true, ignored: true });

      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Η συλλογή έληξε ή δεν υπάρχει' });
      if (data.items.length >= MAX_ITEMS) return res.status(200).json({ ok: true, capped: true });

      const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      data.items.push({ id, text: clean, pinned: false, ts: Date.now(), by: (studentKey || '').toString().slice(0, 60) });
      data.count++;
      data.updatedAt = Date.now();
      await kv.set(key(code), data, { ex: TTL });
      return res.status(200).json({ ok: true, id });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  /* ─────────── PATCH: pin/unpin ή clear — μόνο ο κάτοχος ─────────── */
  if (req.method === 'PATCH') {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { code, id, pinned, action } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Missing code' });
      if (!(await ownsCode(kv, session.user?.email, code))) return res.status(403).json({ error: 'Not owner' });

      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Not found' });

      if (action === 'clear') {
        data.items = [];
        data.count = 0;
      } else {
        const it = data.items.find((x) => x.id === id);
        if (!it) return res.status(404).json({ error: 'Item not found' });
        it.pinned = !!pinned;
      }
      data.updatedAt = Date.now();
      await kv.set(key(code), data, { ex: TTL });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const code = req.query.code || (await kv.get(activeKey(session.user?.email)));
      if (code) { await kv.del(key(code)); await kv.del(activeKey(session.user?.email)); }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
