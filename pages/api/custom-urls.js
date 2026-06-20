// pages/api/custom-urls.js
// GET    → { urls: [{name, url}] }  — αν δεν υπάρχει λίστα, επιστρέφει τις προεπιλογές
// POST   → { urls } — προσθήκη
// DELETE → { urls } — αφαίρεση (οποιουδήποτε, και default)
// PUT    → { urls } — επαναφορά στις προεπιλογές
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

const KEY = (email) => `custom_urls:${email}`;
const TTL = 60 * 60 * 24 * 365;

const DEFAULTS = [
  { name:'YouTube', url:'https://www.youtube.com' },
  { name:'Wikipedia', url:'https://el.wikipedia.org' },
  { name:'Λεξικό Τριανταφυλλίδη (Ηλεκτρονικό)', url:'http://www.greek-language.gr/greekLang/modern_greek/tools/lexica/triantafyllides/' },
  { name:'Χρηστικό λεξικό – Ακαδημία Αθηνών', url:'https://www.lexikon.academyofathens.gr' },
  { name:'Ψηφιακό φροντιστήριο', url:'https://dschool.edu.gr' },
  { name:'Study4exams', url:'https://www.study4exams.gr' },
  { name:'ΕΡΤ', url:'https://www.ert.gr' },
  { name:'Πύλη για την Ελληνική Γλώσσα', url:'http://www.greek-language.gr' },
  { name:'Φωτόδεντρο', url:'http://photodentro.edu.gr' },
  { name:'Μελίσπη – Ψηφιακή Βιβλιοθήκη', url:'https://melispe.gr' },
];

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const email = session.user.email;
  const kv = getKV();

  // Φόρτωση — αν δεν υπάρχει στο KV, seed με defaults
  const getUrls = async () => {
    let urls = await kv.get(KEY(email));
    if (!urls) { urls = [...DEFAULTS]; await kv.set(KEY(email), urls, { ex: TTL }); }
    return urls;
  };

  if (req.method === 'GET') {
    try { return res.status(200).json({ urls: await getUrls() }); }
    catch { return res.status(200).json({ urls: DEFAULTS }); }
  }

  if (req.method === 'POST') {
    const { name, url } = req.body || {};
    if (!name || !url) return res.status(400).json({ error: 'Missing name or url' });
    try {
      const urls = await getUrls();
      if (urls.some(u => u.url === url)) return res.status(200).json({ urls });
      urls.push({ name: name.trim(), url: url.trim() });
      await kv.set(KEY(email), urls, { ex: TTL });
      return res.status(200).json({ urls });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });
    try {
      const urls = (await getUrls()).filter(u => u.url !== url);
      await kv.set(KEY(email), urls, { ex: TTL });
      return res.status(200).json({ urls });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT → επαναφορά defaults
  if (req.method === 'PUT') {
    try {
      await kv.set(KEY(email), [...DEFAULTS], { ex: TTL });
      return res.status(200).json({ urls: DEFAULTS });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
