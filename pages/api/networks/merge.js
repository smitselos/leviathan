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
const FONT_BOLD_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf';

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
async function fetchBoldFont() {
  const res = await fetch(FONT_BOLD_URL);
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
      const boldBytes = await fetchBoldFont();
      const font = await mergedPdf.embedFont(fontBytes);
      const fontBold = await mergedPdf.embedFont(boldBytes);

      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 80;
      const lineHeight = 20;
      const maxWidth = pageWidth - margin * 2;

      // Χρήση τελευταίας σελίδας αν υπάρχει αρκετός χώρος (≥35% σελίδας)
      const minSpaceForQuestions = pageHeight * 0.35;
      const totalPages = mergedPdf.getPageCount();
      let page;
      let y;

      if (totalPages > 0) {
        const lastPage = mergedPdf.getPage(totalPages - 1);
        const lastH = lastPage.getSize().height;
        // Ξεκινάμε στο 38% από κάτω — αφήνει 62% για το κείμενο
        const startY = lastH * 0.38;
        if (startY > margin + lineHeight * 4) {
          // Αρκετός χώρος — χρήση τελευταίας σελίδας
          page = lastPage;
          y = startY;
          // Διαχωριστική γραμμή
          page.drawLine({
            start: { x: margin, y: y + 16 },
            end: { x: pageWidth - margin, y: y + 16 },
            thickness: 0.5,
            color: rgb(0.7, 0.7, 0.7),
          });
        } else {
          // Δεν χωράει — νέα σελίδα
          page = mergedPdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      } else {
        page = mergedPdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      // Τίτλος — bold
      page.drawText('ΕΡΩΤΗΣΕΙΣ', {
        x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0),
      });
      y -= lineHeight * 2.5;

      // Justified line helper
      const drawJustifiedLine = (words, size, useFont, isLast, xStart, availWidth) => {
        const startX = xStart || margin;
        const lineWidth = availWidth || maxWidth;
        if (y < margin + lineHeight) {
          page = mergedPdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        if (!words.length) return;
        if (isLast || words.length === 1) {
          page.drawText(words.join(' '), { x: startX, y, size, font: useFont, color: rgb(0, 0, 0) });
        } else {
          const totalWordWidth = words.reduce((sum, w) => sum + useFont.widthOfTextAtSize(w, size), 0);
          const extraSpace = (lineWidth - totalWordWidth) / (words.length - 1);
          let cx = startX;
          for (const w of words) {
            page.drawText(w, { x: cx, y, size, font: useFont, color: rgb(0, 0, 0) });
            cx += useFont.widthOfTextAtSize(w, size) + extraSpace;
          }
        }
        y -= lineHeight;
      };

      // Word-wrap + justify helper
      const drawWrappedJustified = (text, size, useFont) => {
        const paragraphs = text.split(/\n/);
        for (let pi = 0; pi < paragraphs.length; pi++) {
          const para = paragraphs[pi].trim();
          if (!para) { y -= lineHeight * 0.6; continue; }
          const words = para.split(/\s+/);
          let lineWords = [];
          for (const word of words) {
            const testLine = [...lineWords, word].join(' ');
            if (useFont.widthOfTextAtSize(testLine, size) > maxWidth && lineWords.length > 0) {
              drawJustifiedLine(lineWords, size, useFont, false);
              lineWords = [word];
            } else {
              lineWords.push(word);
            }
          }
          if (lineWords.length > 0) {
            drawJustifiedLine(lineWords, size, useFont, true); // τελευταία γραμμή → αριστερά
          }
          if (pi < paragraphs.length - 1) y -= lineHeight * 0.3;
        }
      };

      for (const q of allQuestions) {
        if (q.code) {
          const prefix = `${q.code}. `;
          const prefixWidth = fontBold.widthOfTextAtSize(prefix, 11);
          if (y < margin + lineHeight) {
            page = mergedPdf.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(prefix, { x: margin, y, size: 11, font: fontBold, color: rgb(0, 0, 0) });
          const remainingWidth = maxWidth - prefixWidth;
          const textWords = (q.text || '').split(/\s+/).filter(w => w);
          let firstLineWords = [];
          for (const word of textWords) {
            const testLine = [...firstLineWords, word].join(' ');
            if (font.widthOfTextAtSize(testLine, 11) > remainingWidth && firstLineWords.length > 0) break;
            firstLineWords.push(word);
          }
          const restWords = textWords.slice(firstLineWords.length);
          const isLastLine = restWords.length === 0;
          // Πρώτη γραμμή — justified αν υπάρχει συνέχεια
          if (firstLineWords.length > 0) {
            drawJustifiedLine(firstLineWords, 11, font, isLastLine, margin + prefixWidth, remainingWidth);
          } else {
            y -= lineHeight;
          }
          // Υπόλοιπο κείμενο justified
          if (restWords.length > 0) {
            drawWrappedJustified(restWords.join(' '), 11, font);
          }
        } else {
          drawWrappedJustified(q.text || '', 11, font);
        }
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
