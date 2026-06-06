// lib/drive.js
// Βοηθητικά για Google Drive + το «μητρώο» (registry) αρχείων.
//
// ΜΟΝΤΕΛΟ ΜΗΤΡΩΟΥ (αντί για σάρωση φακέλων):
// Η εφαρμογή κρατά ένα JSON αρχείο στο Drive του κάθε χρήστη
// (leviathan-cloud-data.json) με τη λίστα των αρχείων που έχει
// προσθέσει/δημιουργήσει. Αυτό γίνεται η «πηγή αλήθειας» — συμβατό
// πλήρως με το drive.file scope.

import { google } from 'googleapis';

export const REGISTRY_FILENAME = 'leviathan-cloud-data.json';

export function getDrive(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

// Βρες το αρχείο μητρώου. Με drive.file «βλέπουμε» μόνο αρχεία που
// δημιούργησε η εφαρμογή — άρα το βρίσκουμε κανονικά.
async function findRegistryFile(drive) {
  const res = await drive.files.list({
    q: `name='${REGISTRY_FILENAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

export async function loadRegistry(drive) {
  const file = await findRegistryFile(drive);
  if (!file) return { files: [] };
  try {
    const content = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );
    const data =
      typeof content.data === 'string'
        ? JSON.parse(content.data)
        : content.data;
    return { _fileId: file.id, files: Array.isArray(data.files) ? data.files : [] };
  } catch (e) {
    return { _fileId: file.id, files: [] };
  }
}

export async function saveRegistry(drive, registry) {
  const body = JSON.stringify({ files: registry.files || [] }, null, 2);
  const existing = registry._fileId
    ? { id: registry._fileId }
    : await findRegistryFile(drive);
  if (existing) {
    await drive.files.update({
      fileId: existing.id,
      media: { mimeType: 'application/json', body },
    });
    return existing.id;
  } else {
    const created = await drive.files.create({
      requestBody: { name: REGISTRY_FILENAME, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body },
      fields: 'id',
    });
    return created.data.id;
  }
}
