// pages/api/inbox/save.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, fileName, targetFolderId } = req.body;
  if (!fileId || !targetFolderId) return res.status(400).json({ error: 'Missing fileId or targetFolderId' });

  const token = session.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // ── 1. Προσπάθεια απευθείας αντιγραφής ──
  try {
    const copyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/copy?fields=id,name,mimeType`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName || 'Εισερχόμενο', parents: [targetFolderId] }),
      }
    );
    if (copyRes.ok) {
      const doc = await copyRes.json();
      return res.status(200).json({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
    }
    // Αν η αντιγραφή αποτύχει (403/404), δοκιμάζουμε download + re-upload
    console.log(`[inbox/save] copy failed (${copyRes.status}), trying download+reupload…`);
  } catch (e) {
    console.log('[inbox/save] copy error:', e.message);
  }

  // ── 2. Fallback: κατέβασμα περιεχομένου → ανέβασμα ως νέο αρχείο ──
  try {
    // Πρώτα παίρνουμε metadata (mimeType) — δοκιμάζουμε με supportsAllDrives
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`,
      { headers }
    );
    let mimeType = 'application/pdf';
    let origName = fileName || 'Εισερχόμενο';
    if (metaRes.ok) {
      const meta = await metaRes.json();
      mimeType = meta.mimeType || mimeType;
      origName = meta.name || origName;
    }

    // Για Google Workspace αρχεία, κάνουμε export — για τα υπόλοιπα, download
    const isGoogleDoc = mimeType === 'application/vnd.google-apps.document';
    const isGoogleSlides = mimeType === 'application/vnd.google-apps.presentation';
    const isGoogleSheets = mimeType === 'application/vnd.google-apps.spreadsheet';

    let downloadUrl, uploadMime, extension;
    if (isGoogleDoc) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
      uploadMime = 'application/pdf'; extension = '.pdf';
    } else if (isGoogleSlides) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
      uploadMime = 'application/pdf'; extension = '.pdf';
    } else if (isGoogleSheets) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
      uploadMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; extension = '.xlsx';
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      uploadMime = mimeType; extension = '';
    }

    const dlRes = await fetch(downloadUrl, { headers });
    if (!dlRes.ok) {
      return res.status(dlRes.status).json({
        error: `Δεν ήταν δυνατή η πρόσβαση στο αρχείο (${dlRes.status}). Ίσως ο αποστολέας πρέπει να ρυθμίσει τη δημοσιότητα.`
      });
    }

    const fileBuffer = Buffer.from(await dlRes.arrayBuffer());

    // Upload ως νέο αρχείο μέσω multipart upload
    const uploadName = extension && !origName.endsWith(extension) ? origName + extension : origName;
    const boundary = '-------inbox_save_boundary';
    const metadataJson = JSON.stringify({ name: uploadName, parents: [targetFolderId] });

    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${uploadMime}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length.toString(),
        },
        body: multipartBody,
      }
    );

    if (uploadRes.ok) {
      const doc = await uploadRes.json();
      return res.status(200).json({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
    }

    const uploadErr = await uploadRes.json().catch(() => ({}));
    return res.status(uploadRes.status).json({
      error: uploadErr.error?.message || `Upload failed (${uploadRes.status})`
    });
  } catch (e) {
    console.error('[inbox/save] fallback error:', e);
    return res.status(500).json({ error: 'Σφάλμα αποθήκευσης: ' + e.message });
  }
}
