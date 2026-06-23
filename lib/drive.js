// lib/drive.js
// Βοηθητικά για Google Drive + το «μητρώο» (registry).
//
// ΜΟΝΤΕΛΟ:
// - Ένας ριζικός φάκελος «ΛΕΒΙΑΘΑΝ Cloud» στο Drive του κάθε χρήστη.
// - Μέσα του, οι φάκελοι που φτιάχνει ο χρήστης (ένα επίπεδο, χωρίς υποφακέλους).
// - Τα αρχεία ανεβαίνουν μέσα στον επιλεγμένο φάκελο.
// - Ένα JSON μητρώο (leviathan-cloud-data.json) μέσα στον ριζικό φάκελο
//   κρατά τη λίστα φακέλων + αρχείων. Πλήρως συμβατό με drive.file
//   (όλα είναι app-created).

import { google } from 'googleapis';

export const REGISTRY_FILENAME = 'leviathan-cloud-data.json';
export const ROOT_FOLDER_NAME = 'ΛΕΒΙΑΘΑΝ Cloud';
export const APPS_FOLDER_NAME = 'Εφαρμογές';
export const LIVEPDF_FOLDER_NAME = 'Live PDF';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function getDrive(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

// ── Ριζικός φάκελος ─────────────────────────────────────────────
// Βρες (ή δημιούργησε) τον ριζικό φάκελο «ΛΕΒΙΑΘΑΝ Cloud».
// Με drive.file «βλέπουμε» μόνο ό,τι δημιούργησε η εφαρμογή — άρα
// τον δικό μας φάκελο τον βρίσκουμε κανονικά.
export async function ensureRootFolder(drive) {
  const res = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME },
    fields: 'id',
  });
  return created.data.id;
}

// ── Δημιουργία υποφακέλου μέσα στον ριζικό ──────────────────────
export async function createFolder(drive, name, rootId) {
  const parent = rootId || (await ensureRootFolder(drive));
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parent] },
    fields: 'id,name',
  });
  return { id: created.data.id, name: created.data.name };
}

// ── Ειδικός φάκελος «Εφαρμογές» (μέσα στον ριζικό) ─────────────
// Δεν εμφανίζεται στις κάρτες της αρχικής — ανοίγει μόνο από το
// μενού «Εφαρμογές». Βρίσκεται με βάση το όνομα μέσα στον ριζικό.
export async function ensureAppsFolder(drive) {
  const rootId = await ensureRootFolder(drive);
  const res = await drive.files.list({
    q: `name='${APPS_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and '${rootId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: APPS_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [rootId] },
    fields: 'id',
  });
  return created.data.id;
}

// ── Διαγραφή αρχείου/φακέλου από το Drive (μετακίνηση στον κάδο) ─
export async function trashDriveFile(drive, fileId) {
  await drive.files.update({ fileId, requestBody: { trashed: true } });
}

// ── Κρυφός φάκελος «Live PDF» (μέσα στον ριζικό) ────────────────
// Κρατά τα PDF αντίγραφα των Office αρχείων που προβάλλονται δημόσια
// (live + δημόσια σελίδα). ΔΕΝ εμφανίζεται στις κάρτες της βιβλιοθήκης.
export async function ensureLivePdfFolder(drive) {
  const rootId = await ensureRootFolder(drive);
  const res = await drive.files.list({
    q: `name='${LIVEPDF_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and '${rootId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: LIVEPDF_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [rootId] },
    fields: 'id',
  });
  return created.data.id;
}

// ── Μετατροπή Office αρχείου → PDF (με επαναχρησιμοποίηση) ──────
// Επιστρέφει το fileId ενός PDF αντιγράφου, αποθηκευμένου στον «Live PDF».
// Αν υπάρχει ήδη PDF για το ίδιο source (ίδιο όνομα + ίδια ημ/νία τροποποίησης),
// το επαναχρησιμοποιεί αντί να ξαναμετατρέψει.
// Δουλεύει για αρχεία που ανήκουν στον χρήστη (drive.file scope).
const OFFICE_EXT_TO_GOOGLE = {
  docx:'application/vnd.google-apps.document', doc:'application/vnd.google-apps.document',
  pptx:'application/vnd.google-apps.presentation', ppt:'application/vnd.google-apps.presentation',
  xlsx:'application/vnd.google-apps.spreadsheet', xls:'application/vnd.google-apps.spreadsheet',
};

export function isOfficeFile(name) {
  return /\.(docx?|pptx?|xlsx?)$/i.test(name || '');
}

export async function ensurePdfCopy(drive, sourceId, sourceName) {
  const ext = (sourceName.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const gMime = OFFICE_EXT_TO_GOOGLE[ext];
  if (!gMime) return null; // δεν είναι Office — δεν χρειάζεται μετατροπή

  const baseName = sourceName.replace(/\.[^.]+$/, '');
  const folderId = await ensureLivePdfFolder(drive);

  // Πάρε version του πρωτότυπου (για invalidation αν αλλάξει)
  let srcVersion = '';
  try {
    const m = await drive.files.get({ fileId: sourceId, fields: 'modifiedTime,version' });
    srcVersion = m.data.version || m.data.modifiedTime || '';
  } catch {}

  // Όνομα PDF που κωδικοποιεί source + version → ντετερμινιστική επαναχρήση
  const pdfName = `${baseName}__${sourceId}__${srcVersion}.pdf`.replace(/[/\\]/g, '_');

  // Υπάρχει ήδη;
  try {
    const ex = await drive.files.list({
      q: `name='${pdfName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)', spaces: 'drive', pageSize: 1,
    });
    if (ex.data.files?.[0]) return ex.data.files[0].id;
  } catch {}

  // Καθάρισε παλιά PDF του ίδιου source (διαφορετική version) ώστε να μη συσσωρεύονται
  try {
    const old = await drive.files.list({
      q: `name contains '__${sourceId}__' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)', spaces: 'drive', pageSize: 10,
    });
    await Promise.all((old.data.files || []).map(f =>
      drive.files.update({ fileId: f.id, requestBody: { trashed: true } }).catch(() => {})
    ));
  } catch {}

  // Μετατροπή: copy ως Google native (convert) → export PDF → upload PDF → trash temp
  let tempId = null;
  try {
    const copy = await drive.files.copy({
      fileId: sourceId,
      requestBody: { name: '_tmp_' + Date.now(), mimeType: gMime },
      fields: 'id',
    });
    tempId = copy.data.id;
    const exp = await drive.files.export(
      { fileId: tempId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );
    const created = await drive.files.create({
      requestBody: { name: pdfName, mimeType: 'application/pdf', parents: [folderId] },
      media: { mimeType: 'application/pdf', body: Buffer.from(exp.data) },
      fields: 'id',
    });
    const pdfId = created.data.id;
    // Κάνε το PDF δημόσιο ώστε να προβάλλεται χωρίς auth
    try {
      await drive.permissions.create({ fileId: pdfId, requestBody: { role: 'reader', type: 'anyone' } });
    } catch {}
    return pdfId;
  } catch (e) {
    console.error('[ensurePdfCopy]', e.message);
    return null;
  } finally {
    if (tempId) drive.files.delete({ fileId: tempId }).catch(() => {});
  }
}

// ── Κρυφός φάκελος «Live PDF» (μέσα στον ριζικό) ────────────────
// Κρατά τα PDF αντίγραφα των Office αρχείων που προβάλλονται σε
// live/δημόσια σελίδα. ΔΕΝ εμφανίζεται στις κάρτες της βιβλιοθήκης
// (φιλτράρεται με βάση το όνομα στο index.js).
export async function ensureLivePdfFolder(drive) {
  const rootId = await ensureRootFolder(drive);
  const res = await drive.files.list({
    q: `name='${LIVEPDF_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and '${rootId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  if (res.data.files?.[0]) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: LIVEPDF_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [rootId] },
    fields: 'id',
  });
  return created.data.id;
}

// ── Μετατροπή Office αρχείου → PDF (με επαναχρησιμοποίηση) ───────
// Επιστρέφει το fileId ενός PDF που αντιστοιχεί στο sourceId.
//  - Αν υπάρχει ήδη PDF για αυτό το source (ίδιο sourceId & όχι παλιότερο), το επαναχρησιμοποιεί.
//  - Αλλιώς: copy+convert σε προσωρινό Google Doc → export PDF → upload PDF στον «Live PDF» → delete temp.
// Το PDF μοιράζεται δημόσια (anyone:reader) ώστε να το βλέπουν μη συνδεδεμένοι.
const OFFICE_TO_GOOGLE = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.google-apps.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
  'application/msword': 'application/vnd.google-apps.document',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
};
const EXT_TO_GOOGLE = {
  docx:'application/vnd.google-apps.document', doc:'application/vnd.google-apps.document',
  pptx:'application/vnd.google-apps.presentation', ppt:'application/vnd.google-apps.presentation',
  xlsx:'application/vnd.google-apps.spreadsheet', xls:'application/vnd.google-apps.spreadsheet',
};

export function isOfficeFile(name, mimeType) {
  if (mimeType && OFFICE_TO_GOOGLE[mimeType]) return true;
  const ext = (name?.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  return !!(ext && EXT_TO_GOOGLE[ext]);
}

export async function ensureLivePdf(drive, sourceId, sourceName, sourceMime) {
  const gMime = OFFICE_TO_GOOGLE[sourceMime] ||
    EXT_TO_GOOGLE[(sourceName?.match(/\.([^.]+)$/) || [])[1]?.toLowerCase()];
  if (!gMime) return null; // δεν είναι Office — δεν χρειάζεται μετατροπή

  const folderId = await ensureLivePdfFolder(drive);
  const pdfName = `${sourceName.replace(/\.[^.]+$/, '')}__${sourceId}.pdf`;

  // 1. Υπάρχει ήδη; (αναζήτηση με βάση appProperties.sourceId)
  try {
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and appProperties has { key='sourceId' and value='${sourceId}' }`,
      fields: 'files(id,modifiedTime)',
      spaces: 'drive',
      pageSize: 1,
    });
    if (existing.data.files?.[0]) {
      const pdfId = existing.data.files[0].id;
      // Έλεγξε αν το source άλλαξε μετά τη δημιουργία του PDF
      try {
        const [srcMeta, pdfMeta] = await Promise.all([
          drive.files.get({ fileId: sourceId, fields: 'modifiedTime' }),
          drive.files.get({ fileId: pdfId, fields: 'modifiedTime' }),
        ]);
        if (new Date(srcMeta.data.modifiedTime) <= new Date(pdfMeta.data.modifiedTime)) {
          await sharePdfPublic(drive, pdfId);
          return pdfId; // PDF επίκαιρο — επαναχρησιμοποίηση
        }
        // αλλιώς: source νεότερο → σβήσε το παλιό PDF και ξαναφτιάξε
        await drive.files.delete({ fileId: pdfId }).catch(() => {});
      } catch { await sharePdfPublic(drive, pdfId); return pdfId; }
    }
  } catch (e) { /* συνέχισε στη δημιουργία */ }

  // 2. Δημιουργία: download bytes (public URL) → upload+convert → export PDF → upload PDF → delete temp
  let tempId = null;
  try {
    const dlUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(sourceId)}`;
    const dlRes = await fetch(dlUrl, { redirect: 'follow' });
    if (!dlRes.ok) throw new Error('download failed');
    const buffer = Buffer.from(await dlRes.arrayBuffer());
    const head = buffer.slice(0,50).toString().toLowerCase();
    if (head.includes('<!doctype') || head.includes('<html')) throw new Error('got HTML not file');

    // upload ως προσωρινό Google Doc (μετατροπή)
    const ext = (sourceName.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
    const uploadCT = sourceMime || {
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }[ext] || 'application/octet-stream';
    const meta = { name: '_temp_livepdf_' + Date.now(), mimeType: gMime };
    const boundary = '-----LivePdfBoundary' + Date.now();
    const upBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${uploadCT}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const upRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method:'POST',
      headers:{ Authorization:`Bearer ${drive.context._options.auth.credentials.access_token}`, 'Content-Type':`multipart/related; boundary=${boundary}` },
      body: upBody,
    });
    if (!upRes.ok) throw new Error('upload failed: ' + (await upRes.text()));
    tempId = (await upRes.json()).id;

    // export PDF
    const expRes = await fetch(`https://www.googleapis.com/drive/v3/files/${tempId}/export?mimeType=application/pdf`, {
      headers:{ Authorization:`Bearer ${drive.context._options.auth.credentials.access_token}` },
    });
    if (!expRes.ok) throw new Error('export failed');
    const pdfBuffer = Buffer.from(await expRes.arrayBuffer());

    // upload PDF στον φάκελο Live PDF (με appProperties.sourceId για μελλοντική εύρεση)
    const pdfMeta = { name: pdfName, mimeType:'application/pdf', parents:[folderId], appProperties:{ sourceId } };
    const pdfBoundary = '-----LivePdfUp' + Date.now();
    const pdfBody = Buffer.concat([
      Buffer.from(`--${pdfBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(pdfMeta)}\r\n`),
      Buffer.from(`--${pdfBoundary}\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfBuffer,
      Buffer.from(`\r\n--${pdfBoundary}--`),
    ]);
    const pdfRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method:'POST',
      headers:{ Authorization:`Bearer ${drive.context._options.auth.credentials.access_token}`, 'Content-Type':`multipart/related; boundary=${pdfBoundary}` },
      body: pdfBody,
    });
    if (!pdfRes.ok) throw new Error('pdf upload failed');
    const pdfId = (await pdfRes.json()).id;
    await sharePdfPublic(drive, pdfId);
    return pdfId;
  } catch (e) {
    console.error('[ensureLivePdf]', e.message);
    return null;
  } finally {
    if (tempId) drive.files.delete({ fileId: tempId }).catch(() => {});
  }
}

async function sharePdfPublic(drive, fileId) {
  try { await drive.permissions.create({ fileId, requestBody:{ role:'reader', type:'anyone' } }); } catch (e) {}
}

// ── Μητρώο ──────────────────────────────────────────────────────
async function findRegistryFile(drive) {
  const res = await drive.files.list({
    q: `name='${REGISTRY_FILENAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

function emptyRegistry() {
  return { folders: [], files: [] };
}

export async function loadRegistry(drive) {
  const file = await findRegistryFile(drive);
  if (!file) return emptyRegistry();
  try {
    const content = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );
    const data =
      typeof content.data === 'string'
        ? JSON.parse(content.data)
        : content.data;
    return {
      _fileId: file.id,
      folders: Array.isArray(data.folders) ? data.folders : [],
      files: Array.isArray(data.files) ? data.files : [],
    };
  } catch (e) {
    return { _fileId: file.id, ...emptyRegistry() };
  }
}

export async function saveRegistry(drive, registry) {
  const payload = {
    folders: registry.folders || [],
    files: registry.files || [],
  };
  const body = JSON.stringify(payload, null, 2);
  const existing = registry._fileId
    ? { id: registry._fileId }
    : await findRegistryFile(drive);

  if (existing) {
    await drive.files.update({
      fileId: existing.id,
      media: { mimeType: 'application/json', body },
    });
    return existing.id;
  }
  // Το μητρώο μπαίνει ΜΕΣΑ στον ριζικό φάκελο
  const rootId = await ensureRootFolder(drive);
  const created = await drive.files.create({
    requestBody: {
      name: REGISTRY_FILENAME,
      mimeType: 'application/json',
      parents: [rootId],
    },
    media: { mimeType: 'application/json', body },
    fields: 'id',
  });
  return created.data.id;
}
