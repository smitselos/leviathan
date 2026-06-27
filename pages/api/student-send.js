// pages/api/student-send.js — Ο μαθητής ανεβάζει αρχείο & ειδοποιεί τις συνδέσεις του
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../lib/drive';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

const SENT_FOLDER = 'Αποστολές';

async function ensureSentFolder(drive, reg) {
  const folders = reg.folders || [];
  const existing = folders.find(f => f.name === SENT_FOLDER);
  if (existing) return existing.id;
  const rootId = folders.length > 0 ? folders[0].id : null;
  const meta = { name: SENT_FOLDER, mimeType: 'application/vnd.google-apps.folder' };
  if (rootId) meta.parents = [rootId];
  const created = await drive.files.create({ requestBody: meta, fields: 'id,name' });
  if (!reg.folders) reg.folders = [];
  reg.folders.push({ id: created.data.id, name: SENT_FOLDER });
  return created.data.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const drive = getDrive(session.accessToken);
  const myEmail = session.user?.email;
  const myName = session.user?.name || myEmail;
  const kv = getKV();

  try {
    // Πάρε το αρχείο από το multipart form
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    // Parse multipart με buffer
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', c => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const body = Buffer.concat(chunks);

    // Βρες boundary
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary' });
    const boundary = boundaryMatch[1];

    // Parse parts
    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    if (!filePart) return res.status(400).json({ error: 'No file' });

    // Parse recipients αν υπάρχει (JSON array με emails)
    const recipientsPart = parts.find(p => p.name === 'recipients' && !p.filename);
    let selectedRecipients = null;
    if (recipientsPart) {
      try { selectedRecipients = JSON.parse(recipientsPart.data.toString()); } catch(e) {}
    }

    const fileName = filePart.filename;
    const fileMime = filePart.contentType || 'application/octet-stream';
    const fileData = filePart.data;

    // 1. Βρες/δημιούργησε φάκελο Αποστολές
    const reg = await loadRegistry(drive);
    const folderId = await ensureSentFolder(drive, reg);

    // 2. Ανέβασε στο Drive μαθητή
    const uploadBoundary = '-----UploadBoundary' + Date.now();
    const metadata = JSON.stringify({ name: fileName, mimeType: fileMime, parents: [folderId] });
    const uploadBody = Buffer.concat([
      Buffer.from(`--${uploadBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${uploadBoundary}\r\nContent-Type: ${fileMime}\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${uploadBoundary}--`),
    ]);

    const upRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': `multipart/related; boundary=${uploadBoundary}` },
      body: uploadBody,
    });
    if (!upRes.ok) throw new Error('Upload failed: ' + await upRes.text());
    const uploaded = await upRes.json();

    // 3. Κάνε share public (ώστε ο εκπαιδευτικός να το δει)
    try {
      await drive.permissions.create({ fileId: uploaded.id, requestBody: { role: 'reader', type: 'anyone' }, fields: 'id' });
    } catch {}

    // 4α. Υπολόγισε τους παραλήπτες (επιλεγμένοι ή όλοι) ΠΡΙΝ το registry,
    //     ώστε να αποθηκευτούν στο entry (χρειάζονται για «Απεσταλμένα ανά χρήστη»)
    const conns = await kv.get(`conn:${myEmail}`) || [];
    const targetConns = selectedRecipients
      ? conns.filter(email => selectedRecipients.includes(email))
      : conns;

    // 4β. Πρόσθεσε στο registry ως sent (με τους παραλήπτες)
    if (!reg.files) reg.files = [];
    const sentEntry = {
      id: uploaded.id, name: uploaded.name, mimeType: uploaded.mimeType || fileMime,
      info: '', comment: '', tags: [], questions: '', links: [],
      fav: false, openCount: 0, addedAt: new Date().toISOString(),
      folderId, sent: true, sentAt: new Date().toISOString(),
      recipients: targetConns,
    };
    reg.files.push(sentEntry);
    await saveRegistry(drive, reg);

    // 5. Ειδοποίησε τις συνδέσεις (επιλεγμένους ή όλους)
    const inboxEntry = {
      fileId: uploaded.id, fileName: uploaded.name,
      fromEmail: myEmail, fromName: myName,
      visibility: 'connections', sentAt: Date.now(), seen: false,
    };
    await Promise.all(targetConns.map(async recipEmail => {
      const inbox = await kv.get(`inbox:${recipEmail}`) || [];
      const filtered = inbox.filter(i => i.fileId !== uploaded.id);
      filtered.push(inboxEntry);
      const trimmed = filtered.sort((a, b) => b.sentAt - a.sentAt).slice(0, 100);
      await kv.set(`inbox:${recipEmail}`, trimmed, { ex: 60 * 60 * 24 * 90 });
    }));

    return res.json({ ok: true, fileId: uploaded.id, name: uploaded.name });
  } catch (e) {
    console.error('[student-send]', e.message);
    return res.status(500).json({ error: 'Send failed: ' + e.message });
  }
}

// Απλός multipart parser
function parseMultipart(body, boundary) {
  const parts = [];
  const delim = Buffer.from('--' + boundary);
  const end = Buffer.from('--' + boundary + '--');
  let start = indexOf(body, delim) + delim.length + 2; // skip \r\n
  while (true) {
    let next = indexOf(body, delim, start);
    if (next === -1) break;
    const part = body.slice(start, next - 2); // -2 for \r\n before boundary
    const headerEnd = indexOf(part, Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) { start = next + delim.length + 2; continue; }
    const headerStr = part.slice(0, headerEnd).toString();
    const data = part.slice(headerEnd + 4);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const fileMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);
    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: fileMatch ? fileMatch[1] : null,
      contentType: ctMatch ? ctMatch[1].trim() : null,
      data,
    });
    start = next + delim.length + 2;
    if (indexOf(body, end, next) === next) break;
  }
  return parts;
}

function indexOf(buf, search, from = 0) {
  for (let i = from; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

export const config = { api: { bodyParser: false } };
