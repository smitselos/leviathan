// pages/api/allowed-users.js — Διαχείριση λίστας επιτρεπόμενων χρηστών (KV)
// Πρόσβαση ΜΟΝΟ από τους διαχειριστές (ADMIN_EMAILS ή προεπιλογή).
//
// Χρήση από τον browser (συνδεδεμένος ως διαχειριστής):
//   /api/allowed-users                        → δες τη λίστα
//   /api/allowed-users?add=mathitis1          → προσθήκη (χωρίς @ → @gmail.com)
//   /api/allowed-users?add=a@x.gr,b@y.gr      → προσθήκη πολλών
//   /api/allowed-users?remove=mathitis1       → αφαίρεση
//   /api/allowed-users?clear=1                → άδειασμα λίστας (ελεύθερη είσοδος για όλους)
//
// Κανόνας: ΚΕΝΗ λίστα = ελεύθερη είσοδος. Μη κενή = μπαίνουν μόνο όσοι είναι μέσα
// (συν οι διαχειριστές, που περνούν πάντα).
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

const getKV = () => createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const KEY = 'cloud:allowed_users';

const admins = () => (process.env.ADMIN_EMAILS || 'smitselos@gmail.com')
  .split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

// Ομαλοποίηση όπως στην υπόλοιπη εφαρμογή: πεζά, χωρίς κενά, @gmail.com αν λείπει το @
const norm = (s) => { const v = String(s || '').trim().toLowerCase(); if (!v) return ''; return v.includes('@') ? v : v + '@gmail.com'; };
const parseList = (x) => [].concat(x || []).flatMap((s) => String(s).split(/[\s,;]+/)).map(norm).filter(Boolean);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const me = (session?.user?.email || '').toLowerCase();
  if (!me || !admins().includes(me)) return res.status(403).json({ error: 'Forbidden' });

  const kv = getKV();
  let list = (await kv.get(KEY)) || [];
  if (!Array.isArray(list)) list = [];

  // Παράμετροι είτε από query (GET, για ευκολία από τον browser) είτε από body (POST)
  const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const add = parseList(src.add);
  const remove = new Set(parseList(src.remove));
  const clear = src.clear === '1' || src.clear === true;

  let changed = false;
  if (clear) { list = []; changed = true; }
  if (add.length) { list = [...new Set([...list, ...add])]; changed = true; }
  if (remove.size) { list = list.filter((e) => !remove.has(e)); changed = true; }
  if (changed) await kv.set(KEY, list);

  return res.status(200).json({
    active: list.length > 0,
    count: list.length,
    emails: list.sort(),
    note: list.length ? 'Μπαίνουν ΜΟΝΟ αυτοί (+ διαχειριστές).' : 'Κενή λίστα — ελεύθερη είσοδος για όλους.',
  });
}
