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

const KV_KEY = (email) => email ? `published:${email}` : 'published_items';

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
  return (reg.files || [])
    .filter(f => f.visibility && f.visibility !== 'none')
    .map(f => ({
      id: f.id, key: f.id, name: f.name,
      tags: f.tags || [], comment: (f.comment || '').slice(0, 300),
      questions: f.questions || '', links: f.links || [],
      folderId: f.folderId, visibility: f.visibility,
    }));
}

function filterForVisitor(items, visitorEmail, connections) {
  return items.filter(item => {
    const v = item.visibility;
    if (v === 'public') return true;
    if (!visitorEmail) return false;
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
        kv.get(KV_KEY(teacherEmail)),
        visitor ? kv.get(`conn:${teacherEmail}`) : Promise.resolve([]),
      ]);
      const filtered = filterForVisitor(items || [], visitor || null, conns || []);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: filtered });
    } catch(e) {
      return res.status(200).json({ items: [] });
    }
  }

  /* ── Auth required για POST/DELETE ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });
  const drive = getDrive(session.accessToken);

  const myEmail = session.user?.email;
  const myName = session.user?.name || myEmail;

  try {
    const reg = await loadRegistry(drive);

    /* ── POST: ορισμός visibility + inbox push ── */
    if (req.method === 'POST') {
      const { id, visibility } = req.body || {};
      if (!id || !visibility) return res.status(400).json({ error: 'Missing data' });
      const idx = reg.files.findIndex(f => f.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      const file = reg.files[idx];
      const prevVisibility = file.visibility || 'none';
      reg.files[idx].visibility = visibility;
      reg.files[idx].published = visibility !== 'none';

      if (visibility !== 'none') await sharePublic(drive, id);
      else await unsharePublic(drive, id);
      await saveRegistry(drive, reg);

      const items = buildItems(reg);
      await Promise.all([
        kv.set(KV_KEY(null), items),
        kv.set(KV_KEY(myEmail), items),
      ]);

      // Push στο inbox των παραληπτών αν άλλαξε το visibility
      if (visibility !== prevVisibility && visibility !== 'none') {
        const inboxEntry = {
          fileId: id, fileName: file.name,
          fromEmail: myEmail, fromName: myName,
          visibility, sentAt: Date.now(), seen: false,
        };
        // Βρες ποιοι πρέπει να ειδοποιηθούν
        const conns = await kv.get(`conn:${myEmail}`) || [];
        let recipients = [];
        if (visibility === 'public') recipients = conns;
        else if (visibility === 'connections') recipients = conns;
        else if (visibility.startsWith('user:')) recipients = [visibility.replace('user:','')];

        await Promise.all(recipients.map(async recipEmail => {
          const inbox = await kv.get(`inbox:${recipEmail}`) || [];
          // Αντικατάστησε αν υπάρχει ήδη το ίδιο αρχείο
          const filtered = inbox.filter(i => i.fileId !== id);
          filtered.push(inboxEntry);
          // Κράτα τα τελευταία 100
          const trimmed = filtered.sort((a,b)=>b.sentAt-a.sentAt).slice(0,100);
          await kv.set(`inbox:${recipEmail}`, trimmed, { ex:60*60*24*90 });
        }));
      }

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
      await Promise.all([
        kv.set(KV_KEY(null), items),
        kv.set(KV_KEY(myEmail), items),
      ]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('[publish]', e.message);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
