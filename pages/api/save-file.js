// pages/api/save-file.js — Αποθήκευση εισερχόμενου αρχείου στο Drive μαθητή
// Κατεβάζει μέσω public URL → ανεβάζει στον φάκελο «Λήψεις» του ΛΕΒΙΑΘΑΝ
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

const DOWNLOADS_FOLDER = 'Λήψεις';

async function ensureDownloadsFolder(drive, reg) {
  const folders = reg.folders || [];
  // Ψάξε αν υπάρχει ήδη φάκελος «Λήψεις»
  const existing = folders.find(f => f.name === DOWNLOADS_FOLDER);
  if (existing) return existing.id;

  // Βρες τον root φάκελο ΛΕΒΙΑΘΑΝ (πρώτος στη λίστα)
  const rootId = folders.length > 0 ? folders[0].id : null;

  // Δημιούργησε τον φάκελο στο Drive
  const meta = {
    name: DOWNLOADS_FOLDER,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (rootId) meta.parents = [rootId];

  const created = await drive.files.create({
    requestBody: meta,
    fields: 'id,name',
  });

  // Πρόσθεσε στο registry
  if (!reg.folders) reg.folders = [];
  reg.folders.push({ id: created.data.id, name: DOWNLOADS_FOLDER });

  return created.data.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, fileName, info } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

  const drive = getDrive(session.accessToken);

  try {
    // 1. Κατέβασε μέσω public URL
    const dlUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const dlRes = await fetch(dlUrl, { redirect: 'follow' });
    if (!dlRes.ok) throw new Error('Download failed: ' + dlRes.status);

    const contentType = dlRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await dlRes.arrayBuffer());

    // 2. Βρες/δημιούργησε φάκελο «Λήψεις»
    const reg = await loadRegistry(drive);
    const downloadsFolderId = await ensureDownloadsFolder(drive, reg);

    // 3. Ανέβασε στο Drive μαθητή
    const metadata = {
      name: fileName || 'Αντίγραφο',
      mimeType: contentType,
      parents: [downloadsFolderId],
    };

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
      folderId: downloadsFolderId,
      savedFrom: fileId,
    });
    await saveRegistry(drive, reg);

    return res.json({ ok: true, newId: uploaded.id, name: uploaded.name, folder: DOWNLOADS_FOLDER });
  } catch (e) {
    console.error('[save-file]', e.message);
    return res.status(500).json({ error: 'Save failed: ' + e.message });
  }
}
