// pages/api/folders.js
// GET    → { rootId, folders:[{id,name,createdAt}] }
// POST   → δημιουργία φακέλου  body:{ name }            → { folder, folders }
// DELETE → αφαίρεση φακέλου    body:{ id, deleteFromDrive:bool }
//          Αν deleteFromDrive=true: ο φάκελος (και ό,τι περιέχει)
//          μετακινείται στον κάδο του Drive· αλλιώς φεύγει μόνο από τη λίστα.
//          Σε κάθε περίπτωση, τα αρχεία αυτού του φακέλου αφαιρούνται από το μητρώο.

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getDrive, loadRegistry, saveRegistry,
  ensureRootFolder, createFolder, trashDriveFile,
} from '../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });

  const drive = getDrive(session.accessToken);

  try {
    if (req.method === 'GET') {
      const rootId = await ensureRootFolder(drive);
      const reg = await loadRegistry(drive);
      return res.status(200).json({ rootId, folders: reg.folders });
    }

    if (req.method === 'POST') {
      const name = (req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Λείπει το όνομα φακέλου' });

      const rootId = await ensureRootFolder(drive);
      const reg = await loadRegistry(drive);

      // αποφυγή διπλού ονόματος
      if (reg.folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'Υπάρχει ήδη φάκελος με αυτό το όνομα' });
      }

      const folder = await createFolder(drive, name, rootId);
      const entry = { id: folder.id, name: folder.name, createdAt: Date.now() };
      reg.folders.push(entry);
      await saveRegistry(drive, reg);
      return res.status(200).json({ folder: entry, folders: reg.folders, rootId });
    }

    if (req.method === 'DELETE') {
      const { id, deleteFromDrive } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Λείπει το id' });

      const reg = await loadRegistry(drive);
      reg.folders = reg.folders.filter((f) => f.id !== id);
      // τα αρχεία του φακέλου φεύγουν από το μητρώο
      const filesInFolder = reg.files.filter((f) => f.folderId === id);
      reg.files = reg.files.filter((f) => f.folderId !== id);

      if (deleteFromDrive) {
        // ο φάκελος στον κάδο (μαζί παρασύρει το περιεχόμενο)
        try { await trashDriveFile(drive, id); } catch (e) { /* ignore */ }
      }

      await saveRegistry(drive, reg);
      return res.status(200).json({ folders: reg.folders, removedFiles: filesInFolder.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[folders]', e.message);
    return res.status(500).json({ error: 'Folder operation failed' });
  }
}
