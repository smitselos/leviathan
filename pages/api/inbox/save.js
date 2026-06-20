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
  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── 1. Απευθείας copy (αν ο χρήστης έχει API access) ──
  try {
    const copyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/copy?fields=id,name,mimeType&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName || 'Εισερχόμενο', parents: [targetFolderId] }),
      }
    );
    if (copyRes.ok) {
      const doc = await copyRes.json();
      return res.status(200).json({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
    }
    console.log(`[inbox/save] copy failed (${copyRes.status}), trying public download…`);
  } catch (e) {
    console.log('[inbox/save] copy error:', e.message);
  }

  // ── 2. Εύρεση mimeType μέσω OAuth (metadata μόνο — μπορεί να αποτύχει) ──
  let mimeType = '';
  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`,
      { headers: authHeaders }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      mimeType = meta.mimeType || '';
    }
  } catch {}

  // ── 3. Δημόσιο download χωρίς auth/key (web URLs) ──
  // Τα αρχεία inbox είναι ήδη "anyone with link" (sharePublic στο publish.js)
  try {
    const isGDoc    = mimeType === 'application/vnd.google-apps.document';
    const isGSlides = mimeType === 'application/vnd.google-apps.presentation';
    const isGSheets = mimeType === 'application/vnd.google-apps.spreadsheet';

    let downloadUrl, uploadMime, ext;
    if (isGDoc) {
      downloadUrl = `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
      uploadMime = 'application/pdf'; ext = '.pdf';
    } else if (isGSlides) {
      downloadUrl = `https://docs.google.com/presentation/d/${fileId}/export?format=pdf`;
      uploadMime = 'application/pdf'; ext = '.pdf';
    } else if (isGSheets) {
      downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
      uploadMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; ext = '.xlsx';
    } else {
      // Binary (PDF, DOCX, PPTX κλπ.) — confirm=t παρακάμπτει virus-scan warning
      downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t`;
      uploadMime = mimeType || 'application/pdf'; ext = '';
    }

    const dlRes = await fetch(downloadUrl, { redirect: 'follow' });
    if (!dlRes.ok) {
      return res.status(dlRes.status).json({
        error: `Αποτυχία λήψης αρχείου (${dlRes.status}). Ο αποστολέας πρέπει να το δημοσιεύσει ξανά.`
      });
    }

    // Έλεγχος ότι πήραμε πραγματικό αρχείο, όχι HTML σελίδα
    const contentType = dlRes.headers.get('content-type') || '';
    if (contentType.includes('text/html') && !mimeType.includes('html')) {
      return res.status(403).json({
        error: 'Το αρχείο δεν είναι δημόσια προσβάσιμο. Ο αποστολέας πρέπει να το δημοσιεύσει ξανά.'
      });
    }

    const fileBuffer = Buffer.from(await dlRes.arrayBuffer());
    const origName = fileName || 'Εισερχόμενο';
    const uploadName = ext && !origName.endsWith(ext) ? origName + ext : origName;

    // Upload στον φάκελο του παραλήπτη (OAuth — drive.file scope επιτρέπει upload)
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
          ...authHeaders,
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
