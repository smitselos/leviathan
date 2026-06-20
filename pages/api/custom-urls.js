// pages/api/custom-urls.js
// GET    → { urls: [{name, url}] }
// POST   → { urls } — προσθήκη
// DELETE → { urls } — αφαίρεση
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

const KEY = (email) => `custom_urls:${email}`;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const email = session.user.email;
  const kv = getKV();

  if (req.method === 'GET') {
    try {
      const urls = await kv.get(KEY(email)) || [];
      return res.status(200).json({ urls });
    } catch { return res.status(200).json({ urls: [] }); }
  }

  if (req.method === 'POST') {
    const { name, url } = req.body || {};
    if (!name || !url) return res.status(400).json({ error: 'Missing name or url' });
    try {
      const urls = await kv.get(KEY(email)) || [];
      if (urls.some(u => u.url === url)) return res.status(200).json({ urls });
      urls.push({ name: name.trim(), url: url.trim() });
      await kv.set(KEY(email), urls, { ex: 60 * 60 * 24 * 365 });
      return res.status(200).json({ urls });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });
    try {
      const urls = (await kv.get(KEY(email)) || []).filter(u => u.url !== url);
      await kv.set(KEY(email), urls, { ex: 60 * 60 * 24 * 365 });
      return res.status(200).json({ urls });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
