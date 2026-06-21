// pages/api/doc-proxy.js
// Δημόσιο endpoint — proxy για publicly-shared αρχεία Drive
// Χρησιμοποιείται από τον Office Online viewer που χρειάζεται direct URL
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    // Κατέβασε από Google Drive (public share link)
    const driveUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
    const response = await fetch(driveUrl, { redirect: 'follow' });

    if (!response.ok) return res.status(404).json({ error: 'File not found or not public' });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (e) {
    console.error('[doc-proxy]', e.message);
    res.status(500).json({ error: 'Proxy failed' });
  }
}
