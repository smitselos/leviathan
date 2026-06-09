// pages/api/live.js
// POST   → { code }      auth — στέλνει αρχείο + συνδέσεις στο live
// GET    → { data }      δημόσιο — ανάγνωση live με κωδικό (?code=XXXX)
// DELETE → { ok }        auth — σταματά το live
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ── GET: δημόσιο — φέρε live data με κωδικό ── */
  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    try {
      const data = await kv.get(`live:${code}`);
      if (!data) return res.status(404).json({ error: 'Not found or expired' });
      return res.status(200).json({ data });
    } catch (e) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  /* ── Auth required ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  /* ── POST: στείλε στο live ── */
  if (req.method === 'POST') {
    const { file, links } = req.body || {};
    if (!file?.id) return res.status(400).json({ error: 'Missing file' });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const liveData = {
      file: { id: file.id, name: file.name, tags: file.tags || [], questions: file.questions || '' },
      links: (links || []).map(l => ({ type: l.type, targetId: l.targetId, url: l.url, name: l.name })),
      teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός',
      createdAt: Date.now(),
    };

    try {
      // Αποθήκευση με TTL 4 ωρών (14400 sec)
      await kv.set(`live:${code}`, liveData, { ex: 14400 });
      // Αποθήκευση τελευταίου κωδικού για τον εκπαιδευτικό
      await kv.set(`live_active:${session.user?.email}`, code, { ex: 14400 });
      return res.status(200).json({ ok: true, code });
    } catch (e) {
      console.error('[live POST]', e.message);
      return res.status(500).json({ error: 'Failed' });
    }
  }

  /* ── DELETE: σταμάτα live ── */
  if (req.method === 'DELETE') {
    try {
      const activeCode = await kv.get(`live_active:${session.user?.email}`);
      if (activeCode) {
        await kv.del(`live:${activeCode}`);
        await kv.del(`live_active:${session.user?.email}`);
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
