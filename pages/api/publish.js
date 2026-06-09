// pages/api/publish.js
// GET    → { items:[] }  ΔΗΜΟΣΙΟ — χωρίς auth, διαβάζει από KV
// POST   → { ok, key }   auth — δημοσίευση
// DELETE → { ok }         auth — αποδημοσίευση
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';
import { createClient } from '@vercel/kv';

/* ── KV client ── */
function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

const KV_KEY = 'published_items';

async function sharePublic(drive, fileId) {
  try { await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch (e) {}
}
async function unsharePublic(drive, fileId) {
  try {
    const p = await drive.permissions.list({ fileId, fields: 'permissions(id,type)' });
    const any = p.data.permissions?.find(x => x.type === 'anyone');
    if (any) await drive.permissions.delete({ fileId, permissionId: any.id });
  } catch (e) {}
}

function buildItems(reg) {
  return (reg.files || []).filter(f => f.published).map(f => ({
    id: f.id, key: f.id, name: f.name,
    tags: f.tags || [], comment: (f.comment || '').slice(0, 300),
    questions: f.questions || '', links: f.links || [],
    folderId: f.folderId,
  }));
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ── GET: δημόσιο, χωρίς auth — διαβάζει από KV ── */
  if (req.method === 'GET') {
    try {
      const items = await kv.get(KV_KEY);
      return res.status(200).json({ items: items || [] });
    } catch (e) {
      console.error('[publish GET]', e.message);
      return res.status(200).json({ items: [] });
    }
  }

  /* ── Auth required για POST/DELETE ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });
  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);

    /* ── POST: δημοσίευση ── */
    if (req.method === 'POST') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const idx = reg.files.findIndex(f => f.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      reg.files[idx].published = true;
      await sharePublic(drive, id);
      await saveRegistry(drive, reg);

      const items = buildItems(reg);
      await kv.set(KV_KEY, items);

      return res.status(200).json({ ok: true, key: id, items });
    }

    /* ── DELETE: αποδημοσίευση ── */
    if (req.method === 'DELETE') {
      const key = req.query.key || req.body?.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const idx = reg.files.findIndex(f => f.id === key);
      if (idx !== -1) {
        reg.files[idx].published = false;
        await unsharePublic(drive, key);
      }
      await saveRegistry(drive, reg);

      const items = buildItems(reg);
      await kv.set(KV_KEY, items);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[publish]', e.message);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
