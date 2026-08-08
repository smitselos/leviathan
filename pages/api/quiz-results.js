// pages/api/quiz-results.js
// Συλλογή απαντήσεων κουίζ (QR → κινητό παιδιού → εδώ) και συνάθροιση για τη σελίδα αποτελεσμάτων.
//
// POST  ?start        auth    → { code } δημιουργία νέας συνεδρίας κουίζ (ο εκπαιδευτικός)
// POST  (public)              → { ok }   καταγραφή ΜΙΑΣ απάντησης παιδιού  { code, student, qid, qtext, cat, choice, ok, final? }
// GET   ?code=XXXX    public  → { data } συγκεντρωτικά αποτελέσματα (για polling από τη σελίδα results)
// GET   ?active=1     auth    → { code } ενεργή συνεδρία του εκπαιδευτικού (για επαναφορά)
// DELETE ?code=XXXX   auth    → { ok }   λήξη συνεδρίας
//
// Αποθήκευση σε Vercel KV (ίδιο πρότυπο με τα υπόλοιπα API).
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

const TTL = 14400; // 4 ώρες

const getKV = () => createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

const key = (code) => `quiz:${code}`;
const activeKey = (email) => `quiz_active:${email}`;

// Κενή δομή συνεδρίας
function emptySession({ code, teacher, quizName }) {
  return {
    code,
    teacher: teacher || 'Εκπαιδευτικός',
    quizName: quizName || 'Κουίζ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    students: {},   // { studentName: { correct, answered, finished, score } }
    questions: {},  // { qid: { qtext, cat, correct, wrong, choices: { 'Α': n, ... } } }
    totals: { answered: 0, correct: 0 }, // συνολικές καταγεγραμμένες απαντήσεις
  };
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ─────────────── GET ─────────────── */
  if (req.method === 'GET') {
    const { code, active } = req.query;

    // Ενεργή συνεδρία του συνδεδεμένου εκπαιδευτικού
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

    // Δημόσια ανάγνωση αποτελεσμάτων (polling από τη σελίδα results)
    if (!code) return res.status(400).json({ error: 'Missing code' });
    try {
      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ data });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  /* ─────────────── POST ─────────────── */
  if (req.method === 'POST') {
    // (α) Δημιουργία συνεδρίας — απαιτεί σύνδεση εκπαιδευτικού
    if (req.query.start !== undefined) {
      const session = await getServerSession(req, res, authOptions);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { quizName } = req.body || {};
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const s = emptySession({
          code,
          teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός',
          quizName,
        });
        await kv.set(key(code), s, { ex: TTL });
        await kv.set(activeKey(session.user?.email), code, { ex: TTL });
        return res.status(200).json({ ok: true, code });
      } catch (e) {
        console.error('[quiz start]', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    // (β) Καταγραφή απάντησης παιδιού — ΔΗΜΟΣΙΟ (χωρίς login)
    try {
      const { code, student, qid, qtext, cat, choice, ok, final, score, totalQ } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Missing code' });

      const data = await kv.get(key(code));
      if (!data) return res.status(404).json({ error: 'Η συνεδρία έληξε ή δεν υπάρχει' });

      const name = (student || 'Ανώνυμος').toString().slice(0, 40).trim() || 'Ανώνυμος';

      // Εγγραφή μαθητή
      if (!data.students[name]) data.students[name] = { correct: 0, answered: 0, finished: false, score: null };

      // Καταγραφή ΜΙΑΣ απάντησης (αν υπάρχει qid)
      if (qid) {
        const q = data.questions[qid] || (data.questions[qid] = {
          qtext: (qtext || '').toString().slice(0, 300),
          cat: (cat || '').toString().slice(0, 80),
          correct: 0, wrong: 0, choices: {},
        });
        // Ενημέρωση κειμένου/κατηγορίας αν λείπει
        if (!q.qtext && qtext) q.qtext = qtext.toString().slice(0, 300);
        if (!q.cat && cat) q.cat = cat.toString().slice(0, 80);

        if (ok) { q.correct++; data.students[name].correct++; }
        else q.wrong++;

        // Καταγραφή επιλογής (π.χ. 'Α','Β','Γ','Δ','ΝΑΙ','ΟΧΙ' ή '—' για ελεύθερη απάντηση)
        const ch = (choice != null && choice !== '') ? choice.toString().slice(0, 20) : '—';
        q.choices[ch] = (q.choices[ch] || 0) + 1;

        data.students[name].answered++;
        data.totals.answered++;
        if (ok) data.totals.correct++;
      }

      // Τελική επιβεβαίωση με σκορ
      if (final) {
        data.students[name].finished = true;
        if (score != null) data.students[name].score = score;
        if (totalQ != null) data.students[name].totalQ = totalQ;
      }

      data.updatedAt = Date.now();
      await kv.set(key(code), data, { ex: TTL });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[quiz answer]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  /* ─────────────── DELETE ─────────────── */
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
