// Προσθέτει στις HTML εφαρμογές τον μηχανισμό εκτύπωσης για iPhone/iPad (εφαρμογή αρχικής οθόνης).
// Το /apps/lib/lev-print.js ενεργοποιείται ΜΟΝΟ σε iOS web app· αλλού δεν κάνει τίποτα.
const TAG = '<script src="/apps/lib/lev-print.js"></script>';

export function injectLevPrint(html) {
  const s = typeof html === 'string' ? html : String(html || '');
  if (!s || s.includes('lev-print.js')) return s;
  // μόνο σε εφαρμογές που εκτυπώνουν
  if (!/window\.print\s*\(/.test(s)) return s;
  const head = /<head[^>]*>/i.exec(s);
  if (!head) return s;
  let pos = head.index + head[0].length;
  const charset = /<meta[^>]+charset[^>]*>/i.exec(s.slice(pos, pos + 600));
  if (charset) pos += charset.index + charset[0].length;
  return s.slice(0, pos) + '\n' + TAG + s.slice(pos);
}
