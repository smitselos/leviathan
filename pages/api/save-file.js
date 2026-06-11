// pages/api/save-file.js — Αποθήκευση εισερχόμενου αρχείου στο Drive μαθητή
// Κατεβάζει μέσω public URL → ανεβάζει στο Drive του μαθητή
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
    // 1. Κατέβασε το αρχείο μέσω public download URL
    const dlUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const dlRes = await fetch(dlUrl, { redirect: 'follow' });
    if (!dlRes.ok) throw new Error('Download failed: ' + dlRes.status);

    const contentType = dlRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await dlRes.arrayBuffer());

    // 2. Βρες τον root φάκελο από το registry
    const reg = await loadRegistry(drive);
    const folders = reg.folders || [];
    const parentId = folders.length > 0 ? folders[0].id : undefined;

    // 3. Ανέβασε στο Drive μαθητή (multipart upload)
    const metadata = {
      name: fileName || 'Αντίγραφο',
      mimeType: contentType,
    };
    if (parentId) metadata.parents = [parentId];

    const boundary = '-----SaveFileBoundary' + Date.now();
    const metaJson = JSON.stringify(metadata);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const upRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!upRes.ok) {
      const errText = await upRes.text();
      throw new Error('Upload failed: ' + errText);
    }

    const uploaded = await upRes.json();

    // 4. Πρόσθεσε στο registry
    if (!reg.files) reg.files = [];
    reg.files.push({
      id: uploaded.id,
      name: uploaded.name,
      mimeType: uploaded.mimeType || contentType,
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

    return res.json({ ok: true, newId: uploaded.id, name: uploaded.name });
  } catch (e) {
    console.error('[save-file]', e.message);
    return res.status(500).json({ error: 'Save failed: ' + e.message });
  }
}
