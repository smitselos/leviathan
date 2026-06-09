// pages/api/student-file.js
// Σερβίρει δημόσιο αρχείο από Drive χωρίς auth
// PDF/HTML → raw bytes (native browser rendering, ελαφρύ)
// DOCX/PPTX/XLSX → redirect σε Google Docs Viewer (χωρίς Drive JS)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id } = req.query;
  if (!id) return res.status(400).end();

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
      // Google Docs Viewer — πολύ πιο ελαφρύ από Drive preview, δεν χρειάζεται cookies
      const viewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(downloadUrl)}`;
      return res.redirect(302, viewUrl);
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
