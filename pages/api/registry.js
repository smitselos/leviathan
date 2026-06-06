// pages/api/registry.js
// GET    → λίστα αρχείων του χρήστη (από το μητρώο στο Drive του)
// POST   → προσθήκη αρχείου/-ων στο μητρώο  body: { files:[{id,name,category,mimeType}] }
// DELETE → αφαίρεση από το μητρώο (ΔΕΝ διαγράφει το αρχείο από το Drive) body: { id }

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';

const CATEGORIES = ['keimena', 'biblia', 'diktya'];

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });

  const drive = getDrive(session.accessToken);

  try {
    if (req.method === 'GET') {
      const reg = await loadRegistry(drive);
      return res.status(200).json({ files: reg.files });
    }

    if (req.method === 'POST') {
      const incoming = Array.isArray(req.body?.files) ? req.body.files : [];
      if (!incoming.length)
        return res.status(400).json({ error: 'No files provided' });

      const reg = await loadRegistry(drive);
      const byId = new Map(reg.files.map((f) => [f.id, f]));

      for (const f of incoming) {
        if (!f.id || !f.name) continue;
        const category = CATEGORIES.includes(f.category) ? f.category : 'keimena';
        byId.set(f.id, {
          id: f.id,
          name: f.name,
          category,
          mimeType: f.mimeType || null,
          addedAt: byId.get(f.id)?.addedAt || Date.now(),
        });
      }

      reg.files = Array.from(byId.values());
      await saveRegistry(drive, reg);
      return res.status(200).json({ files: reg.files });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const reg = await loadRegistry(drive);
      reg.files = reg.files.filter((f) => f.id !== id);
      await saveRegistry(drive, reg);
      return res.status(200).json({ files: reg.files });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[registry]', e.message);
    return res.status(500).json({ error: 'Registry operation failed' });
  }
}
