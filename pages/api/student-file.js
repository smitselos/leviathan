// pages/api/student-file.js
// GET ?id=FILE_ID → σερβίρει δημοσιευμένο αρχείο (χωρίς auth)
// Proxy για αρχεία που είναι shared publicly στο Drive
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`;
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return res.status(404).json({ error: 'File not found' });

    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await r.arrayBuffer());

    // Αν είναι HTML, σερβίρισέ το ως HTML
    const isHtml = contentType.includes('text/html') || id.endsWith('.html') || buffer.slice(0, 100).toString().trim().toLowerCase().startsWith('<!doctype') || buffer.slice(0, 100).toString().trim().startsWith('<html');
    
    res.setHeader('Content-Type', isHtml ? 'text/html; charset=utf-8' : contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('[student-file]', e.message);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
}
