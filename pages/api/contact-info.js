// pages/api/contact-info.js
// Στοιχεία επικοινωνίας για τις συνδέσεις του χρήστη (όνομα, σχολείο, τηλέφωνο κ.λπ.)
// GET  → { contacts: { email: {firstName,lastName,email,school,roleTitle,phone,note} } }
// POST → { email, info } — αποθήκευση/ενημέρωση ενός contact
// DELETE → { email } — αφαίρεση
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

const KEY = (owner) => `contacts:${owner}`;
const TTL = 60 * 60 * 24 * 365;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  const owner = session.user.email;
  const kv = getKV();

  if (req.method === 'GET') {
    try {
      const contacts = (await kv.get(KEY(owner))) || {};
      return res.status(200).json({ contacts });
    } catch { return res.status(200).json({ contacts: {} }); }
  }

  if (req.method === 'POST') {
    const { email, info } = req.body || {};
    if (!email || !info) return res.status(400).json({ error: 'Missing email or info' });
    try {
      const contacts = (await kv.get(KEY(owner))) || {};
      contacts[email] = {
        firstName: (info.firstName || '').trim(),
        lastName:  (info.lastName  || '').trim(),
        email:     (info.email     || email).trim(),
        school:    (info.school    || '').trim(),
        roleTitle: (info.roleTitle || '').trim(),
        phone:     (info.phone     || '').trim(),
        note:      (info.note      || '').trim(),
      };
      await kv.set(KEY(owner), contacts, { ex: TTL });
      return res.status(200).json({ contacts });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });
    try {
      const contacts = (await kv.get(KEY(owner))) || {};
      delete contacts[email];
      await kv.set(KEY(owner), contacts, { ex: TTL });
      return res.status(200).json({ contacts });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
