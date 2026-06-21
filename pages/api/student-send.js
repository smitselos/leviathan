// pages/api/student-send.js
// Μαθητής ανεβάζει αρχείο και το στέλνει σε επιλεγμένους καθηγητές
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';
import { createClient } from '@vercel/kv';
import formidable from 'formidable';
import fs from 'fs';
import { Readable } from 'stream';

export const config = { api: { bodyParser: false } };

function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.error) return res.status(401).json({ error: session.error });

  const drive = getDrive(session.accessToken);
  const myEmail = session.user?.email;
  const myName = session.user?.name || myEmail;
  const kv = getKV();

  try {
    // Parse form
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    if (!file) return res.status(400).json({ error: 'No file' });

    // Parse recipients (αν υπάρχουν — αλλιώς στέλνει σε όλους)
    let recipients = null;
    const recipientsRaw = fields.recipients?.[0];
    if (recipientsRaw) {
      try { recipients = JSON.parse(recipientsRaw); } catch(e) {}
    }

    // Βρες ή δημιούργησε φάκελο «Αποστολές»
    const reg = await loadRegistry(drive);
    let sendFolderId = (reg.folders || []).find(f => f.name === 'Αποστολές')?.id;
    if (!sendFolderId) {
      const rootId = reg.rootFolderId;
      const folder = await drive.files.create({
        requestBody: { name: 'Αποστολές', mimeType: 'application/vnd.google-apps.folder', parents: rootId ? [rootId] : [] },
        fields: 'id',
      });
      sendFolderId = folder.data.id;
      reg.folders = [...(reg.folders || []), { id: sendFolderId, name: 'Αποστολές' }];
    }

    // Upload αρχείου
    const fileStream = fs.createReadStream(file.filepath);
    const uploaded = await drive.files.create({
      requestBody: { name: file.originalFilename || 'file', parents: [sendFolderId] },
      media: { mimeType: file.mimetype, body: Readable.from(fileStream) },
      fields: 'id,name,mimeType',
    });

    // Κάνε share public ώστε να μπορεί να ανοιχτεί
    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
      fields: 'id',
    });

    // Καταγραφή στο registry
    reg.files = reg.files || [];
    reg.files.push({
      id: uploaded.data.id,
      name: uploaded.data.name,
      mimeType: uploaded.data.mimeType,
      folderId: sendFolderId,
      sent: true,
      sentAt: Date.now(),
    });
    await saveRegistry(drive, reg);

    // Push στο inbox παραληπτών
    const conns = await kv.get(`conn:${myEmail}`) || [];
    // Αν δόθηκαν recipients, φιλτράρουμε — αλλιώς στέλνουμε σε όλους
    const targetEmails = recipients
      ? conns.filter(email => recipients.includes(email))
      : conns;

    const inboxEntry = {
      fileId: uploaded.data.id,
      fileName: uploaded.data.name,
      fromEmail: myEmail,
      fromName: myName,
      sentAt: Date.now(),
      seen: false,
    };

    await Promise.all(targetEmails.map(async recipEmail => {
      const inbox = await kv.get(`inbox:${recipEmail}`) || [];
      inbox.push(inboxEntry);
      const trimmed = inbox.sort((a, b) => b.sentAt - a.sentAt).slice(0, 100);
      await kv.set(`inbox:${recipEmail}`, trimmed, { ex: 60 * 60 * 24 * 90 });
    }));

    return res.status(200).json({ ok: true, name: uploaded.data.name, sentTo: targetEmails.length });
  } catch (e) {
    console.error('[student-send]', e.message);
    return res.status(500).json({ error: 'Send failed: ' + e.message });
  }
}
