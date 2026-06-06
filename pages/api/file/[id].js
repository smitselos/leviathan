// pages/api/file/[id].js
// Σερβίρει ένα αρχείο του χρήστη για προβολή μέσα στην εφαρμογή.
// Χρησιμοποιεί το token του συνδεδεμένου χρήστη (drive.file → έχει πρόσβαση
// επειδή το αρχείο το πρόσθεσε/δημιούργησε μέσω της εφαρμογής).

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDrive } from '../../../lib/drive';

const GOOGLE_EXPORT = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.drawing',
];
const OFFICE_TO_GOOGLE = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'application/vnd.google-apps.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'application/vnd.google-apps.spreadsheet',
  'application/msword': 'application/vnd.google-apps.document',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).send('Unauthorized');

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).send('Missing id');

  const drive = getDrive(session.accessToken);

  try {
    const meta = await drive.files.get({ fileId: id, fields: 'name,mimeType' });
    const mimeType = meta.data.mimeType;
    const name = meta.data.name || 'document';
    const baseName = name.replace(/\.[^.]+$/, '');

    // Google native → export PDF
    if (GOOGLE_EXPORT.includes(mimeType)) {
      const exp = await drive.files.export(
        { fileId: id, mimeType: 'application/pdf' },
        { responseType: 'arraybuffer' }
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(exp.data));
    }

    // Office → copy+convert → export PDF → delete temp
    const gMime = OFFICE_TO_GOOGLE[mimeType];
    if (gMime) {
      const copy = await drive.files.copy({
        fileId: id,
        requestBody: { name: '_temp_' + Date.now(), mimeType: gMime },
      });
      try {
        const exp = await drive.files.export(
          { fileId: copy.data.id, mimeType: 'application/pdf' },
          { responseType: 'arraybuffer' }
        );
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.send(Buffer.from(exp.data));
      } finally {
        drive.files.delete({ fileId: copy.data.id }).catch(() => {});
      }
    }

    // HTML
    if (mimeType === 'text/html' || name.endsWith('.html')) {
      const dl = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'text' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(dl.data);
    }

    // Όλα τα υπόλοιπα (PDF, εικόνες) → ως έχουν
    const dl = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(dl.data));
  } catch (err) {
    console.error('[file]', err.message);
    return res.status(500).send('Σφάλμα φόρτωσης αρχείου');
  }
}
