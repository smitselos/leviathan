// pages/api/networks/merge.js
// POST → Συνένωση κειμένων (PDF) + σελίδα ερωτήσεων
//         Αποθήκευση στον φάκελο που επέλεξε ο εκπαιδευτικός (network.folderId)
//
// body: { network: { id, name, folderId, items:[{fileId, name, questions}], pdfFileId? } }
// response: { pdfFileId, pdfFilename }

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDrive, loadRegistry, saveRegistry } from '../../../lib/drive';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Readable } from 'stream';

const FONT_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';

function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

async function fetchFont() {
  const res = await fetch(FONT_URL);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Κατεβάζει ένα αρχείο από το Drive ως PDF.
 * — Google Docs/Slides/Sheets → export σε PDF
 * — Κανονικά PDF → direct download
 */
async function getFileAsPdf(drive, fileId) {
  // Πρώτα δοκίμασε export (λειτουργεί μόνο για Google Workspace αρχεία)
  try {
    const exported = await drive.files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(exported.data);
  } catch (_) {
    // Αν αποτύχει, κατέβασε απευθείας (ήδη PDF ή άλλο binary)
    const downloaded = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(downloaded.data);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { network } = req.body;
  if (!network?.items?.length)
    return res.status(400).json({ error: 'No items' });

  const drive = getDrive(session.accessToken);

  try {
    const mergedPdf = await PDFDocument.create();
    mergedPdf.registerFontkit(fontkit);

    // ── 1. Πρόσθεσε κάθε κείμενο ως σελίδες PDF ─────────────────────
    for (const item of network.items) {
      try {
        const buffer = await getFileAsPdf(drive, item.fileId);
        const srcPdf = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach((p) => mergedPdf.addPage(p));
      } catch (e) {
        console.error(`Error loading PDF for ${item.name}:`, e.message);
      }
    }

    // ── 2. Σελίδα ερωτήσεων ──────────────────────────────────────────
    const CODE_ORDER = ['Α', 'Β1', 'Β2', 'Β3', 'Γ', 'Δ'];
    const allQuestions = network.items
      .flatMap((item) => (item.questions || []).map((q) => ({ ...q })))
      .filter((q) => q.text?.trim())
      .sort((a, b) => {
        const ia = CODE_ORDER.indexOf(a.code);
        const ib = CODE_ORDER.indexOf(b.code);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

    if (allQuestions.length > 0) {
      const fontBytes = await fetchFont();
      const font = await mergedPdf.embedFont(fontBytes);

      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 85;
      const lineHeight = 14;
      const maxWidth = pageWidth - margin * 2;

      let page = mergedPdf.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      // Τίτλος
      page.drawText('ΕΡΩΤΗΣΕΙΣ', {
        x: margin, y, size: 16, font, color: rgb(0, 0, 0),
      });
      y -= lineHeight * 2;

      // Word-wrap helper — χειρίζεται και αλλαγές παραγράφου (\n)
      const drawWrapped = (text, size) => {
        const paragraphs = text.split(/\n/);
        for (let pi = 0; pi < paragraphs.length; pi++) {
          const para = paragraphs[pi].trim();
          if (!para) {
            // Κενή γραμμή → απόσταση παραγράφου
            y -= lineHeight * 0.6;
            continue;
          }
          const words = para.split(' ');
          let line = '';
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
              if (y < margin + lineHeight) {
                page = mergedPdf.addPage([pageWidth, pageHeight]);
                y = pageHeight - margin;
              }
              page.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
              y -= lineHeight;
              line = word;
            } else {
              line = test;
            }
          }
          if (line) {
            if (y < margin + lineHeight) {
              page = mergedPdf.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
            }
            page.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
            y -= lineHeight;
          }
          // Μικρό κενό μεταξύ παραγράφων (εκτός αν είναι η τελευταία)
          if (pi < paragraphs.length - 1) y -= lineHeight * 0.3;
        }
      };

      for (const q of allQuestions) {
        const prefix = q.code ? `${q.code}. ` : '';
        drawWrapped(`${prefix}${q.text}`, 11);
        y -= 8;
      }
    }

    // ── 3. Αποθήκευση PDF στο Drive ──────────────────────────────────
    const pdfBytes = await mergedPdf.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const filename = `${network.name}.pdf`;

    let pdfFileId = network.pdfFileId;
    const targetFolder = network.folderId || null;

    if (pdfFileId) {
      // Ενημέρωση υπάρχοντος PDF
      await drive.files.update({
        fileId: pdfFileId,
        media: {
          mimeType: 'application/pdf',
          body: bufferToStream(pdfBuffer),
        },
      });
    } else {
      // Δημιουργία νέου PDF στον επιλεγμένο φάκελο
      const requestBody = { name: filename, mimeType: 'application/pdf' };
      if (targetFolder) requestBody.parents = [targetFolder];

      const created = await drive.files.create({
        requestBody,
        media: {
          mimeType: 'application/pdf',
          body: bufferToStream(pdfBuffer),
        },
        fields: 'id, name',
      });
      pdfFileId = created.data.id;
    }

    // ── 4. Ενημέρωση registry ────────────────────────────────────────
    try {
      const reg = await loadRegistry(drive);

      // 4a. Ενημέρωση network metadata
      if (Array.isArray(reg.networks)) {
        const idx = reg.networks.findIndex((n) => n.id === network.id);
        if (idx >= 0) {
          reg.networks[idx].pdfFileId = pdfFileId;
          reg.networks[idx].pdfFilename = filename;
          reg.networks[idx].updatedAt = Date.now();
        }
      }

      // 4b. Καταχώρηση PDF στα αρχεία (ώστε να φαίνεται στον φάκελο)
      if (!reg.files) reg.files = [];
      const existingIdx = reg.files.findIndex((f) => f.id === pdfFileId);
      const fileEntry = {
        id: pdfFileId,
        name: filename,
        mimeType: 'application/pdf',
        folderId: targetFolder,
        tags: ['Δίκτυο'],
        comment: `Δίκτυο: ${network.name}`,
        questions: '',
        links: [],
        published: false,
        visibility: 'none',
        favorite: false,
        openCount: 0,
        openedAt: null,
        addedAt: Date.now(),
      };
      if (existingIdx >= 0) {
        // Ενημέρωση υπάρχοντος — κρατάμε tags/comment κ.λπ. αν άλλαξαν
        reg.files[existingIdx].name = filename;
        reg.files[existingIdx].mimeType = 'application/pdf';
      } else {
        reg.files.push(fileEntry);
      }

      await saveRegistry(drive, reg);
    } catch (e) {
      // Μη κρίσιμο — το PDF δημιουργήθηκε, απλά δεν ενημερώθηκε το registry
      console.error('Registry update after merge:', e.message);
    }

    return res.status(200).json({ pdfFileId, pdfFilename: filename });
  } catch (error) {
    console.error('Merge error:', error);
    return res.status(500).json({ error: error.message || 'Merge failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};
