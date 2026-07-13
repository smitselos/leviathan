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
import { Readable } from 'stream';

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
// (live + δημόσια σελίδα). ΔΕΝ μπαίνει στο registry → αόρατος στη βιβλιοθήκη.
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

// ── Office → Google native (για μετατροπή) ─────────────────────
const LV_OFFICE_EXT = {
  docx:'application/vnd.google-apps.document', doc:'application/vnd.google-apps.document',
  pptx:'application/vnd.google-apps.presentation', ppt:'application/vnd.google-apps.presentation',
  xlsx:'application/vnd.google-apps.spreadsheet', xls:'application/vnd.google-apps.spreadsheet',
};

export function isOfficeFile(name) {
  return /\.(docx?|pptx?|xlsx?)$/i.test(name || '');
}

// ── Μετατροπή Office αρχείου → PDF (με επαναχρησιμοποίηση) ──────
// Επιστρέφει fileId ενός δημόσιου PDF αντιγράφου στον «Live PDF».
// Αν υπάρχει ήδη PDF για ίδιο source+version → επαναχρήση χωρίς νέα μετατροπή.
export async function ensurePdfCopy(drive, sourceId, sourceName) {
  const ext = (sourceName.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const gMime = LV_OFFICE_EXT[ext];
  if (!gMime) return null; // δεν είναι Office — δεν χρειάζεται μετατροπή

  const baseName = sourceName.replace(/\.[^.]+$/, '');
  const folderId = await ensureLivePdfFolder(drive);

  // Version του πρωτότυπου (για invalidation αν αλλάξει το doc)
  let srcVersion = '';
  try {
    const m = await drive.files.get({ fileId: sourceId, fields: 'modifiedTime,version' });
    srcVersion = m.data.version || m.data.modifiedTime || '';
  } catch {}

  const pdfName = `${baseName}__${sourceId}__${srcVersion}.pdf`.replace(/[/\\]/g, '_');

  // Υπάρχει ήδη; → επαναχρήση, αλλά ΞΑΝΑ-εξασφάλισε τη δημόσια πρόσβαση
  // (η αποδημοσίευση την αφαιρεί — βλ. unsharePdfCopies)
  try {
    const exq = await drive.files.list({
      q: `name='${pdfName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)', spaces: 'drive', pageSize: 1,
    });
    if (exq.data.files?.[0]) {
      const existingId = exq.data.files[0].id;
      try {
        await drive.permissions.create({ fileId: existingId, requestBody: { role: 'reader', type: 'anyone' } });
      } catch {}
      return existingId;
    }
  } catch {}

  // Καθάρισε παλιές εκδόσεις του ίδιου source (να μη συσσωρεύονται)
  try {
    const old = await drive.files.list({
      q: `name contains '__${sourceId}__' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)', spaces: 'drive', pageSize: 10,
    });
    await Promise.all((old.data.files || []).map(f =>
      drive.files.update({ fileId: f.id, requestBody: { trashed: true } }).catch(() => {})
    ));
  } catch {}

  // copy ως Google native (convert) → export PDF → upload → trash temp
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
    const pdfBuffer = Buffer.from(exp.data);
    const created = await drive.files.create({
      requestBody: { name: pdfName, mimeType: 'application/pdf', parents: [folderId] },
      media: { mimeType: 'application/pdf', body: Readable.from(pdfBuffer) },
      fields: 'id',
    });
    const pdfId = created.data.id;
    // Δημόσιο δικαίωμα ανάγνωσης — με retry. Χωρίς αυτό το preview δείχνει
    // «Ζητήστε πρόσβαση» στον μαθητή, χειρότερο από το fallback λήψης.
    let shared = false;
    for (let attempt = 0; attempt < 3 && !shared; attempt++) {
      try {
        await drive.permissions.create({ fileId: pdfId, requestBody: { role: 'reader', type: 'anyone' } });
        shared = true;
      } catch (pe) {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        else console.error('[ensurePdfCopy] ✗ permission FAILED for', sourceName, '—', pe.message);
      }
    }
    if (!shared) {
      // Απρόσιτο PDF = άχρηστο: το πετάμε και επιστρέφουμε null → fallback λήψης
      drive.files.update({ fileId: pdfId, requestBody: { trashed: true } }).catch(() => {});
      return null;
    }
    console.log('[ensurePdfCopy] ✓ PDF created', pdfId, 'for', sourceName);
    return pdfId;
  } catch (e) {
    console.error('[ensurePdfCopy] ✗ FAILED for', sourceName, '—', e.message, e.errors ? JSON.stringify(e.errors) : '');
    return null;
  } finally {
    if (tempId) drive.files.delete({ fileId: tempId }).catch(() => {});
  }
}

// ── Εύρεση των PDF αντιγράφων ενός πρωτοτύπου στον «Live PDF» ───
async function listPdfCopies(drive, sourceId) {
  const folderId = await ensureLivePdfFolder(drive);
  const res = await drive.files.list({
    q: `name contains '__${sourceId}__' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)', spaces: 'drive', pageSize: 10,
  });
  return res.data.files || [];
}

// ── Αποδημοσίευση: αφαίρεση δημόσιας πρόσβασης από τα PDF αντίγραφα ──
// Τα αρχεία ΜΕΝΟΥΝ στο Drive για επαναχρήση σε μελλοντική δημοσίευση·
// απλώς παύουν να είναι προσβάσιμα σε όποιον κράτησε τον σύνδεσμο.
export async function unsharePdfCopies(drive, sourceId) {
  try {
    for (const f of await listPdfCopies(drive, sourceId)) {
      try {
        const p = await drive.permissions.list({ fileId: f.id, fields: 'permissions(id,type)' });
        const any = p.data.permissions?.find((x) => x.type === 'anyone');
        if (any) await drive.permissions.delete({ fileId: f.id, permissionId: any.id });
      } catch {}
    }
  } catch {}
}

// ── Διαγραφή πρωτοτύπου: τα PDF αντίγραφά του στον κάδο ─────────
export async function trashPdfCopies(drive, sourceId) {
  try {
    for (const f of await listPdfCopies(drive, sourceId)) {
      await drive.files.update({ fileId: f.id, requestBody: { trashed: true } }).catch(() => {});
    }
  } catch {}
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
