// pages/api/student-groups.js
// Ομάδες χρηστών του μαθητή — αποθήκευση στον server (KV), συγχρονισμός σε όλες τις συσκευές.
// GET  → { groups: [{ id, name, members:[email] }] }
// POST → { groups:[...] } — αποθήκευση ολόκληρης της λίστας (αντικατάσταση)
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

const KEY = (owner) => `groups:${owner}`;
const TTL = 60 * 60 * 24 * 365;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  const owner = session.user.email;
  const kv = getKV();

  if (req.method === 'GET') {
    try {
      const groups = (await kv.get(KEY(owner))) || [];
      return res.status(200).json({ groups });
    } catch { return res.status(200).json({ groups: [] }); }
  }

  if (req.method === 'POST') {
    const { groups } = req.body || {};
    if (!Array.isArray(groups)) return res.status(400).json({ error: 'Missing groups array' });
    try {
      const clean = groups
        .filter(g => g && g.id && g.name)
        .map(g => ({
          id: String(g.id),
          name: String(g.name).trim().slice(0, 80),
          members: Array.isArray(g.members) ? [...new Set(g.members.filter(Boolean))] : [],
        }));
      await kv.set(KEY(owner), clean, { ex: TTL });
      return res.status(200).json({ groups: clean });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
