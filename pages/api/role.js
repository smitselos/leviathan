// pages/api/role.js — Αποθήκευση / ανάκτηση ρόλου χρήστη
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { getRegistry, saveRegistry } from '../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const token = session.accessToken;

  if (req.method === 'GET') {
    try {
      const reg = await getRegistry(token);
      return res.json({ role: reg.userRole || null, email: session.user?.email || null });
    } catch {
      return res.json({ role: null });
    }
  }

  if (req.method === 'POST') {
    const { role } = req.body || {};
    if (role !== 'teacher' && role !== 'student') {
      return res.status(400).json({ error: 'Invalid role. Must be "teacher" or "student".' });
    }
    try {
      const reg = await getRegistry(token);
      reg.userRole = role;
      await saveRegistry(token, reg);
      return res.json({ role });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save role: ' + e.message });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
