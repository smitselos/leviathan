// pages/api/live-cloud.js
// Νέφος λέξεων (word cloud) — ίδιο πρότυπο με quiz-results.js.
//
// POST ?start        auth    → { code }  δημιουργία { prompt }
// POST (public)              → { ok }    υποβολή λέξης/φράσης { code, text }
// GET  ?code=XXXX    public  → { data }  συγκεντρωτικά (polling προβολής)
// GET  ?active=1     auth    → { code, data }
// GET  ?teacher=...  public  → { code, data }  για /class
// DELETE ?code=XXXX  auth    → { ok }
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

const TTL = 14400;
const getKV = () => createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const key = (code) => `cloud:${code}`;
const activeKey = (email) => `cloud_active:${email}`;

const MAX_LEN = 40;    // μέγιστο μήκος όρου (χαρακτήρες)
const MAX_TERMS = 300; // μέγιστο πλήθος διακριτών όρων ανά συνεδρία

// Κανονικοποίηση ελληνικών: πεζά, χωρίς τόνους, τελικό ς→σ, σύμπτυξη κενών.
// Ώστε «Χρόνος», «χρόνος», «χρονος» να μετρώνται ως ΕΝΑΣ όρος.
function normGreek(s) {
  return (s || '')
    .toString()
    .normalize('NFD')                 // διαχώρισε τόνους
    .replace(/[\u0300-\u036f]/g, '')  // αφαίρεσε διακριτικά
    .toLowerCase()
    .replace(/ς/g, 'σ')               // τελικό σίγμα → σίγμα
    .replace(/\s+/g, ' ')
    .trim();
}

function emptySession({ code, teacher, prompt }) {
  return {
    code,
    teacher: teacher || 'Εκπαιδευτικός',
    prompt: (prompt || 'Νέφος λέξεων').toString().slice(0, 240),
    terms: {},   // { normalized: { count, raw } }
    total: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
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

    // Υποβολή όρου — ΔΗΜΟΣΙΟ
    try {
      const { code, text } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Missing code' });
      const raw = (text || '').toString().replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      const norm = normGreek(raw);
      if (!norm) return res.status(200).json({ ok: true, ignored: true });

      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Το νέφος έληξε ή δεν υπάρχει' });

      if (data.terms[norm]) {
        data.terms[norm].count++;
      } else {
        if (Object.keys(data.terms).length >= MAX_TERMS) {
          return res.status(200).json({ ok: true, capped: true }); // όριο διακριτών όρων
        }
        data.terms[norm] = { count: 1, raw }; // κράτα την πρώτη raw μορφή για εμφάνιση
      }
      data.total++;
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
