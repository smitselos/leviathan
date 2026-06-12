// pages/api/networks.js
// GET    → { networks }
// POST   → δημιουργία / ενημέρωση δικτύου κειμένων
// DELETE → διαγραφή δικτύου
//
// Τα δίκτυα αποθηκεύονται μέσα στο registry JSON (πεδίο networks[])
// ώστε να μην χρειάζεται ξεχωριστό αρχείο στο Drive.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });

  const drive = getDrive(session.accessToken);

  try {
    const reg = await loadRegistry(drive);
    if (!Array.isArray(reg.networks)) reg.networks = [];

    // ── GET → επιστροφή λίστας δικτύων ────────────────────────────────
    if (req.method === 'GET') {
      return res.status(200).json({ networks: reg.networks });
    }

    // ── POST → δημιουργία ή ενημέρωση ─────────────────────────────────
    if (req.method === 'POST') {
      const net = req.body;
      if (!net?.id) return res.status(400).json({ error: 'Missing network id' });

      const idx = reg.networks.findIndex(n => n.id === net.id);

      const entry = {
        id: net.id,
        name: net.name || 'Χωρίς όνομα',
        folderId: net.folderId || null,
        items: Array.isArray(net.items) ? net.items : [],
        pdfFileId: net.pdfFileId || (idx >= 0 ? reg.networks[idx].pdfFileId : null),
        pdfFilename: net.pdfFilename || (idx >= 0 ? reg.networks[idx].pdfFilename : null),
        driveFileId: net.driveFileId || net.id,
        createdAt: idx >= 0 ? reg.networks[idx].createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      if (idx >= 0) {
        reg.networks[idx] = entry;
      } else {
        reg.networks.unshift(entry);
      }

      await saveRegistry(drive, reg);
      return res.status(200).json({ ok: true, driveFileId: entry.driveFileId });
    }

    // ── DELETE → αφαίρεση δικτύου ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id, driveFileId } = req.body || {};
      const delId = id || driveFileId;
      if (!delId) return res.status(400).json({ error: 'Missing id' });

      // Βρες το δίκτυο πριν το διαγράψεις (για τυχόν cleanup)
      const target = reg.networks.find(n => n.id === delId || n.driveFileId === delId);

      // Αν έχει PDF, διαγραφή και αυτού από το Drive (optional)
      if (target?.pdfFileId) {
        try {
          await drive.files.update({
            fileId: target.pdfFileId,
            requestBody: { trashed: true },
          });
        } catch (e) { /* ignore — μπορεί να μην υπάρχει πια */ }
      }

      reg.networks = reg.networks.filter(n => n.id !== delId && n.driveFileId !== delId);
      await saveRegistry(drive, reg);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[networks]', e.message);
    return res.status(500).json({ error: 'Networks operation failed' });
  }
}
