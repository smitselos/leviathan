// pages/api/student-manifest.js
// GET ?m=MANIFEST_ID → returns the public manifest JSON
// Δεν απαιτεί σύνδεση — proxy για CORS
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { m } = req.query;
  if (!m) return res.status(400).json({ error: 'Missing manifest id' });

  try {
    const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(m)}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: 'Manifest not found' });
    const text = await r.text();
    const data = JSON.parse(text);
    // Cache 60s
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (e) {
    console.error('[student-manifest]', e.message);
    return res.status(500).json({ error: 'Failed to load manifest' });
  }
}
