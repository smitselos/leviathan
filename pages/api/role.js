// pages/api/role.js — Αποθήκευση / ανάκτηση ρόλου χρήστη
// Χρησιμοποιεί ΞΕΧΩΡΙΣΤΟ αρχείο leviathan-role.json στο Drive
// ώστε να μην επηρεάζεται από άλλα API (registry κ.λπ.)
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';

const ROLE_FILENAME = 'leviathan-role.json';

async function findRoleFile(token) {
  const q = encodeURIComponent(`name='${ROLE_FILENAME}' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  return d.files?.[0]?.id || null;
}

async function readRoleFile(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

async function createRoleFile(token, data) {
  const metadata = { name: ROLE_FILENAME, mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('media', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  return await r.json();
}

async function updateRoleFile(token, fileId, data) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });
  const token = session.accessToken;

  if (req.method === 'GET') {
    try {
      const fileId = await findRoleFile(token);
      if (!fileId) return res.json({ role: null });
      const data = await readRoleFile(token, fileId);
      return res.json({ role: data?.role || null });
    } catch {
      return res.json({ role: null });
    }
  }

  if (req.method === 'POST') {
    const { role } = req.body || {};
    if (role !== 'teacher' && role !== 'student') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      const fileId = await findRoleFile(token);
      const data = { role, setAt: new Date().toISOString() };
      if (fileId) {
        await updateRoleFile(token, fileId, data);
      } else {
        await createRoleFile(token, data);
      }
      return res.json({ role });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save role: ' + e.message });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
