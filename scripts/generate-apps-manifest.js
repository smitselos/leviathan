// scripts/generate-apps-manifest.js
// ─────────────────────────────────────────────────────────────────────────────
// Τρέχει ΑΥΤΟΜΑΤΑ σε κάθε build του Vercel (μέσω του "prebuild" στο package.json).
// Σαρώνει τον φάκελο public/apps και παράγει το public/apps-manifest.json,
// το οποίο διαβάζει ο ΛΕΒΙΑΘΑΝ για να εμφανίσει τις εφαρμογές.
//
// Δομή που αναγνωρίζει:
//   public/apps/Γλώσσα/quiz-metoxes.html          → εφαρμογή στον υποφάκελο «Γλώσσα»
//   public/apps/Λογοτεχνία/escape-room/index.html → εφαρμογή-φάκελος (με εικόνες, js κ.λπ.)
//   public/apps/kati.html                         → εφαρμογή στη ρίζα των Εφαρμογών
//
// Το όνομα κάθε εφαρμογής προκύπτει από το <title> του HTML (αν υπάρχει),
// αλλιώς από το όνομα του αρχείου.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const APPS_DIR = path.join(process.cwd(), 'public', 'apps');
const OUT = path.join(process.cwd(), 'public', 'apps-manifest.json');

const isHtml = (n) => /\.html?$/i.test(n);
const nameFromFile = (n) => n.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();

function titleOf(file, fallback) {
  try {
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m && m[1].trim()) return m[1].trim();
  } catch (e) {}
  return fallback;
}

// Εφαρμογές μέσα σε έναν υποφάκελο: μονά .html + φάκελοι-εφαρμογές με index.html
function appsIn(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'el'))) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && isHtml(e.name)) {
      out.push({ name: titleOf(full, nameFromFile(e.name)), path: rel + '/' + e.name });
    } else if (e.isDirectory()) {
      const idx = ['index.html', 'index.htm'].find((n) => fs.existsSync(path.join(full, n)));
      if (idx) out.push({ name: titleOf(path.join(full, idx), nameFromFile(e.name)), path: rel + '/' + e.name + '/' + idx });
    }
  }
  return out;
}

function build() {
  let root = [], folders = [];
  if (fs.existsSync(APPS_DIR)) {
    for (const e of fs.readdirSync(APPS_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'el'))) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(APPS_DIR, e.name);
      if (e.isFile() && isHtml(e.name)) {
        root.push({ name: titleOf(full, nameFromFile(e.name)), path: e.name });
      } else if (e.isDirectory()) {
        const idx = ['index.html', 'index.htm'].find((n) => fs.existsSync(path.join(full, n)));
        if (idx) root.push({ name: titleOf(path.join(full, idx), nameFromFile(e.name)), path: e.name + '/' + idx }); // φάκελος-εφαρμογή στη ρίζα
        else folders.push({ name: e.name, apps: appsIn(full, e.name) }); // κανονικός υποφάκελος-κατηγορία
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), folders, root }, null, 2));
  const total = root.length + folders.reduce((s, f) => s + f.apps.length, 0);
  console.log('apps-manifest.json: ' + folders.length + ' υποφάκελοι, ' + total + ' εφαρμογές');
}

build();
