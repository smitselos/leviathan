// pages/api/print-with-questions.js
// POST { fileId, fileName, questions } → PDF blob (κείμενο + ερωτήσεις)
// Ίδια γραμματοσειρά & μορφοποίηση με merge.js — δεν αποθηκεύει τίποτα
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_URL = 'https://raw.githubusercontent.com/ONLYOFFICE/core-fonts/master/crosextra/Carlito-Regular.ttf';
const FONT_BOLD_URL = 'https://raw.githubusercontent.com/ONLYOFFICE/core-fonts/master/crosextra/Carlito-Bold.ttf';

let cachedFont = null;
let cachedBold = null;
async function fetchFont() {
  if (!cachedFont) { const r = await fetch(FONT_URL); cachedFont = Buffer.from(await r.arrayBuffer()); }
  return cachedFont;
}
async function fetchBoldFont() {
  if (!cachedBold) { const r = await fetch(FONT_BOLD_URL); cachedBold = Buffer.from(await r.arrayBuffer()); }
  return cachedBold;
}

const CODE_ORDER = ['Α', 'Β1', 'Β2', 'Β3', 'Γ', 'Δ'];

function parseQuestions(raw) {
  if (!raw || !String(raw).trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      // Ομαδοποίηση ανά κωδικό (ίδια λογική με merge.js)
      const filtered = arr.filter(q => q.text?.trim());
      const grouped = CODE_ORDER
        .map(code => {
          const texts = filtered.filter(q => q.code === code).map(q => q.text.trim());
          return texts.length > 0 ? { code, text: texts.join('\n\n') } : null;
        })
        .filter(Boolean);
      // Ερωτήσεις χωρίς κωδικό
      const noCode = filtered.filter(q => !q.code || !CODE_ORDER.includes(q.code));
      noCode.forEach(q => grouped.push({ code: '', text: q.text.trim() }));
      return grouped;
    }
  } catch {}
  // Plain text fallback
  const lines = String(raw).trim().split(/\n+/).filter(Boolean);
  return lines.map((line, i) => ({ code: '', text: line }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, fileName, questions } = req.body;
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

  const token = session.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    // ── 1. Κατέβασε το αρχείο ως PDF ──
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`, { headers }
    );
    const meta = metaRes.ok ? await metaRes.json() : {};
    const mime = meta.mimeType || '';

    let pdfBytes;
    if (mime.startsWith('application/vnd.google-apps.')) {
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`, { headers }
      );
      if (!dlRes.ok) return res.status(dlRes.status).json({ error: 'Export failed' });
      pdfBytes = Buffer.from(await dlRes.arrayBuffer());
    } else if (mime === 'application/pdf') {
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers }
      );
      if (!dlRes.ok) return res.status(dlRes.status).json({ error: 'Download failed' });
      pdfBytes = Buffer.from(await dlRes.arrayBuffer());
    } else {
      // Δοκιμή export, fallback σε direct download
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`, { headers }
      );
      if (dlRes.ok) {
        pdfBytes = Buffer.from(await dlRes.arrayBuffer());
      } else {
        const dlRes2 = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers }
        );
        if (!dlRes2.ok) return res.status(500).json({ error: 'Cannot download file' });
        pdfBytes = Buffer.from(await dlRes2.arrayBuffer());
      }
    }

    // ── 2. Ανάλυση ερωτήσεων ──
    const allQuestions = parseQuestions(questions);
    if (allQuestions.length === 0) {
      // Χωρίς ερωτήσεις → επέστρεψε το αρχείο ως έχει
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName || 'print')}.pdf"`);
      return res.send(pdfBytes);
    }

    // ── 3. Δημιουργία PDF: κείμενο + σελίδα ερωτήσεων ──
    const origPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const mergedPdf = await PDFDocument.create();
    mergedPdf.registerFontkit(fontkit);

    // Αντιγραφή σελίδων πρωτότυπου
    const origPages = await mergedPdf.copyPages(origPdf, origPdf.getPageIndices());
    origPages.forEach(p => mergedPdf.addPage(p));

    // Φόρτωση Carlito fonts (ίδια με merge.js)
    const fontBytes = await fetchFont();
    const boldBytes = await fetchBoldFont();
    const font = await mergedPdf.embedFont(fontBytes);
    const fontBold = await mergedPdf.embedFont(boldBytes);

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 71;
    const lineHeight = 18;
    const maxWidth = pageWidth - margin * 2;

    let page = mergedPdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Τίτλος — bold
    page.drawText('ΕΡΩΤΗΣΕΙΣ', {
      x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0),
    });
    y -= lineHeight * 2.5;

    // ── Justified line helper (ακριβώς από merge.js) ──
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

    // ── Word-wrap + justify helper (ακριβώς από merge.js) ──
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
          drawJustifiedLine(lineWords, size, useFont, true);
        }
        if (pi < paragraphs.length - 1) y -= lineHeight * 0.3;
      }
    };

    // ── Σχεδίαση ερωτήσεων (ίδια λογική merge.js) ──
    for (const q of allQuestions) {
      if (q.code) {
        const prefix = `${q.code}. `;
        const prefixWidth = fontBold.widthOfTextAtSize(prefix, 12);
        if (y < margin + lineHeight) {
          page = mergedPdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(prefix, { x: margin, y, size: 12, font: fontBold, color: rgb(0, 0, 0) });
        const remainingWidth = maxWidth - prefixWidth;
        const textWords = (q.text || '').split(/\s+/).filter(w => w);
        let firstLineWords = [];
        for (const word of textWords) {
          const testLine = [...firstLineWords, word].join(' ');
          if (font.widthOfTextAtSize(testLine, 12) > remainingWidth && firstLineWords.length > 0) break;
          firstLineWords.push(word);
        }
        const restWords = textWords.slice(firstLineWords.length);
        const isLastLine = restWords.length === 0;
        if (firstLineWords.length > 0) {
          drawJustifiedLine(firstLineWords, 12, font, isLastLine, margin + prefixWidth, remainingWidth);
        } else {
          y -= lineHeight;
        }
        if (restWords.length > 0) {
          drawWrappedJustified(restWords.join(' '), 12, font);
        }
      } else {
        drawWrappedJustified(q.text || '', 12, font);
      }
      y -= 8;
    }

    // ── 4. Επιστροφή PDF blob ──
    const finalBytes = await mergedPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName || 'print')}.pdf"`);
    return res.send(Buffer.from(finalBytes));

  } catch (e) {
    console.error('[print-with-questions]', e);
    return res.status(500).json({ error: 'Σφάλμα δημιουργίας PDF: ' + e.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};
