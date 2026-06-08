// pages/api/publish.js
// POST  → { id, publish:bool }  δημοσίευση/απόσυρση αρχείου
// GET   → { studentUrl }        επιστρέφει τον σύνδεσμο student
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

/* ── helpers ── */
async function findManifest(drive) {
  const q = "name='__leviathan_student__.json' and trashed=false";
  const r = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
  return r.data.files?.[0]?.id || null;
}

async function writeManifest(drive, manifestId, content) {
  const body = JSON.stringify(content);
  if (manifestId) {
    await drive.files.update({ fileId: manifestId, media: { mimeType: 'application/json', body } });
    return manifestId;
  }
  const created = await drive.files.create({
    requestBody: { name: '__leviathan_student__.json', mimeType: 'application/json' },
    media: { mimeType: 'application/json', body },
  });
  const newId = created.data.id;
  // κάνε public
  await drive.permissions.create({ fileId: newId, requestBody: { role: 'reader', type: 'anyone' } });
  return newId;
}

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

/* ── handler ── */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });
  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);

    /* GET → studentUrl */
    if (req.method === 'GET') {
      const mid = reg.studentManifestId || (await findManifest(drive));
      return res.status(200).json({ studentUrl: mid ? `/student?m=${mid}` : null, manifestId: mid });
    }

    /* POST → toggle publish */
    if (req.method === 'POST') {
      const { id, publish } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const idx = reg.files.findIndex(f => f.id === id);
      if (idx === -1) return res.status(404).json({ error: 'File not found' });

      reg.files[idx].published = !!publish;

      // Drive sharing
      if (publish) await sharePublic(drive, id);
      else await unsharePublic(drive, id);

      // Rebuild manifest
      const pubFiles = reg.files.filter(f => f.published).map(f => ({
        id: f.id, name: f.name, tags: f.tags || [],
        comment: (f.comment || '').slice(0, 300),
        questions: f.questions || '',
        links: f.links || [],
        folderId: f.folderId,
      }));
      const manifest = { files: pubFiles, folders: reg.folders, updatedAt: Date.now() };

      let mid = reg.studentManifestId || (await findManifest(drive));
      mid = await writeManifest(drive, mid, manifest);
      if (!reg.studentManifestId) { reg.studentManifestId = mid; }

      await saveRegistry(drive, reg);

      return res.status(200).json({
        ok: true,
        published: !!publish,
        studentUrl: `/student?m=${mid}`,
        files: reg.files,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[publish]', e.message);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
