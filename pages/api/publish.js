// pages/api/publish.js
// GET    → { items:[] }  ΔΗΜΟΣΙΟ — χωρίς auth, σερβίρει τα δημοσιευμένα
// POST   → { ok, key }   auth — δημοσίευση
// DELETE → { ok }         auth — αποδημοσίευση
//
// Αποθήκευση: registry (Drive) + δημόσιο manifest αρχείο (Drive, anyone-with-link)
// Ανάγνωση: memory cache → Drive manifest (public) → κενό
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

/* ── server-side cache ── */
let publishedCache = null;
let cacheTime = 0;
let manifestFileId = null;
const CACHE_TTL = 120_000; // 2 min

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
    folderId: f.folderId, type: 'pdf',
  }));
}

/* ── Write manifest to Drive (public JSON) ── */
async function writeManifest(drive, reg, items) {
  const content = JSON.stringify({ items, updatedAt: Date.now() });
  let mid = reg.studentManifestId;
  if (mid) {
    try { await drive.files.update({ fileId: mid, media: { mimeType: 'application/json', body: content } }); return mid; } catch (e) {}
  }
  // Create new
  const created = await drive.files.create({
    requestBody: { name: '__leviathan_student__.json', mimeType: 'application/json' },
    media: { mimeType: 'application/json', body: content },
  });
  mid = created.data.id;
  await sharePublic(drive, mid);
  reg.studentManifestId = mid;
  return mid;
}

/* ── Read manifest from public Drive URL (no auth) ── */
async function readPublicManifest(mid) {
  if (!mid) return null;
  try {
    // Try usercontent URL (most reliable for public files)
    const url = `https://drive.usercontent.google.com/download?id=${mid}&export=download&confirm=t`;
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return null;
    const text = await r.text();
    if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
    // Fallback: older URL
    const r2 = await fetch(`https://drive.google.com/uc?id=${mid}&export=download&confirm=t`, { redirect: 'follow' });
    if (!r2.ok) return null;
    const t2 = await r2.text();
    if (t2.startsWith('{') || t2.startsWith('[')) return JSON.parse(t2);
    return null;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  /* ── GET: δημόσιο ── */
  if (req.method === 'GET') {
    // 1. Fresh cache
    if (publishedCache && Date.now() - cacheTime < CACHE_TTL) {
      return res.status(200).json({ items: publishedCache });
    }

    // 2. Αν υπάρχει session → φόρτωσε από registry
    const session = await getServerSession(req, res, authOptions);
    if (session?.accessToken) {
      try {
        const drive = getDrive(session.accessToken);
        const reg = await loadRegistry(drive);
        publishedCache = buildItems(reg);
        manifestFileId = reg.studentManifestId || null;
        cacheTime = Date.now();
        return res.status(200).json({ items: publishedCache });
      } catch (e) {}
    }

    // 3. Χωρίς session → διάβασε public manifest από Drive
    if (manifestFileId) {
      const data = await readPublicManifest(manifestFileId);
      if (data?.items) {
        publishedCache = data.items;
        cacheTime = Date.now();
        return res.status(200).json({ items: data.items });
      }
    }

    // 4. Last resort: stale cache ή κενό
    return res.status(200).json({ items: publishedCache || [] });
  }

  /* ── Auth required ── */
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });
  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);

    if (req.method === 'POST') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const idx = reg.files.findIndex(f => f.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      reg.files[idx].published = true;
      await sharePublic(drive, id);

      const items = buildItems(reg);
      await writeManifest(drive, reg, items);
      await saveRegistry(drive, reg);

      publishedCache = items;
      manifestFileId = reg.studentManifestId;
      cacheTime = Date.now();

      return res.status(200).json({ ok: true, key: id, items });
    }

    if (req.method === 'DELETE') {
      const key = req.query.key || req.body?.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const idx = reg.files.findIndex(f => f.id === key);
      if (idx !== -1) {
        reg.files[idx].published = false;
        await unsharePublic(drive, key);
      }

      const items = buildItems(reg);
      await writeManifest(drive, reg, items);
      await saveRegistry(drive, reg);

      publishedCache = items;
      cacheTime = Date.now();

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[publish]', e.message);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
