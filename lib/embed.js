// lib/embed.js — Μετατροπή συνδέσμων βίντεο σε μορφή ενσωμάτωσης (iframe).
// Κοινό για τη σελίδα Live (μαθητές) και την προεπισκόπηση του εκπαιδευτικού,
// ώστε να συμπεριφέρονται ΙΔΙΑ.
//
// YouTube: youtu.be/ID · youtube.com/watch?v=ID · /shorts/ID · /live/ID · ήδη /embed/
// Vimeo:   vimeo.com/ID · vimeo.com/ID/HASH (μη καταχωρισμένο) · vimeo.com/channels/x/ID
//          · vimeo.com/groups/x/videos/ID · ήδη player.vimeo.com/video/ID
// Οτιδήποτε άλλο επιστρέφεται ως έχει.
export function toEmbedUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');

    // ── YouTube ──
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.pathname.startsWith('/embed/')) return url; // ήδη embed
      else if (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/')) id = u.pathname.split('/')[2];
    }
    if (id) {
      const t = u.searchParams.get('t') || u.searchParams.get('start');
      const start = t ? `?start=${parseInt(t, 10) || 0}` : '';
      return `https://www.youtube.com/embed/${id}${start}`;
    }

    // ── Vimeo ──
    if (host === 'player.vimeo.com') return url; // ήδη embed
    if (host === 'vimeo.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.findIndex((p) => /^\d+$/.test(p));
      if (i !== -1) {
        const next = parts[i + 1];
        const hash = next && /^[0-9a-f]+$/i.test(next) ? next : u.searchParams.get('h') || '';
        return `https://player.vimeo.com/video/${parts[i]}${hash ? '?h=' + hash : ''}`;
      }
    }
  } catch {}
  return url;
}
