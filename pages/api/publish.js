// pages/api/publish.js
// GET    → { items:[] }  δημόσιο — φιλτράρει βάσει visitor email
// POST   → { ok }        auth — ορίζει visibility αρχείου
// DELETE → { ok }        auth — αφαιρεί visibility (→ 'none')
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

// KV keys
const pubKey   = (email) => `published:${email}`;   // αρχεία ανά εκπαιδευτικό
const connKey  = (email) => `conn:${email}`;         // συνδέσεις χρήστη

async function sharePublic(drive, fileId) {
  try { await drive.permissions.create({ fileId, requestBody: { role:'reader', type:'anyone' } }); } catch(e) {}
}
async function unsharePublic(drive, fileId) {
  try {
    const p = await drive.permissions.list({ fileId, fields:'permissions(id,type)' });
    const any = p.data.permissions?.find(x => x.type==='anyone');
    if (any) await drive.permissions.delete({ fileId, permissionId: any.id });
  } catch(e) {}
}

function buildItems(reg) {
  return reg.files
    .filter(f => f.visibility && f.visibility !== 'none')
    .map(f => ({
      id: f.id, key: f.id, name: f.name,
      tags: f.tags || [], comment: (f.comment||'').slice(0,300),
      questions: f.questions || '', links: f.links || [],
      folderId: f.folderId, visibility: f.visibility,
    }));
}

// Φιλτράρισμα βάσει επισκέπτη
function filterForVisitor(items, visitorEmail, connections) {
  return items.filter(item => {
    const v = item.visibility;
    if (v === 'public') return true;                          // δημόσιο → όλοι
    if (!visitorEmail) return false;                          // υπόλοιπα χρειάζονται login
    if (v === 'connections') return connections.includes(visitorEmail);
    if (v?.startsWith('user:')) return v === `user:${visitorEmail}`;
    return false;
  });
}

export default async function handler(req, res) {
  const kv = getKV();

  /* ── GET: δημόσιο, φιλτράρει βάσει visitor ── */
  if (req.method === 'GET') {
    const { email: teacherEmail, visitor } = req.query;
    if (!teacherEmail) return res.status(400).json({ error: 'Missing teacher email' });
    try {
      const [items, conns] = await Promise.all([
        kv.get(pubKey(teacherEmail)),
        visitor ? kv.get(connKey(teacherEmail)) : Promise.resolve([]),
      ]);
      const allItems = items || [];
      const teacherConns = conns || [];
      const filtered = filterForVisitor(allItems, visitor || null, teacherConns);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: filtered });
    } catch(e) {
      console.error('[publish GET]', e.message);
      return res.status(200).json({ items: [] });
    }
  }

  /* ── Auth required ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });
  const myEmail = session.user?.email;
  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);

    /* ── POST: ορισμός visibility ── */
    if (req.method === 'POST') {
      const { id, visibility } = req.body || {};
      if (!id || !visibility) return res.status(400).json({ error: 'Missing data' });
      const idx = reg.files.findIndex(f => f.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      reg.files[idx].visibility = visibility;
      reg.files[idx].published = visibility !== 'none';

      // Drive sharing: public & connections → public link · user/connections → public link (για proxy)
      if (visibility !== 'none') await sharePublic(drive, id);
      else await unsharePublic(drive, id);

      await saveRegistry(drive, reg);
      const items = buildItems(reg);
      await kv.set(pubKey(myEmail), items);

      return res.status(200).json({ ok: true, items });
    }

    /* ── DELETE: αφαίρεση visibility ── */
    if (req.method === 'DELETE') {
      const key = req.query.key || req.body?.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const idx = reg.files.findIndex(f => f.id === key);
      if (idx !== -1) {
        reg.files[idx].visibility = 'none';
        reg.files[idx].published = false;
        await unsharePublic(drive, key);
      }
      await saveRegistry(drive, reg);
      const items = buildItems(reg);
      await kv.set(pubKey(myEmail), items);
      return res.status(200).json({ ok: true });
    }

    /* ── GET own: λίστα με visibility για τον εκπαιδευτικό ── */
    if (req.method === 'GET') {
      const items = await kv.get(pubKey(myEmail));
      return res.status(200).json({ items: items || [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('[publish]', e.message);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
