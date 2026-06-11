// pages/api/save-file.js — Αποθήκευση εισερχόμενου αρχείου στο Drive μαθητή
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry, ensureRoot } from '../../lib/drive';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, fileName, info } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

  const drive = getDrive(session.accessToken);

  try {
    // Βρες ή φτιάξε τον root φάκελο ΛΕΒΙΑΘΑΝ
    const rootId = await ensureRoot(drive);

    // Αντιγραφή αρχείου στο Drive του μαθητή
    const copy = await drive.files.copy({
      fileId,
      requestBody: {
        name: fileName || 'Αντίγραφο',
        parents: [rootId],
      },
      fields: 'id,name,mimeType',
    });

    // Πρόσθεσε στο registry του μαθητή
    const reg = await loadRegistry(drive);
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
      savedFrom: fileId, // αναφορά στο πρωτότυπο
    });
    await saveRegistry(drive, reg);

    return res.json({ ok: true, newId: copy.data.id, name: copy.data.name });
  } catch (e) {
    console.error('[save-file]', e.message);
    return res.status(500).json({ error: 'Save failed: ' + e.message });
  }
}
