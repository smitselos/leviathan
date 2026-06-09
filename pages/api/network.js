// pages/api/network.js
// GET    → { connections:[], pending:[], received:[] }  auth
// POST   → { ok }  στέλνει πρόσκληση  body:{ toEmail }
// PATCH  → { ok }  αποδοχή/απόρριψη  body:{ fromEmail, action:'accept'|'reject' }
// DELETE → { ok }  αποσύνδεση         body:{ email }
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

function connKey(email)    { return `conn:${email}`; }
function inviteKey(email)  { return `invites:${email}`; }   // προσκλήσεις που έλαβε
function sentKey(email)    { return `sent:${email}`; }      // προσκλήσεις που έστειλε
function profileKey(email) { return `profile:${email}`; }

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const me = session.user.email;
  const myName = session.user.name || me;
  const kv = getKV();

  // Αποθήκευσε profile κάθε φορά (όνομα, avatar)
  await kv.set(profileKey(me), { email: me, name: myName, image: session.user.image || null }, { ex: 60*60*24*90 });

  if (req.method === 'GET') {
    try {
      const [conns, received, sent] = await Promise.all([
        kv.get(connKey(me)),
        kv.get(inviteKey(me)),
        kv.get(sentKey(me)),
      ]);
      // Φόρτωσε profiles για connections
      const connList = conns || [];
      const profiles = connList.length
        ? await Promise.all(connList.map(e => kv.get(profileKey(e))))
        : [];
      return res.status(200).json({
        connections: connList.map((e,i) => profiles[i] || { email:e, name:e }),
        received: received || [],
        sent: sent || [],
      });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  if (req.method === 'POST') {
    const { toEmail } = req.body || {};
    if (!toEmail) return res.status(400).json({ error: 'Missing toEmail' });
    if (toEmail === me) return res.status(400).json({ error: 'Cannot invite yourself' });
    try {
      // Ελέγξτε αν ήδη συνδεδεμένοι
      const conns = await kv.get(connKey(me)) || [];
      if (conns.includes(toEmail)) return res.status(400).json({ error: 'Already connected' });

      // Πρόσθεσε στις received του παραλήπτη
      const received = await kv.get(inviteKey(toEmail)) || [];
      if (!received.find(r => r.email === me)) {
        received.push({ email: me, name: myName, image: session.user.image || null, sentAt: Date.now() });
        await kv.set(inviteKey(toEmail), received, { ex: 60*60*24*30 });
      }
      // Πρόσθεσε στις sent του αποστολέα
      const sent = await kv.get(sentKey(me)) || [];
      if (!sent.includes(toEmail)) {
        sent.push(toEmail);
        await kv.set(sentKey(me), sent, { ex: 60*60*24*30 });
      }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  if (req.method === 'PATCH') {
    const { fromEmail, action } = req.body || {};
    if (!fromEmail || !action) return res.status(400).json({ error: 'Missing data' });
    try {
      // Αφαίρεσε από invites
      const received = (await kv.get(inviteKey(me)) || []).filter(r => r.email !== fromEmail);
      await kv.set(inviteKey(me), received, { ex: 60*60*24*30 });
      // Αφαίρεσε από sent του αποστολέα
      const sent = (await kv.get(sentKey(fromEmail)) || []).filter(e => e !== me);
      await kv.set(sentKey(fromEmail), sent, { ex: 60*60*24*30 });

      if (action === 'accept') {
        // Πρόσθεσε αμφίδρομη σύνδεση
        const myConns = [...new Set([...(await kv.get(connKey(me)) || []), fromEmail])];
        const theirConns = [...new Set([...(await kv.get(connKey(fromEmail)) || []), me])];
        await Promise.all([
          kv.set(connKey(me), myConns, { ex: 60*60*24*365 }),
          kv.set(connKey(fromEmail), theirConns, { ex: 60*60*24*365 }),
        ]);
      }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  if (req.method === 'DELETE') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });
    try {
      const myConns = (await kv.get(connKey(me)) || []).filter(e => e !== email);
      const theirConns = (await kv.get(connKey(email)) || []).filter(e => e !== me);
      await Promise.all([
        kv.set(connKey(me), myConns, { ex: 60*60*24*365 }),
        kv.set(connKey(email), theirConns, { ex: 60*60*24*365 }),
      ]);
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
