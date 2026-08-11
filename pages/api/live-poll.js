// pages/api/live-poll.js
// Γρήγορη ψηφοφορία (live poll) — ίδιο πρότυπο με quiz-results.js.
//
// POST ?start        auth    → { code }  δημιουργία ψηφοφορίας { question, options:[] }
// POST (public)              → { ok }    ψήφος μαθητή { code, studentKey, optionId }
// GET  ?code=XXXX    public  → { data }  συγκεντρωτικά (polling προβολής)
// GET  ?active=1     auth    → { code, data } ενεργή ψηφοφορία του εκπαιδευτικού
// GET  ?teacher=...  public  → { code, data } ενεργή ψηφοφορία για τη σελίδα /class
// DELETE ?code=XXXX  auth    → { ok }    λήξη
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

const TTL = 14400; // 4 ώρες
const getKV = () => createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const key = (code) => `poll:${code}`;
const activeKey = (email) => `poll_active:${email}`;

function emptySession({ code, teacher, question, options }) {
  const opts = (options || [])
    .map((o, i) => ({ id: 'o' + (i + 1), label: String(o).slice(0, 120).trim() }))
    .filter((o) => o.label)
    .slice(0, 8);
  const tally = {};
  opts.forEach((o) => { tally[o.id] = 0; });
  return {
    code,
    teacher: teacher || 'Εκπαιδευτικός',
    question: (question || 'Ψηφοφορία').toString().slice(0, 240),
    options: opts,
    tally,               // { optionId: count }
    voters: {},          // { studentKey: optionId }  — μία ψήφος ανά μαθητή
    totalVotes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ─────────── GET ─────────── */
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

  /* ─────────── POST ─────────── */
  if (req.method === 'POST') {
    // (α) Έναρξη — απαιτεί σύνδεση
    if (req.query.start !== undefined) {
      const session = await getServerSession(req, res, authOptions);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { question, options } = req.body || {};
        if (!Array.isArray(options) || options.filter(Boolean).length < 2) {
          return res.status(400).json({ error: 'Χρειάζονται τουλάχιστον 2 επιλογές' });
        }
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const s = emptySession({
          code, question, options,
          teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός',
        });
        await kv.set(key(code), s, { ex: TTL });
        await kv.set(activeKey(session.user?.email), code, { ex: TTL });
        return res.status(200).json({ ok: true, code });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    // (β) Ψήφος μαθητή — ΔΗΜΟΣΙΟ
    try {
      const { code, studentKey, optionId } = req.body || {};
      if (!code || !optionId) return res.status(400).json({ error: 'Missing fields' });
      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Η ψηφοφορία έληξε ή δεν υπάρχει' });
      if (!(optionId in data.tally)) return res.status(400).json({ error: 'Άγνωστη επιλογή' });

      const voter = (studentKey || 'anon-' + Math.random().toString(36).slice(2)).toString().slice(0, 60);

      // ΜΙΑ ψήφος ανά μαθητή: αν έχει ήδη ψηφίσει, αγνοείται κάθε νέα ψήφος.
      if (voter in data.voters) {
        return res.status(200).json({ ok: true, locked: true, already: data.voters[voter] });
      }

      data.totalVotes++;
      data.tally[optionId]++;
      data.voters[voter] = optionId;
      data.updatedAt = Date.now();
      await kv.set(key(code), data, { ex: TTL });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  /* ─────────── DELETE ─────────── */
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
