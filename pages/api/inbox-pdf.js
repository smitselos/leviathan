// pages/api/inbox-pdf.js
// Μετατρέπει εισερχόμενο Office αρχείο (docx/pptx/xlsx) σε PDF και το σερβίρει inline.
// Λειτουργεί για αρχεία ΑΛΛΟΥ χρήστη (shared anyone:reader) επειδή:
//   1. Κατεβάζει τα bytes μέσω public download URL (δεν χρειάζεται Drive API access στο πρωτότυπο)
//   2. Τα ανεβάζει ως προσωρινό Google Doc στο Drive ΤΟΥ συνδεδεμένου χρήστη (με μετατροπή)
//   3. Κάνει export PDF και διαγράφει το προσωρινό
// Απαιτεί session (μαθητής ή εκπαιδευτικός). Για PublicView χωρίς auth → δεν χρησιμοποιείται.
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

// Office mime/extension → Google native (για μετατροπή κατά το upload)
const EXT_TO_GOOGLE = {
  docx: 'application/vnd.google-apps.document',
  doc:  'application/vnd.google-apps.document',
  pptx: 'application/vnd.google-apps.presentation',
  ppt:  'application/vnd.google-apps.presentation',
  xlsx: 'application/vnd.google-apps.spreadsheet',
  xls:  'application/vnd.google-apps.spreadsheet',
};
const OFFICE_CT = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt:  'application/vnd.ms-powerpoint',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).send('Unauthorized');

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const name = (Array.isArray(req.query.name) ? req.query.name[0] : req.query.name) || 'document';
  if (!id) return res.status(400).send('Missing id');

  const token = session.accessToken;
  const baseName = name.replace(/\.[^.]+$/, '');
  const ext = (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const gMime = EXT_TO_GOOGLE[ext];

  // Αν δεν είναι Office → δεν μετατρέπουμε εδώ (ο client στέλνει μόνο Office)
  if (!gMime) return res.status(400).send('Not an Office file');

  let tempId = null;
  try {
    // 1. Κατέβασε τα bytes μέσω public download URL
    const dlUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(id)}`;
    const dlRes = await fetch(dlUrl, { redirect: 'follow' });
    if (!dlRes.ok) return res.status(404).send('Το αρχείο δεν βρέθηκε ή δεν είναι δημόσιο');
    const buffer = Buffer.from(await dlRes.arrayBuffer());

    // Αν κατέβηκε HTML (σελίδα confirm) αντί για το αρχείο → αποτυχία
    if (buffer.slice(0, 50).toString().toLowerCase().includes('<!doctype') ||
        buffer.slice(0, 50).toString().toLowerCase().includes('<html')) {
      return res.status(502).send('Δεν ήταν δυνατή η λήψη του αρχείου');
    }

    // 2. Ανέβασέ το ως προσωρινό Google Doc (με μετατροπή) στο Drive του χρήστη
    const uploadCT = OFFICE_CT[ext] || 'application/octet-stream';
    const metadata = { name: '_temp_pdf_' + Date.now(), mimeType: gMime };
    const boundary = '-----InboxPdfBoundary' + Date.now();
    const uploadBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${uploadCT}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const upRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: uploadBody,
    });
    if (!upRes.ok) throw new Error('Upload failed: ' + (await upRes.text()));
    tempId = (await upRes.json()).id;

    // 3. Export PDF
    const expRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${tempId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!expRes.ok) throw new Error('Export failed: ' + (await expRes.text()));
    const pdfBuffer = Buffer.from(await expRes.arrayBuffer());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdfBuffer);
  } catch (e) {
    console.error('[inbox-pdf]', e.message);
    return res.status(500).send('Σφάλμα μετατροπής αρχείου');
  } finally {
    // 4. Διέγραψε το προσωρινό
    if (tempId) {
      fetch(`https://www.googleapis.com/drive/v3/files/${tempId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => {});
    }
  }
}
