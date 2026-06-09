// pages/api/live.js
// POST   → { code }      auth — στέλνει αρχείο + συνδέσεις στο live
// GET    → { data }      δημόσιο — ανάγνωση live (?code=XXXX)
// DELETE → { ok }        auth — σταματά live
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive } from '../../lib/drive';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

async function sharePublic(drive, fileId) {
  try { await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch (e) {}
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ── GET: δημόσιο ── */
  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    try {
      const data = await kv.get(`live:${code}`);
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  /* ── Auth required ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { file, links } = req.body || {};
    if (!file?.id) return res.status(400).json({ error: 'Missing file' });

    const drive = getDrive(session.accessToken);
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // Share main file + all linked files publicly
    await sharePublic(drive, file.id);
    for (const l of (links || [])) {
      if (l.targetId) await sharePublic(drive, l.targetId);
    }

    const fileSrc = (id, name) => `/api/student-file?id=${id}`;

    const liveData = {
      title: file.name,
      src: fileSrc(file.id, file.name),
      fileId: file.id,
      tags: file.tags || [],
      questions: file.questions || '',
      links: (links || []).map(l => ({
        type: l.type, targetId: l.targetId, url: l.url, name: l.name,
        src: l.type === 'url' ? l.url : fileSrc(l.targetId, l.name),
        isHtml: l.type !== 'url' && isHtml(l.name),
      })),
      teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός',
      updatedAt: Date.now(),
    };

    await kv.set(`live:${code}`, liveData, { ex: 14400 });
    await kv.set(`live_active:${session.user?.email}`, code, { ex: 14400 });

    return res.status(200).json({ ok: true, code });
  }

  if (req.method === 'DELETE') {
    try {
      const activeCode = await kv.get(`live_active:${session.user?.email}`);
      if (activeCode) { await kv.del(`live:${activeCode}`); await kv.del(`live_active:${session.user?.email}`); }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
