// pages/api/save-file.js — Αποθήκευση εισερχόμενου αρχείου στο Drive μαθητή
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, fileName, info } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);

    // Βρες τον πρώτο φάκελο στο registry (root folder)
    const folders = reg.folders || [];
    const parentId = folders.length > 0 ? folders[0].id : undefined;

    // Αντιγραφή αρχείου στο Drive του μαθητή
    const copyReq = { name: fileName || 'Αντίγραφο' };
    if (parentId) copyReq.parents = [parentId];

    const copy = await drive.files.copy({
      fileId,
      requestBody: copyReq,
      fields: 'id,name,mimeType',
    });

    // Πρόσθεσε στο registry
    if (!reg.files) reg.files = [];
    reg.files.push({
      id: copy.data.id,
      name: copy.data.name,
      mimeType: copy.data.mimeType || '',
      info: info || '',
      comment: '',
      tags: [],
      questions: '',
      links: [],
      fav: false,
      openCount: 0,
      addedAt: new Date().toISOString(),
      folderId: parentId || null,
      savedFrom: fileId,
    });
    await saveRegistry(drive, reg);

    return res.json({ ok: true, newId: copy.data.id, name: copy.data.name });
  } catch (e) {
    console.error('[save-file]', e.message);
    return res.status(500).json({ error: 'Save failed: ' + e.message });
  }
}
