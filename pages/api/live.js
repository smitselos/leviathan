// pages/api/live.js
// POST   → { code }      auth — στέλνει αρχείο + συνδέσεις στο live
// GET    → { data }      δημόσιο — ανάγνωση live (?code=XXXX)
// DELETE → { ok }        auth — σταματά live
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, ensurePdfCopy, isOfficeFile } from '../../lib/drive';
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
    let { file, links, items, title } = req.body || {};

    // Νέο format: items[] (ενιαία λίστα στοιχείων). Το πρώτο γίνεται «κύριο».
    // items: [{ kind:'file'|'app'|'url', id?, name, url? }]
    if (Array.isArray(items) && items.length) {
      const first = items[0];
      const rest = items.slice(1);
      if (first.kind === 'url') {
        file = { id: null, name: first.name || title || 'Σύνδεσμος', _url: first.url, tags: [], questions: '' };
      } else {
        file = { id: first.id, name: first.name, tags: [], questions: '' };
      }
      links = rest.map(it => it.kind === 'url'
        ? { type: 'url', url: it.url, name: it.name || it.url }
        : { type: 'file', targetId: it.id, name: it.name });
    }

    if (!file || (!file.id && !file._url)) return res.status(400).json({ error: 'Missing file or url' });

    try {
      const drive = getDrive(session.accessToken);
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      // Εξαγωγή Drive ID από URLs τύπου student-file?id=XXX ή /api/file/XXX (ΛΕΒΙΑΘΑΝ links)
      const idFromUrl = (u) => {
        if (!u) return null;
        const m1 = u.match(/[?&]id=([^&#]+)/);        // student-file?id=XXX
        if (m1) return decodeURIComponent(m1[1]);
        const m2 = u.match(/\/api\/file\/([^?#/]+)/);  // /api/file/XXX
        if (m2) return decodeURIComponent(m2[1]);
        return null;
      };

      // Share: κύριο αρχείο + linked files + Drive IDs κρυμμένα μέσα σε URLs (κύριο + links)
      const urlIds = [
        idFromUrl(file._url),
        ...(links||[]).filter(l=>l.type==='url').map(l=>idFromUrl(l.url)),
      ].filter(Boolean);
      const fileIds = [
        file.id,
        ...(links||[]).filter(l=>l.targetId).map(l=>l.targetId),
        ...urlIds,
      ].filter(Boolean);
      await Promise.allSettled([...new Set(fileIds)].map(id => sharePublic(drive, id)));

      // Office → PDF copy preview · HTML → student-file · PDF/εικόνες → Drive preview
      const resolveSrc = async (id, name) => {
        if (/\.html?$/i.test(name||'')) return `/api/student-file?id=${id}`;
        if (isOfficeFile(name)) {
          const pdfId = await ensurePdfCopy(drive, id, name);
          if (pdfId) return `https://drive.google.com/file/d/${pdfId}/preview`;
        }
        return `https://drive.google.com/file/d/${id}/preview`;
      };

      // Κύριο: αν είναι URL → χρησιμοποίησέ το ως έχει· αλλιώς resolve το αρχείο
      const mainSrc = file._url ? file._url : await resolveSrc(file.id, file.name);
      const resolvedLinks = await Promise.all((links || []).map(async l => ({
        type: l.type, targetId: l.targetId, url: l.url, name: l.name,
        src: l.type === 'url' ? l.url : await resolveSrc(l.targetId, l.name),
      })));

      const liveData = {
        title: file.name,
        src: mainSrc,
        fileId: file.id || null,
        isUrl: !!file._url,
        tags: file.tags || [],
        questions: file.questions || '',
        links: resolvedLinks,
        teacher: session.user?.name || session.user?.email || 'Εκπαιδευτικός',
        updatedAt: Date.now(),
      };

      await kv.set(`live:${code}`, liveData, { ex: 14400 });
      await kv.set(`live_active:${session.user?.email}`, code, { ex: 14400 });

      return res.status(200).json({ ok: true, code });
    } catch (e) {
      console.error('[live POST]', e.message);
      return res.status(500).json({ error: e.message });
    }
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
