// pages/api/print-with-questions.js
// POST { fileId, fileName, questions } → PDF blob (κείμενο + ερωτήσεις)
// Δεν αποθηκεύει τίποτα — προσωρινό PDF για εκτύπωση
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const NOTO_SANS_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf';
let cachedFont = null;

async function getGreekFont() {
  if (cachedFont) return cachedFont;
  try {
    const r = await fetch(NOTO_SANS_URL);
    if (r.ok) { cachedFont = Buffer.from(await r.arrayBuffer()); return cachedFont; }
  } catch {}
  return null;
}

function parseQuestions(raw) {
  if (!raw || !String(raw).trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter(q => q.text?.trim()).map(q => q.text.trim());
  } catch {}
  // Plain text — split by newlines
  return String(raw).trim().split(/\n+/).filter(Boolean);
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
    // Πρώτα metadata για mimeType
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
      { headers }
    );
    const meta = metaRes.ok ? await metaRes.json() : {};
    const mimeType = meta.mimeType || '';

    let pdfBytes;
    if (mimeType === 'application/vnd.google-apps.document' ||
        mimeType === 'application/vnd.google-apps.presentation') {
      // Google Docs/Slides → export as PDF
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
        { headers }
      );
      if (!dlRes.ok) return res.status(dlRes.status).json({ error: 'Export failed' });
      pdfBytes = Buffer.from(await dlRes.arrayBuffer());
    } else if (mimeType === 'application/pdf') {
      // Already PDF
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers }
      );
      if (!dlRes.ok) return res.status(dlRes.status).json({ error: 'Download failed' });
      pdfBytes = Buffer.from(await dlRes.arrayBuffer());
    } else {
      // Other formats — try export as PDF
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
        { headers }
      );
      if (!dlRes.ok) {
        // Fallback: download as-is
        const dlRes2 = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers }
        );
        if (!dlRes2.ok) return res.status(500).json({ error: 'Cannot download file' });
        pdfBytes = Buffer.from(await dlRes2.arrayBuffer());
      } else {
        pdfBytes = Buffer.from(await dlRes.arrayBuffer());
      }
    }

    // ── 2. Ανάλυση ερωτήσεων ──
    const qList = parseQuestions(questions);
    if (qList.length === 0) {
      // Χωρίς ερωτήσεις → επέστρεψε το αρχείο ως έχει
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName || 'print')}.pdf"`);
      return res.send(pdfBytes);
    }

    // ── 3. Δημιουργία σελίδας ερωτήσεων ──
    const origPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const mergedPdf = await PDFDocument.create();
    mergedPdf.registerFontkit(fontkit);

    // Αντιγραφή σελίδων πρωτότυπου
    const origPages = await mergedPdf.copyPages(origPdf, origPdf.getPageIndices());
    origPages.forEach(p => mergedPdf.addPage(p));

    // Φόρτωση font με ελληνικά
    const fontBytes = await getGreekFont();
    let font, fontBold;
    if (fontBytes) {
      font = await mergedPdf.embedFont(fontBytes, { subset: true });
      fontBold = font; // Variable font — same for bold
    } else {
      // Fallback: Helvetica (χωρίς ελληνικά — θα φαίνονται □)
      font = await mergedPdf.embedFont(StandardFonts.Helvetica);
      fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
    }

    // Σελίδα/ες ερωτήσεων
    const pageW = 595.28; // A4
    const pageH = 841.89;
    const margin = 50;
    const lineHeight = 16;
    const maxTextWidth = pageW - margin * 2;

    let page = mergedPdf.addPage([pageW, pageH]);
    let y = pageH - margin;

    // Τίτλος
    const title = 'Ερωτήσεις';
    page.drawText(title, { x: margin, y, size: 16, font: fontBold || font, color: rgb(0.2, 0.2, 0.2) });
    y -= 28;

    // Γραμμή
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: pageW - margin, y: y + 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 10;

    for (let i = 0; i < qList.length; i++) {
      const qText = `${i + 1}. ${qList[i]}`;
      // Word wrap
      const words = qText.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        const w = font.widthOfTextAtSize(test, 11);
        if (w > maxTextWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      // Έλεγχος αν χρειάζεται νέα σελίδα
      const needed = lines.length * lineHeight + 12;
      if (y - needed < margin) {
        page = mergedPdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }

      for (const ln of lines) {
        try {
          page.drawText(ln, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
        } catch {
          // Αν κάποιος χαρακτήρας δεν υποστηρίζεται, αντικατάσταση
          const safe = ln.replace(/[^\x00-\x7F]/g, '?');
          page.drawText(safe, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
        }
        y -= lineHeight;
      }
      y -= 8; // Κενό μεταξύ ερωτήσεων
    }

    // ── 4. Επιστροφή PDF ──
    const finalBytes = await mergedPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName || 'print')}.pdf"`);
    return res.send(Buffer.from(finalBytes));

  } catch (e) {
    console.error('[print-with-questions]', e);
    return res.status(500).json({ error: 'Σφάλμα δημιουργίας PDF: ' + e.message });
  }
}
