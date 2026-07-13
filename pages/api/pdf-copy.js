// pages/api/pdf-copy.js
// Δημιουργία (ή επαναχρήση) PDF αντιγράφου για Office αρχείο ΤΟΥ ΧΡΗΣΤΗ, on-demand.
// Χρησιμοποιείται από το άνοιγμα βιβλιοθήκης σε κινητό: το αντίγραφο μπαίνει στον
// κρυφό φάκελο «Live PDF» και το pdfId αποθηκεύεται στο registry, ώστε τα επόμενα
// ανοίγματα (και η δημοσίευση) να είναι άμεσα.
// POST { id, name } → { pdfId }
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry, ensurePdfCopy, isOfficeFile, isGoogleNative } from '../../lib/drive';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });

  const { id, name, mimeType } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: 'Missing id/name' });
  if (!isOfficeFile(name) && !isGoogleNative(mimeType)) return res.status(400).json({ error: 'Not a convertible file' });

  const drive = getDrive(session.accessToken);
  try {
    const pdfId = await ensurePdfCopy(drive, id, name, mimeType);
    if (!pdfId) return res.status(500).json({ error: 'PDF conversion failed' });

    // Αποθήκευση του pdfId στο registry — την επόμενη φορά το άνοιγμα είναι άμεσο
    try {
      const reg = await loadRegistry(drive);
      const idx = reg.files.findIndex((f) => f.id === id);
      if (idx !== -1 && reg.files[idx].pdfId !== pdfId) {
        reg.files[idx].pdfId = pdfId;
        await saveRegistry(drive, reg);
      }
    } catch {}

    return res.status(200).json({ pdfId });
  } catch (e) {
    console.error('[pdf-copy]', e.message);
    return res.status(500).json({ error: 'PDF conversion failed' });
  }
}
