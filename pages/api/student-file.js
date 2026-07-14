// pages/api/student-file.js
// Σερβίρει δημόσιο αρχείο από Drive χωρίς auth
// PDF/HTML → raw bytes (native browser rendering, ελαφρύ)
// DOCX/PPTX/XLSX → redirect σε Google Docs Viewer (χωρίς Drive JS)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id, gdoc, dl } = req.query;
  if (!id) return res.status(400).end();

  // ── Native Google αρχείο (Docs/Slides/Sheets) ──
  // Δεν έχει κατάληξη ούτε δυαδικό περιεχόμενο· το uc?export=download δεν το χειρίζεται.
  // Εντοπισμός τύπου με δοκιμή των δημόσιων export endpoints (200 + PDF μόνο στον σωστό
  // τύπο, για anyone:reader αρχεία) → 302 στο read-only /preview (cross-origin → «◀»).
  if (gdoc) {
    const safeId = encodeURIComponent(id);
    const probes = [
      ['document',     `https://docs.google.com/document/d/${safeId}/export?format=pdf`],
      ['presentation', `https://docs.google.com/presentation/d/${safeId}/export/pdf`],
      ['spreadsheets', `https://docs.google.com/spreadsheets/d/${safeId}/export?format=pdf`],
    ];
    for (const [type, probeUrl] of probes) {
      try {
        const p = await fetch(probeUrl, { redirect: 'follow' });
        const ct = p.headers.get('content-type') || '';
        try { p.body?.cancel?.(); } catch {}
        if (p.ok && ct.includes('pdf')) {
          res.setHeader('Cache-Control', 'public, s-maxage=3600');
          // dl=1 → κατέβασμα του PDF (redirect στο ίδιο το export URL)· αλλιώς read-only preview
          return res.redirect(302, dl ? probeUrl : `https://docs.google.com/${type}/d/${safeId}/preview`);
        }
      } catch {}
    }
    // Fallback: δεν είναι native Google (π.χ. δυαδικό με όνομα χωρίς κατάληξη) → Drive preview
    return res.redirect(302, `https://drive.google.com/file/d/${safeId}/preview`);
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`;

  try {
    const r = await fetch(downloadUrl, { redirect: 'follow' });
    if (!r.ok) return res.status(404).json({ error: 'Not found' });

    const contentType = r.headers.get('content-type') || '';
    const buffer = Buffer.from(await r.arrayBuffer());

    // Detect type
    const isPdf = contentType.includes('pdf') || buffer.slice(0,4).toString()==='%PDF';
    const isHtml = contentType.includes('text/html') || buffer.slice(0,50).toString().toLowerCase().includes('<html') || buffer.slice(0,50).toString().toLowerCase().includes('<!doctype');
    const isOffice = contentType.includes('officedocument') || contentType.includes('msword') || contentType.includes('ms-excel') || contentType.includes('ms-powerpoint');

    if (isPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).send(buffer);
    }

    if (isHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).send(buffer);
    }

    if (isOffice) {
      // Serve raw bytes — Office Online will fetch this URL and render the document
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).send(buffer);
    }

    // Fallback: serve raw
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).send(buffer);

  } catch (e) {
    console.error('[student-file]', e.message);
    return res.status(500).json({ error: 'Failed' });
  }
}
