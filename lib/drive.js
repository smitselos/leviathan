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
