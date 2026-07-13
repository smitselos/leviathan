// pages/index.js — ΛΕΒΙΑΘΑΝ Light
// Λειτουργίες: 📡 Live · 🌍 Μοίρασμα (δημόσιο ή προσωπικό σε μαθητή) · 📷 Φωτό · 📚 Βιβλιοθήκη
// Σύνδεση με Gmail (NextAuth). Χωρίς βιβλιοθήκη, ετικέτες, σχόλια, μαθητές, επεξεργασία.
//
// Ροή Live:      ανέβασμα αρχείου (ή σύνδεσμος) → PDF → κωδικός PIN → προβολή στον διαδραστικό (/live?code=…)
// Ροή Μοίρασμα:  ανέβασμα αρχείου → PDF → εμφανίζεται στη δημόσια σελίδα /s/{όνομα}
//
// «Δεν αποθηκεύεται τίποτε»: τα αρχεία του Live μπαίνουν στο Drive με πρόθεμα live-tmp-
// και καθαρίζονται αυτόματα (>24h) στην επόμενη σύνδεση. Τα μοιρασμένα μένουν ΜΟΝΟ
// όσο είναι στη δημόσια σελίδα — το ✕ τα αφαιρεί και από το Drive.
//
// Χωρίς πρόσθετες εξαρτήσεις: το JSZip φορτώνεται από CDN μόνο όταν ανέβει .pages/.key

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

/* ── Βοηθητικά ── */
const IWORK_RE = /\.(pages|key|numbers)(\.zip)?$/i;   // και .pages.zip: έτσι παραδίδει το iOS τα πακέτα iWork
const ZIP_RE = /\.zip$/i;
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.pages,.key,.numbers,.zip,image/*';

const cleanName = (n) => n.replace(/^live-tmp-\d+-/, '').replace(/\.(pdf|docx?|pptx?|xlsx?|pages|key)$/i, '');

// Ομαλοποίηση ψευδομέιλ μαθητή: πεζά, χωρίς κενά, με @gmail.com αν λείπει το @
const normEmail = (s) => { const v = (s || '').trim().toLowerCase(); if (!v) return ''; return v.includes('@') ? v : v + '@gmail.com'; };
// Πολλαπλά ψευδομέιλ: χωρισμός με κόμμα/κενό/;/newline → κανονικοποίηση → μοναδικά
const parseRecipients = (s) => [...new Set((s || '').split(/[\s,;]+/).map(normEmail).filter(Boolean))];
// visibility για 1 ή περισσότερους παραλήπτες — ο server δέχεται και «user:» και «users:» (JSON λίστα)
const visForRecipients = (arr) => arr.length === 1 ? 'user:' + arr[0] : 'users:' + JSON.stringify(arr);

// PWA-safe άνοιγμα (ίδια λογική με τη σελίδα μαθητή): σε εγκατεστημένο PWA (standalone)
// χρήση location.href ώστε το iOS να δίνει μονοβηματική επιστροφή «◀»· αλλιώς νέα καρτέλα.
function openExternal(url) {
  const standalone = typeof window !== 'undefined' && (
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
  if (standalone) { window.location.href = url; }
  else { window.open(url, '_blank'); }
}

// Φόρτωση JSZip από CDN κατά ζήτηση (καμία εξάρτηση στο package.json)
let _jszipPromise = null;
function loadJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return Promise.resolve(window.JSZip);
  if (!_jszipPromise) {
    _jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => { _jszipPromise = null; reject(new Error('Αποτυχία φόρτωσης JSZip')); };
      document.head.appendChild(s);
    });
  }
  return _jszipPromise;
}

// .pages/.key = πακέτο ZIP με ενσωματωμένο QuickLook/Preview.pdf → το εξάγουμε στον browser
async function iworkToPdf(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const hit = zip.file(/quicklook\/preview\.pdf$/i)[0];   // πιάνει και «Όνομα.pages/QuickLook/Preview.pdf»
  if (!hit) return null;
  const blob = await hit.async('blob');
  const base = file.name.replace(IWORK_RE, '').replace(ZIP_RE, '');
  return new File([blob], base + '.pdf', { type: 'application/pdf' });
}

async function prepareFile(file) {
  if (IWORK_RE.test(file.name) || ZIP_RE.test(file.name)) {
    try {
      const pdf = await iworkToPdf(file);
      if (pdf) return pdf;
    } catch {}
    if (IWORK_RE.test(file.name)) {
      alert(`Το «${file.name}» δεν περιέχει ενσωματωμένη προεπισκόπηση PDF.\n\nΆνοιξέ το στο Pages/Keynote και κάνε Εξαγωγή → PDF, μετά ανέβασε το PDF.`);
    } else {
      alert(`Το «${file.name}» δεν είναι έγγραφο iWork με προεπισκόπηση PDF — δεν υποστηρίζεται.`);
    }
    return null;
  }
  return file; // PDF/Office/εικόνες: όπως είναι (τα Office αποδίδονται ως PDF από το pipeline προβολής)
}

/* ── Φόρτωση pdf-lib από CDN κατά ζήτηση (όπως το JSZip — καμία εξάρτηση στο package.json) ── */
let _pdfLibPromise = null;
function loadPdfLib() {
  if (typeof window !== 'undefined' && window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!_pdfLibPromise) {
    _pdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
      s.onload = () => resolve(window.PDFLib);
      s.onerror = () => { _pdfLibPromise = null; reject(new Error('Αποτυχία φόρτωσης pdf-lib')); };
      document.head.appendChild(s);
    });
  }
  return _pdfLibPromise;
}

/* ── Συμπίεση φωτογραφίας μέσω canvas (μέγ. 1600px, JPEG 0.8) — διορθώνει και τον προσανατολισμό EXIF ── */
function photoToJpeg(file, maxSide = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Αποτυχία συμπίεσης εικόνας')), 'image/jpeg', quality);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Μη αναγνώσιμη εικόνα: ' + file.name)); };
    img.src = url;
  });
}

/* ── Συγχώνευση φωτογραφιών σε ενιαίο PDF (μία σελίδα ανά φωτογραφία) ── */
async function photosToPdf(files, name) {
  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const jpeg = await photoToJpeg(f);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const image = await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const out = await pdf.save();
  const fname = /\.pdf$/i.test(name) ? name : name + '.pdf';
  return new File([out], fname, { type: 'application/pdf' });
}

/* ── Χρώματα (κρέμ παλέτα ΛΕΒΙΑΘΑΝ) ── */
const C = {
  bg: '#f7f5f0', card: '#ffffff', line: '#ebebeb',
  ink: '#1a1a1a', sub: '#6b6b80', mut: '#aeaeb8',
  cream: '#8a7d4a', creamBg: '#faf6ea', creamLine: '#e8e0c8',
  live: '#e8c96a', dark: '#1a1a1a', red: '#dc2626', green: '#16a34a',
};

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mode, setMode] = useState('live');            // 'live' | 'share' | 'photo' | 'library'
  const [rootId, setRootId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [busy, setBusy] = useState('');                // '' | 'live' | 'share' | 'load'

  // Live
  const [liveFiles, setLiveFiles] = useState([]);      // File[] (μετά το prepare)
  const [liveUrls, setLiveUrls] = useState([]);        // [{url,name}]
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [liveCode, setLiveCode] = useState(null);
  const [liveCount, setLiveCount] = useState(0);       // πόσα στοιχεία έχει το ενεργό live
  const [liveDriveItems, setLiveDriveItems] = useState([]); // [{id,name}] από τη Βιβλιοθήκη προς Live (ήδη στο Drive)

  // Μοίρασμα
  const [shared, setShared] = useState([]);            // δημόσια αρχεία (από registry, αόρατο υπόβαθρο)
  const [shareDone, setShareDone] = useState(false);

  // Προσωπικό — αποστολή σε συγκεκριμένο μαθητή (visibility: user:<ψευδομέιλ>)
  const [recipient, setRecipient] = useState('');      // ψευδομέιλ μαθητή
  const [personalMsg, setPersonalMsg] = useState('');  // προαιρετικό μήνυμα ✉️
  const [personalDone, setPersonalDone] = useState(false);
  const [personal, setPersonal] = useState([]);        // ενεργές προσωπικές αποστολές

  // Βιβλιοθήκη (προαιρετική) & Σετ
  const [libOn, setLibOn] = useState(false);           // ενεργοποιημένη; (τοπική προτίμηση συσκευής)

  /* ── ΦΩΤΟ → PDF ── */
  const [photos, setPhotos] = useState([]);            // [{ file, url }] — λήψεις με μικρογραφίες
  const [photoName, setPhotoName] = useState('');      // προαιρετικό όνομα PDF
  const [photoPdf, setPhotoPdf] = useState(null);      // έτοιμο File PDF → οθόνη επιλογής προορισμού
  const photoInputRef = useRef(null);
  const [library, setLibrary] = useState([]);          // ΟΛΑ τα αρχεία του registry (δημόσια + μη)
  const [sets, setSets] = useState([]);                // αποθηκευμένα σετ [{id,name}] — JSON αρχεία στο Drive

  const publicPath = '/s/' + (session?.user?.email?.split('@')[0] || '');

  /* ── Σύνδεση / αρχικοποίηση ── */
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (session?.error === 'RefreshAccessTokenError') signOut({ callbackUrl: '/login?reauth=1' });
  }, [status, session, router]);

  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const loadShared = useCallback(async () => {
    try {
      const r = await fetch('/api/registry');
      const d = await r.json();
      setLibrary(d.files || []); // πλήρης λίστα — τη βλέπει η Βιβλιοθήκη
      setShared((d.files || []).filter((x) => x.visibility === 'public'));
      setPersonal((d.files || []).filter((x) => /^users?:/.test(x.visibility || '')));
    } catch {}
  }, []);

  // ── Σετ: μικρά JSON αρχεία «live-set-*.json» στον φάκελο της εφαρμογής στο Drive ──
  const loadSets = useCallback(async () => {
    if (!session?.accessToken || !rootId) return;
    try {
      const q = encodeURIComponent(`name contains 'live-set-' and '${rootId}' in parents and trashed=false`);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=createdTime desc`,
        { headers: { Authorization: 'Bearer ' + session.accessToken } });
      const d = await r.json();
      setSets((d.files || []).map((f) => ({ id: f.id, name: f.name.replace(/^live-set-/, '').replace(/\.json$/i, '') })));
    } catch {}
  }, [session, rootId]);

  // Καθάρισμα προσωρινών του Live (>24 ωρών) — τρέχει αθόρυβα στη σύνδεση
  const cleanupTemp = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const q = encodeURIComponent("name contains 'live-tmp-' and trashed=false");
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,createdTime)`,
        { headers: { Authorization: 'Bearer ' + session.accessToken } });
      const d = await r.json();
      const cutoff = Date.now() - 24 * 3600 * 1000;
      for (const f of d.files || []) {
        if (new Date(f.createdTime).getTime() < cutoff) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
          }).catch(() => {});
        }
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      setBusy('load');
      try {
        const r = await fetch('/api/folders');       // δίνει rootId (ο κορμός μένει, αόρατος)
        const d = await r.json();
        setRootId(d.rootId || null);
      } catch {}
      await loadShared();
      setBusy('');
      cleanupTemp();
    })();
  }, [status, loadShared, cleanupTemp]);

  // ── Βιβλιοθήκη: επαναφορά προτίμησης + φόρτωση σετ ──
  useEffect(() => {
    try { if (localStorage.getItem('leviathan_light_library') === '1') setLibOn(true); } catch {}
  }, []);
  useEffect(() => { if (libOn) loadSets(); }, [libOn, loadSets]);

  // ── Επαναφορά ενεργού Live (π.χ. μετά από ανανέωση σελίδας) — ο server ξέρει το live_active:{email} ──
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const r = await fetch('/api/live?active=1');
        if (!r.ok) return;
        const d = await r.json();
        if (d.code) {
          setLiveCode(d.code);
          setLiveCount(d.data ? 1 + (d.data.links || []).length : 0);
        }
      } catch {}
    })();
  }, [status]);

  /* ── Ανέβασμα στο Drive (multipart, με το token του χρήστη) ── */
  const uploadToDrive = async (file, prefix = '') => {
    const metadata = { name: prefix + file.name, mimeType: file.type || 'application/octet-stream', parents: [rootId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      { method: 'POST', headers: { Authorization: 'Bearer ' + session.accessToken }, body: form });
    const doc = await res.json();
    if (!doc.id) throw new Error(doc.error?.message || 'Αποτυχία ανεβάσματος');
    return doc;
  };

  /* ── LIVE: ανέβασμα → PDF → κωδικός ── */
  const pickLiveFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    const ok = [];
    for (const f of list) { const p = await prepareFile(f); if (p) ok.push(p); }
    if (ok.length) setLiveFiles((prev) => [...prev, ...ok]); // το liveCode μένει — μπορεί να γίνει προσθήκη στο ενεργό live
  };

  const addUrl = () => {
    let u = urlInput.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    setLiveUrls((p) => [...p, { url: u, name: urlName.trim() || u.replace(/^https?:\/\//, '').slice(0, 40) }]);
    setUrlInput(''); setUrlName('');
  };

  // Συγκέντρωση της τρέχουσας σύνθεσης σε items[] — ανεβάζει ό,τι είναι τοπικό
  // prefix: 'live-tmp-…' για εφήμερα, '' για μόνιμα (βιβλιοθήκη)
  const buildItems = async (prefix) => {
    const items = [];
    for (const it of liveDriveItems) items.push({ kind: 'file', id: it.id, name: it.name });
    const uploaded = [];
    for (const f of liveFiles) {
      const doc = await uploadToDrive(f, prefix);
      items.push({ kind: 'file', id: doc.id, name: cleanName(f.name) });
      uploaded.push(doc);
    }
    for (const u of liveUrls) items.push({ kind: 'url', url: u.url, name: u.name });
    return { items, uploaded };
  };

  const compositionEmpty = !liveFiles.length && !liveUrls.length && !liveDriveItems.length;

  const startLive = async () => {
    if (compositionEmpty || busy || !rootId) return;
    setBusy('live'); setLiveCode(null);
    try {
      const { items } = await buildItems('live-tmp-' + Date.now() + '-');
      const r = await fetch('/api/live', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, title: items[0]?.name || 'Live' }),
      });
      const d = await r.json();
      if (d.code) { setLiveCode(d.code); setLiveCount(items.length); setLiveFiles([]); setLiveUrls([]); setLiveDriveItems([]); }
      else alert(d.error || 'Δεν δόθηκε κωδικός — δοκίμασε ξανά.');
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  /* ── LIVE: προσθήκη ΝΕΩΝ στοιχείων στο ήδη ενεργό live (PATCH /api/live) ── */
  const addToLive = async () => {
    if (compositionEmpty || busy || !rootId || !liveCode) return;
    setBusy('add');
    try {
      const { items } = await buildItems('live-tmp-' + Date.now() + '-');
      for (const it of items) {
        const r = await fetch('/api/live', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: it, code: liveCode }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          alert('✗ ' + (d.error || 'Σφάλμα προσθήκης στο live'));
          if (r.status === 404) { setLiveCode(null); setLiveCount(0); } // το live έληξε
          setBusy('');
          return;
        }
        setLiveCount((c) => c + 1);
      }
      setLiveFiles([]); setLiveUrls([]); setLiveDriveItems([]);
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  /* ── LIVE: τερματισμός (DELETE /api/live) ── */
  const stopLive = async () => {
    if (!confirm('Να τερματιστεί το ενεργό Live; Οι θεατές θα χάσουν την πρόσβαση.')) return;
    try { await fetch('/api/live', { method: 'DELETE' }); } catch {}
    setLiveCode(null); setLiveCount(0);
  };

  /* ── ΣΕΤ: αποθήκευση της τρέχουσας σύνθεσης ως επαναχρησιμοποιήσιμο σετ ── */
  const saveAsSet = async () => {
    if (compositionEmpty || busy || !rootId) return;
    if (!libOn) {
      if (!confirm('Τα σετ χρειάζονται τη Βιβλιοθήκη: τα αρχεία τους μένουν μόνιμα στο Google Drive σου (δεν σβήνονται σε 24 ώρες). Να ενεργοποιηθεί;')) return;
      activateLibrary();
    }
    const name = (prompt('Όνομα σετ (π.χ. «Αντιγόνη — Γ2»):') || '').trim();
    if (!name) return;
    setBusy('set');
    try {
      // Τα τοπικά αρχεία ανεβαίνουν ΜΟΝΙΜΑ (χωρίς live-tmp-) και μπαίνουν στη βιβλιοθήκη —
      // αλλιώς το σετ θα «έσπαγε» μόλις καθαριστούν τα προσωρινά.
      const converted = [];
      const added = [];
      for (const f of liveFiles) {
        const doc = await uploadToDrive(f);
        converted.push({ id: doc.id, name: cleanName(doc.name) });
        added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId });
      }
      if (added.length) {
        await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: added }) });
      }
      const items = [
        ...liveDriveItems.map((it) => ({ kind: 'file', id: it.id, name: it.name })),
        ...converted.map((it) => ({ kind: 'file', id: it.id, name: it.name })),
        ...liveUrls.map((u) => ({ kind: 'url', url: u.url, name: u.name })),
      ];
      const json = new File([JSON.stringify({ name, items }, null, 2)], `live-set-${name}.json`, { type: 'application/json' });
      await uploadToDrive(json);
      // Η σύνθεση διατηρείται — τα τοπικά αρχεία έγιναν πλέον στοιχεία βιβλιοθήκης
      setLiveFiles([]);
      setLiveDriveItems((p) => [...p, ...converted]);
      await loadShared(); await loadSets();
      alert(`✓ Το σετ «${name}» αποθηκεύτηκε — θα το βρίσκεις στη Βιβλιοθήκη.`);
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  /* ── ΣΕΤ: εκκίνηση Live από αποθηκευμένο σετ ── */
  const launchSet = async (s) => {
    if (busy) return;
    setBusy('live'); setLiveCode(null); setMode('live');
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${s.id}?alt=media`,
        { headers: { Authorization: 'Bearer ' + session.accessToken } });
      const data = await r.json();
      const items = []; const missing = [];
      for (const it of data.items || []) {
        if (it.kind === 'file') {
          // Έλεγχος ύπαρξης + αθόρυβη ανανέωση ονόματος από το Drive
          const c = await fetch(`https://www.googleapis.com/drive/v3/files/${it.id}?fields=id,name,trashed`,
            { headers: { Authorization: 'Bearer ' + session.accessToken } });
          const f = c.ok ? await c.json() : null;
          if (f && !f.trashed) items.push({ kind: 'file', id: it.id, name: cleanName(f.name) || it.name });
          else missing.push(it.name);
        } else items.push(it);
      }
      if (missing.length) alert('Λείπουν από τη βιβλιοθήκη και παραλείπονται: ' + missing.join(', '));
      if (!items.length) { alert('Το σετ δεν έχει κανένα διαθέσιμο στοιχείο.'); setBusy(''); return; }
      const rr = await fetch('/api/live', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, title: items[0].name }),
      });
      const d = await rr.json();
      if (d.code) { setLiveCode(d.code); setLiveCount(items.length); }
      else alert(d.error || 'Δεν δόθηκε κωδικός — δοκίμασε ξανά.');
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  const deleteSet = async (s) => {
    if (!confirm(`Να διαγραφεί το σετ «${s.name}»; (Τα αρχεία του μένουν στη βιβλιοθήκη.)`)) return;
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${s.id}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
      loadSets();
    } catch {}
  };

  /* ── ΒΙΒΛΙΟΘΗΚΗ ── */
  const activateLibrary = () => {
    setLibOn(true);
    try { localStorage.setItem('leviathan_light_library', '1'); } catch {}
  };
  const hideLibrary = () => {
    setLibOn(false);
    try { localStorage.removeItem('leviathan_light_library'); } catch {}
    setMode('live');
  };

  const pickLibFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length || busy || !rootId) return;
    setBusy('lib');
    try {
      const added = [];
      for (const f of list) {
        const p = await prepareFile(f); if (!p) continue;
        const doc = await uploadToDrive(p); // ΧΩΡΙΣ live-tmp- πρόθεμα — μόνιμο
        added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId });
      }
      if (added.length) {
        await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: added }) });
        await loadShared();
      }
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  const isPublicFile = (f) => f.visibility === 'public';
  const isPersonalFile = (f) => /^users?:/.test(f.visibility || '');
  const personalRecipients = (f) => {
    const v = f.visibility || '';
    if (v.startsWith('users:')) { try { return JSON.parse(v.slice(6)); } catch { return []; } }
    if (v.startsWith('user:')) return [v.slice(5)];
    return [];
  };
  const personalRecipient = (f) => personalRecipients(f).join(', ');

  // Δημοσίευση με έλεγχο μετατροπής PDF: αν ο server επιστρέψει pdfFailed,
  // ο καθηγητής ειδοποιείται ότι οι μαθητές θα κατεβάζουν το Office αντί να βλέπουν PDF.
  const publishFile = async (id, visibility, message, name) => {
    const body = { id, visibility };
    if (message !== undefined) body.message = message;
    const r = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (d.pdfFailed) {
      alert(`⚠️ Το «${cleanName(name || '')}» δημοσιεύτηκε, αλλά η μετατροπή σε PDF απέτυχε.\n\nΟι μαθητές θα το κατεβάζουν ως αρχείο Office αντί να το βλέπουν ως PDF.\n\nΔοκίμασε απόσυρση και εκ νέου δημοσίευση. Αν επιμένει, το αρχείο ίσως είναι πολύ μεγάλο (όριο PDF ~10MB) ή προστατευμένο — μετάτρεψέ το σε PDF και ανέβασε εκείνο.`);
    }
    return d;
  };

  const togglePublic = async (f) => {
    try {
      await publishFile(f.id, isPublicFile(f) ? 'none' : 'public', undefined, f.name);
      await loadShared();
    } catch {}
  };

  const removeFromLibrary = async (f) => {
    if (!confirm(`Να διαγραφεί οριστικά το «${cleanName(f.name)}» από τη βιβλιοθήκη και το Drive;${isPublicFile(f) ? '\n(Θα φύγει και από τη δημόσια σελίδα.)' : isPersonalFile(f) ? '\n(Θα πάψει να το βλέπει και ο μαθητής.)' : ''}`)) return;
    try {
      if (isPublicFile(f) || isPersonalFile(f)) await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
      await fetch('/api/registry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, deleteFromDrive: true }) });
      setLiveDriveItems((p) => p.filter((x) => x.id !== f.id));
      await loadShared();
    } catch {}
  };

  const addLibToLive = (f) => {
    setLiveDriveItems((p) => p.find((x) => x.id === f.id) ? p : [...p, { id: f.id, name: cleanName(f.name) }]);
  };

  // Άνοιγμα αρχείου βιβλιοθήκης — ίδια λογική με τη σελίδα μαθητή:
  // όλα προβάλλονται ως PDF μέσω Drive preview (PWA-safe, με επιστροφή στην εφαρμογή).
  // Office: έτοιμο PDF αντίγραφο (pdfId) αν υπάρχει, αλλιώς μετατροπή on-the-fly.
  const openLibFile = (f) => {
    const isHtml = /\.html?$/i.test(f.name);
    const isOffice = /\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    if (isHtml) { openExternal(`/api/student-file?id=${f.id}`); return; }
    if (isOffice) {
      if (f.pdfId) { openExternal(`https://drive.google.com/file/d/${f.pdfId}/preview`); return; }
      openExternal(`/api/inbox-pdf?id=${f.id}&name=${encodeURIComponent(f.name)}`);
      return;
    }
    openExternal(`https://drive.google.com/file/d/${f.id}/preview`);
  };

  /* ── ΜΟΙΡΑΣΜΑ: ανέβασμα → PDF → δημόσια σελίδα ── */
  const pickShareFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length || busy || !rootId) return;
    setBusy('share'); setShareDone(false);
    try {
      const added = [];
      for (const f of list) {
        const p = await prepareFile(f); if (!p) continue;
        const doc = await uploadToDrive(p);
        added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId });
      }
      if (added.length) {
        await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: added }) });
        for (const a of added) {
          await publishFile(a.id, 'public', undefined, a.name);
        }
        await loadShared();
        setShareDone(true);
      }
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  const unshare = async (f) => {
    // Με ενεργή Βιβλιοθήκη το ✕ ΔΕΝ διαγράφει το αρχείο — απλώς το αποσύρει από τη δημόσια σελίδα
    if (libOn) {
      if (!confirm(`Να αφαιρεθεί το «${cleanName(f.name)}» από τη δημόσια σελίδα;\n(Μένει στη Βιβλιοθήκη σου.)`)) return;
      try {
        await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
        await loadShared();
      } catch {}
      return;
    }
    if (!confirm(`Να αφαιρεθεί το «${cleanName(f.name)}» από τη δημόσια σελίδα;\n(Θα διαγραφεί — δεν κρατιέται πουθενά.)`)) return;
    try {
      await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
      await fetch('/api/registry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, deleteFromDrive: true }) });
      await loadShared();
    } catch {}
  };

  /* ── ΠΡΟΣΩΠΙΚΟ: ανέβασμα → PDF → ορατό ΜΟΝΟ στον μαθητή με το ψευδομέιλ ── */
  const pickPersonalFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    const rcpts = parseRecipients(recipient);
    if (!list.length || busy || !rootId || !rcpts.length) return;
    setBusy('personal'); setPersonalDone(false);
    try {
      const added = [];
      for (const f of list) {
        const p = await prepareFile(f); if (!p) continue;
        const doc = await uploadToDrive(p);
        added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId });
      }
      if (added.length) {
        await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: added }) });
        for (const a of added) {
          await publishFile(a.id, visForRecipients(rcpts), personalMsg.trim(), a.name);
        }
        await loadShared();
        setPersonalDone(true); setPersonalMsg('');
      }
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  // Ανάκληση προσωπικής αποστολής — με Βιβλιοθήκη το αρχείο μένει, αλλιώς διαγράφεται
  const unpersonal = async (f) => {
    const who = personalRecipient(f);
    if (libOn) {
      if (!confirm(`Να πάψει ο/η ${who} να βλέπει το «${cleanName(f.name)}»;\n(Μένει στη Βιβλιοθήκη σου.)`)) return;
      try {
        await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
        await loadShared();
      } catch {}
      return;
    }
    if (!confirm(`Να πάψει ο/η ${who} να βλέπει το «${cleanName(f.name)}»;\n(Θα διαγραφεί — δεν κρατιέται πουθενά.)`)) return;
    try {
      await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
      await fetch('/api/registry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, deleteFromDrive: true }) });
      await loadShared();
    } catch {}
  };

  // ΒΙΒΛΙΟΘΗΚΗ → προσωπική αποστολή υπάρχοντος αρχείου σε μαθητή
  const sendLibToStudent = async (f) => {
    const rcpts = parseRecipients(prompt(`Ψευδομέιλ μαθητή/-ών για το «${cleanName(f.name)}»\n(πολλά χωρισμένα με κόμμα):`) || '');
    if (!rcpts.length) return;
    if (isPublicFile(f) && !confirm('Το αρχείο είναι τώρα δημόσιο — θα γίνει προσωπικό και θα φύγει από τη δημόσια σελίδα. Συνέχεια;')) return;
    const msg = (prompt('✉️ Μήνυμα προς τον/τους μαθητή/-ές (προαιρετικό):') || '').trim();
    try {
      const d = await publishFile(f.id, visForRecipients(rcpts), msg, f.name);
      await loadShared();
      if (!d.pdfFailed) alert(`✓ Το «${cleanName(f.name)}» στάλθηκε προσωπικά σε: ${rcpts.join(', ')}.`);
    } catch (err) { alert('Σφάλμα: ' + err.message); }
  };

  /* ── ΦΩΤΟ → PDF: λήψεις → ενιαίο PDF → επιλογή προορισμού ── */
  const pickPhotos = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!list.length) return;
    setPhotos((prev) => [...prev, ...list.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  };

  const removePhoto = (i) => setPhotos((prev) => {
    URL.revokeObjectURL(prev[i].url);
    return prev.filter((_, x) => x !== i);
  });

  const clearPhotos = () => setPhotos((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return []; });

  const finishPhotos = async () => {
    if (!photos.length || busy) return;
    setBusy('photo');
    try {
      const d = new Date();
      const auto = `Φωτογραφίες ${d.getDate()}-${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
      const pdf = await photosToPdf(photos.map((p) => p.file), photoName.trim() || auto);
      setPhotoPdf(pdf); // ανοίγει η οθόνη επιλογής προορισμού
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  // Προορισμός 1 — Live: το PDF μπαίνει στη σύνθεση του Live (Έναρξη ή Προσθήκη από εκεί)
  const photoPdfToLive = () => {
    if (!photoPdf) return;
    setLiveFiles((prev) => [...prev, photoPdf]);
    setPhotoPdf(null); clearPhotos(); setPhotoName('');
    setMode('live');
  };

  // Προορισμός 2 — Μοίρασμα: ανέβασμα, καταχώριση, δημοσίευση στη δημόσια σελίδα
  const photoPdfToShare = async () => {
    if (!photoPdf || busy || !rootId) return;
    setBusy('photo-share');
    try {
      const doc = await uploadToDrive(photoPdf); // ΧΩΡΙΣ live-tmp- — μένει όσο είναι δημόσιο
      await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId }] }) });
      await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: doc.id, visibility: 'public' }) });
      await loadShared();
      setPhotoPdf(null); clearPhotos(); setPhotoName('');
      setShareDone(true); setMode('share');
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  // Προορισμός 3 — Αποθήκευση: μόνιμα στη Βιβλιοθήκη (με ερώτηση ενεργοποίησης αν είναι κλειστή)
  const photoPdfToLibrary = async () => {
    if (!photoPdf || busy || !rootId) return;
    if (!libOn) {
      if (!confirm('Η αποθήκευση χρειάζεται τη Βιβλιοθήκη: το αρχείο μένει μόνιμα στο Google Drive σου (δεν σβήνεται σε 24 ώρες). Να ενεργοποιηθεί;')) return;
      activateLibrary();
    }
    setBusy('photo-save');
    try {
      const doc = await uploadToDrive(photoPdf); // ΧΩΡΙΣ live-tmp- — μόνιμο, δεν το σαρώνει ο καθαρισμός
      await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId }] }) });
      await loadShared();
      setPhotoPdf(null); clearPhotos(); setPhotoName('');
      setMode('library');
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  /* ── UI ── */
  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sub, fontFamily: 'system-ui' }}>Φόρτωση…</div>;
  }

  const S = {
    wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      paddingBottom: isMobile ? 112 : 40 },
    inner: { maxWidth: isMobile ? 640 : 880, margin: '0 auto', padding: isMobile ? '20px 16px' : '36px 24px' },
    // ── Κάτω μπάρα (mobile) ──
    mobBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: C.dark, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '14px 0 max(14px,env(safe-area-inset-bottom))', zIndex: 300, borderTop: '1px solid rgba(255,255,255,0.06)' },
    card: { background: C.card, border: '1px solid ' + C.line, borderRadius: 16, padding: isMobile ? 16 : 20, marginBottom: 16 },
    h1: { fontSize: isMobile ? 20 : 24, fontWeight: 700, color: C.ink, margin: 0 },
    sub: { fontSize: 13, color: C.sub, margin: '4px 0 0' },
    tab: (on) => ({ flex: 1, padding: '13px 10px', borderRadius: 14, border: '2px solid ' + (on ? C.cream : C.line), background: on ? C.creamBg : '#fff', color: on ? C.cream : C.sub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }),
    upBtn: { display: 'block', width: '100%', padding: '26px 14px', borderRadius: 14, border: '2px dashed ' + C.creamLine, background: C.creamBg, color: C.cream, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' },
    go: (on) => ({ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: on ? C.dark : '#e0e0e0', color: '#fff', fontSize: 15, fontWeight: 600, cursor: on ? 'pointer' : 'default' }),
    row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fff', border: '1px solid ' + C.creamLine, borderRadius: 12 },
    x: { background: 'none', border: 'none', color: C.mut, cursor: 'pointer', fontSize: 13, flexShrink: 0 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: isMobile ? 16 : 13, boxSizing: 'border-box' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>

        {/* Κεφαλίδα — στο desktop: Ανοιχτή πρόσβαση + Έξοδος δεξιά· στο κινητό είναι στην κάτω μπάρα */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={S.h1}>ΛΕΒΙΑΘΑΝ <span style={{ fontWeight: 400, color: C.cream }}>light</span></h1>
            <p style={S.sub}>Γεια σου, {session.user?.name || session.user?.email} 👋</p>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push(publicPath)}
                style={{ background: 'none', border: 'none', color: C.cream, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                🌍 Ανοιχτή πρόσβαση
              </button>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ background: 'none', border: '1px solid ' + C.line, borderRadius: 10, padding: '8px 14px', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Έξοδος
              </button>
            </div>
          )}
        </div>

        {/* Λειτουργίες — στο desktop και οι τέσσερις· στο κινητό η Βιβλιοθήκη ζει στην κάτω μπάρα */}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 10, marginBottom: 18 }}>
          <button style={S.tab(mode === 'live')} onClick={() => setMode('live')}>📡 Live</button>
          <button style={S.tab(mode === 'share')} onClick={() => setMode('share')}>🌍 Μοίρασμα</button>
          <button style={S.tab(mode === 'photo')} onClick={() => setMode('photo')}>📷 Φωτό</button>
          {!isMobile && (
            <button onClick={() => setMode('library')}
              style={{ ...S.tab(mode === 'library'),
                ...(mode === 'library'
                  ? { background: C.dark, borderColor: C.dark, color: C.live }
                  : { color: C.sub }) }}>
              📚 Βιβλιοθήκη
            </button>
          )}
        </div>

        {/* ═══ LIVE ═══ */}
        {mode === 'live' && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                Ανέβασε αρχείο (PDF, Word, PowerPoint, Pages, εικόνα) από τον υπολογιστή ή το cloud σου — γίνεται PDF και παίρνεις κωδικό για τον διαδραστικό.
              </div>

              <label style={S.upBtn}>
                ⬆️ Επιλογή αρχείου…
                <input type="file" multiple accept={ACCEPT} onChange={pickLiveFiles} style={{ display: 'none' }} />
              </label>

              {/* Προαιρετικός σύνδεσμος */}
              <div style={{ marginTop: 14 }}>
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…ή επικόλλησε σύνδεσμο (YouTube, ιστοσελίδα)" style={S.input} />
                {urlInput.trim() && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={urlName} onChange={(e) => setUrlName(e.target.value)} placeholder="Όνομα (προαιρετικό)" style={{ ...S.input, flex: 1 }} />
                    <button onClick={addUrl} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.cream, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>+ Προσθήκη</button>
                  </div>
                )}
              </div>

              {/* Λίστα προς προβολή */}
              {!compositionEmpty && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  {liveDriveItems.map((it, i) => (
                    <div key={'d' + i} style={S.row}>
                      <span>📚</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                      <span style={{ fontSize: 10, color: C.cream, fontWeight: 700, flexShrink: 0 }}>ΒΙΒΛΙΟΘΗΚΗ</span>
                      <button style={S.x} onClick={() => setLiveDriveItems((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                  {liveFiles.map((f, i) => (
                    <div key={'f' + i} style={S.row}>
                      <span>📄</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button style={S.x} onClick={() => setLiveFiles((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                  {liveUrls.map((u, i) => (
                    <div key={'u' + i} style={S.row}>
                      <span>🌐</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      <button style={S.x} onClick={() => setLiveUrls((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Προσθήκη στο ενεργό Live — μόνο όταν τρέχει live ΚΑΙ υπάρχουν νέα στοιχεία */}
            {liveCode && !compositionEmpty && (() => {
              const n = liveDriveItems.length + liveFiles.length + liveUrls.length;
              return (
                <button onClick={addToLive} disabled={!!busy}
                  style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: busy ? '#e0e0e0' : C.green, color: '#fff', fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer', marginBottom: 10 }}>
                  {busy === 'add' ? '⏳ Ανέβασμα & προσθήκη…' : `➕ Προσθήκη ${n === 1 ? 'στοιχείου' : n + ' στοιχείων'} στο ενεργό Live ${liveCode}`}
                </button>
              );
            })()}

            <button style={S.go(!compositionEmpty && !busy)} disabled={compositionEmpty || !!busy} onClick={startLive}>
              {busy === 'live' ? '⏳ Ανέβασμα & δημιουργία…' : (liveCode ? '📡 Νέο Live (νέος κωδικός)' : '📡 Έναρξη Live')}
            </button>

            {/* Αποθήκευση σύνθεσης ως σετ — για επανάληψη σε άλλο τμήμα/μέρα */}
            {!compositionEmpty && (
              <button onClick={saveAsSet} disabled={!!busy}
                style={{ width: '100%', padding: 12, borderRadius: 14, border: '2px solid ' + C.creamLine, background: '#fff', color: C.cream, fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', marginTop: 10 }}>
                {busy === 'set' ? '⏳ Αποθήκευση…' : '💾 Αποθήκευση ως σετ — για να το ξανατρέξεις όποτε θες'}
              </button>
            )}

            {liveCode && (
              <div style={{ marginTop: 16, padding: 24, background: 'linear-gradient(135deg,#1a1a1a,#2d2a1e)', borderRadius: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.live, marginBottom: 10 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', marginRight: 6, verticalAlign: 'middle' }} />Ενεργό Live
                </div>
                <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 10 }}>{liveCode}</div>
                <div style={{ fontSize: 12, color: '#8e8ea0', marginBottom: 16 }}>
                  {liveCount > 0 && <>{liveCount} {liveCount === 1 ? 'στοιχείο' : 'στοιχεία'} στην παρουσίαση · </>}
                  ό,τι προσθέσεις εμφανίζεται στους θεατές αυτόματα (~5″). Στον διαδραστικό: <b>Ανοιχτή πρόσβαση → Live</b> + κωδικός. Ισχύει ~2 ώρες.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/live?code=${liveCode}`).catch(() => {}); }}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: C.live, fontSize: 13, cursor: 'pointer' }}>📋 Αντιγραφή συνδέσμου</button>
                  <button onClick={() => window.open(`/live?code=${liveCode}`, '_blank')}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: C.live, color: C.dark, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Άνοιγμα →</button>
                  <button onClick={stopLive}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.5)', background: 'transparent', color: '#f87171', fontSize: 13, cursor: 'pointer' }}>⏹ Τερματισμός</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ΜΟΙΡΑΣΜΑ ═══ */}
        {mode === 'share' && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                Ανέβασε αρχείο — γίνεται PDF και εμφανίζεται αμέσως στη <b>δημόσια σελίδα</b> σου (χωρίς σύνδεση για τους μαθητές).
              </div>
              <label style={S.upBtn}>
                {busy === 'share' ? '⏳ Ανέβασμα & δημοσίευση…' : '⬆️ Επιλογή αρχείου για μοίρασμα…'}
                <input type="file" multiple accept={ACCEPT} onChange={pickShareFiles} style={{ display: 'none' }} disabled={!!busy} />
              </label>
              {shareDone && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0faf0', border: '1px solid #cde8cd', borderRadius: 12, fontSize: 13, color: C.green, fontWeight: 600 }}>
                  ✓ Δημοσιεύτηκε στην ανοιχτή σελίδα
                </div>
              )}
            </div>

            {/* 👤 Προσωπικό — αποστολή σε συγκεκριμένο μαθητή */}
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>👤 Προσωπικό — σε συγκεκριμένο μαθητή</div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>
                Το αρχείο το βλέπουν <b>μόνο</b> οι μαθητές που θα βάλουν το ψευδομέιλ τους στο πλαίσιο «Δες το προσωπικό σου υλικό» της δημόσιας σελίδας. Για πολλούς, χώρισε τα ψευδομέιλ με <b>κόμμα</b>.
              </div>
              <input value={recipient} onChange={(e) => { setRecipient(e.target.value); setPersonalDone(false); }}
                placeholder="Ψευδομέιλ μαθητή/-ών (π.χ. nikos.b2, maria.a1@gmail.com)" type="text"
                style={{ ...S.input, marginBottom: 8 }} />
              <input value={personalMsg} onChange={(e) => setPersonalMsg(e.target.value)}
                placeholder="✉️ Μήνυμα προς τον/τους μαθητή/-ές (προαιρετικό)"
                style={{ ...S.input, marginBottom: 10 }} />
              {parseRecipients(recipient).length > 0 && (
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
                  Θα σταλεί σε {parseRecipients(recipient).length} {parseRecipients(recipient).length === 1 ? 'μαθητή' : 'μαθητές'}: <b>{parseRecipients(recipient).join(', ')}</b>
                </div>
              )}
              <label style={{ ...S.upBtn, ...(parseRecipients(recipient).length && !busy ? {} : { opacity: 0.5, cursor: 'default' }) }}>
                {busy === 'personal' ? '⏳ Ανέβασμα & αποστολή…' : '⬆️ Επιλογή αρχείου για τον/τους μαθητή/-ές…'}
                <input type="file" multiple accept={ACCEPT} onChange={pickPersonalFiles} style={{ display: 'none' }} disabled={!!busy || !parseRecipients(recipient).length} />
              </label>
              {personalDone && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0faf0', border: '1px solid #cde8cd', borderRadius: 12, fontSize: 13, color: C.green, fontWeight: 600 }}>
                  ✓ Στάλθηκε προσωπικά σε: {parseRecipients(recipient).join(', ')}
                </div>
              )}
              {personal.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.mut, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ενεργές προσωπικές αποστολές ({personal.length})</div>
                  {personal.map((f) => (
                    <div key={f.id} style={S.row}>
                      <span>👤</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName(f.name)}</div>
                        <div style={{ fontSize: 11, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {personalRecipient(f)}{f.shareMessage ? ' · ✉️ ' + f.shareMessage : ''}</div>
                      </div>
                      <button style={{ ...S.x, color: C.red }} title="Ανάκληση — ο μαθητής παύει να το βλέπει" onClick={() => unpersonal(f)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Τι βλέπουν τώρα οι μαθητές */}
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, textTransform: 'uppercase', letterSpacing: 0.5 }}>Στη δημόσια σελίδα ({shared.length})</div>
                <button onClick={() => router.push(publicPath)}
                  style={{ background: 'none', border: 'none', color: C.cream, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Άνοιγμα →</button>
              </div>
              {busy === 'load' && <div style={{ fontSize: 12, color: C.mut }}>Φόρτωση…</div>}
              {!shared.length && busy !== 'load' && <div style={{ fontSize: 13, color: C.mut }}>Τίποτα ακόμη — ανέβασε το πρώτο αρχείο.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shared.map((f) => (
                  <div key={f.id} style={S.row}>
                    <span>📄</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName(f.name)}</span>
                    <button style={{ ...S.x, color: C.red }} title="Αφαίρεση από τη δημόσια σελίδα" onClick={() => unshare(f)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.mut, textAlign: 'center' }}>
              Δημόσια διεύθυνση: <b style={{ color: C.sub }}>{typeof window !== 'undefined' ? window.location.host : ''}{publicPath}</b>
            </div>
          </>
        )}

        {/* ═══ ΦΩΤΟ → PDF ═══ */}
        {mode === 'photo' && (
          <>
            {/* Κρυφό input — στο κινητό ανοίγει απευθείας την κάμερα */}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple
              onChange={pickPhotos} style={{ display: 'none' }} />

            {/* Βήμα 1: λήψεις */}
            {!photoPdf && (
              <div style={S.card}>
                {photos.length === 0 ? (
                  <>
                    <button style={S.upBtn} onClick={() => photoInputRef.current?.click()}>
                      📷 Λήψη φωτογραφίας
                    </button>
                    <div style={{ fontSize: 12, color: C.mut, marginTop: 10, lineHeight: 1.6 }}>
                      Συνεχόμενες λήψεις (π.χ. σελίδες βιβλίου, γραπτά) ενώνονται σε <b>ενιαίο PDF</b>,
                      το οποίο στη συνέχεια στέλνεται σε Live, στη δημόσια σελίδα ή στη Βιβλιοθήκη.
                    </div>
                  </>
                ) : (
                  <>
                    {/* Μικρογραφίες με αρίθμηση σελίδων */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginBottom: 14 }}>
                      {photos.map((p, i) => (
                        <div key={p.url} style={{ position: 'relative', border: '1px solid ' + C.creamLine, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                          <img src={p.url} alt={'Σελίδα ' + (i + 1)} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                          <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(26,26,26,0.75)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>{i + 1}</span>
                          <button onClick={() => removePhoto(i)} title="Αφαίρεση"
                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(26,26,26,0.75)', color: '#fff', border: 'none', borderRadius: 6, width: 20, height: 20, fontSize: 11, cursor: 'pointer', lineHeight: '20px', padding: 0 }}>✕</button>
                        </div>
                      ))}
                      {/* Πλακίδιο «άλλη σελίδα» μέσα στο πλέγμα */}
                      <button onClick={() => photoInputRef.current?.click()}
                        style={{ height: 110, border: '2px dashed ' + C.creamLine, borderRadius: 10, background: C.creamBg, color: C.cream, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        📷<br />Άλλη σελίδα
                      </button>
                    </div>

                    <input value={photoName} onChange={(e) => setPhotoName(e.target.value)}
                      placeholder="Όνομα PDF (προαιρετικό — αλλιώς με ημερομηνία/ώρα)" style={{ ...S.input, marginBottom: 10 }} />

                    <button style={S.go(!busy)} onClick={finishPhotos} disabled={!!busy}>
                      {busy === 'photo' ? 'Δημιουργία PDF…' : `Ολοκλήρωση → PDF (${photos.length} σελ.)`}
                    </button>
                    <button onClick={clearPhotos}
                      style={{ background: 'none', border: 'none', color: C.mut, fontSize: 12, cursor: 'pointer', marginTop: 10, padding: 0 }}>
                      Καθαρισμός όλων
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Βήμα 2: επιλογή προορισμού */}
            {photoPdf && (
              <div style={S.card}>
                <div style={{ fontSize: 14, color: C.ink, marginBottom: 4 }}>
                  ✅ Το PDF <b>«{photoPdf.name}»</b> είναι έτοιμο ({photos.length} σελ., {(photoPdf.size / 1024 / 1024).toFixed(1)} MB).
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>Πού να πάει;</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={S.go(!busy)} onClick={photoPdfToLive} disabled={!!busy}>
                    📡 Live — προσθήκη στη σύνθεση
                  </button>
                  <button style={{ ...S.go(!busy), background: busy ? '#e0e0e0' : C.cream }} onClick={photoPdfToShare} disabled={!!busy}>
                    {busy === 'photo-share' ? 'Δημοσίευση…' : '🌍 Μοίρασμα — στη δημόσια σελίδα'}
                  </button>
                  <button style={{ ...S.go(!busy), background: busy ? '#e0e0e0' : '#fff', color: C.ink, border: '2px solid ' + C.line }} onClick={photoPdfToLibrary} disabled={!!busy}>
                    {busy === 'photo-save' ? 'Αποθήκευση…' : '💾 Αποθήκευση στη Βιβλιοθήκη' + (libOn ? '' : ' (θα ενεργοποιηθεί)')}
                  </button>
                </div>

                <button onClick={() => setPhotoPdf(null)}
                  style={{ background: 'none', border: 'none', color: C.mut, fontSize: 12, cursor: 'pointer', marginTop: 14, padding: 0 }}>
                  ← Πίσω στις φωτογραφίες
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ ΒΙΒΛΙΟΘΗΚΗ (προαιρετική) ═══ */}
        {mode === 'library' && !libOn && (
          <div style={{ ...S.card, background: C.dark, border: 'none', padding: isMobile ? 22 : 28 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.live, marginBottom: 12 }}>📚 Βιβλιοθήκη — προαιρετική</div>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: '#d4d4dc', marginBottom: 14 }}>
              Κανονικά η εφαρμογή <b style={{ color: '#fff' }}>δεν κρατά τίποτε</b>: ό,τι ανεβάζεις για Live σβήνεται σε 24 ώρες.
              Αν ενεργοποιήσεις τη Βιβλιοθήκη, τα αρχεία που βάζεις σε αυτήν <b style={{ color: '#fff' }}>μένουν αποθηκευμένα στο δικό σου Google Drive</b>, ώστε:
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.9, color: '#d4d4dc', marginBottom: 14, paddingLeft: 4 }}>
              <div>✦ να ξεκινάς Live από έτοιμο αρχείο, χωρίς να το ξανανεβάζεις κάθε φορά·</div>
              <div>✦ να αποθηκεύεις <b style={{ color: '#fff' }}>σετ</b> — έτοιμες συνθέσεις μαθήματος (κείμενο + βίντεο + φύλλο εργασίας) που ξανατρέχουν με ένα πάτημα, σε όποιο τμήμα θες·</div>
              <div>✦ να βάζεις και να βγάζεις αρχεία από τη δημόσια σελίδα με έναν διακόπτη, χωρίς να διαγράφονται.</div>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: '#8e8ea0', marginBottom: 20 }}>
              Όλα μένουν αποκλειστικά στον δικό σου λογαριασμό Google — πουθενά αλλού. Τα διαγράφεις όποτε θελήσεις,
              και το Live & το Μοίρασμα συνεχίζουν να δουλεύουν ακριβώς όπως πριν.
            </div>
            <button onClick={activateLibrary}
              style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: C.live, color: C.dark, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              ✓ Ενεργοποίηση Βιβλιοθήκης
            </button>
          </div>
        )}

        {mode === 'library' && libOn && (
          <>
            {/* Ανέβασμα στη βιβλιοθήκη */}
            <div style={{ ...S.card, background: C.dark, border: 'none' }}>
              <div style={{ fontSize: 13, color: '#8e8ea0', marginBottom: 14 }}>
                Ό,τι ανεβάζεις εδώ <b style={{ color: '#d4d4dc' }}>μένει στο Drive σου</b> — έτοιμο για Live ή Μοίρασμα, όσες φορές θες.
              </div>
              <label style={{ ...S.upBtn, background: 'rgba(232,201,106,0.08)', border: '2px dashed rgba(232,201,106,0.35)', color: C.live }}>
                {busy === 'lib' ? '⏳ Ανέβασμα…' : '⬆️ Προσθήκη αρχείου στη βιβλιοθήκη…'}
                <input type="file" multiple accept={ACCEPT} onChange={pickLibFiles} style={{ display: 'none' }} disabled={!!busy} />
              </label>
            </div>

            {/* Σετ */}
            <div style={{ ...S.card, background: C.dark, border: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.live, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>🎬 Σετ — έτοιμα μαθήματα ({sets.length})</div>
              {!sets.length && (
                <div style={{ fontSize: 13, color: '#8e8ea0' }}>
                  Κανένα ακόμη. Στήσε μια σύνθεση στο 📡 Live και πάτησε «💾 Αποθήκευση ως σετ».
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sets.map((s) => (
                  <div key={s.id} style={{ ...S.row, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span>🎬</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <button onClick={() => launchSet(s)} disabled={!!busy} title="Έναρξη Live με νέο κωδικό"
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: C.live, color: C.dark, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>▶ Live</button>
                    <button style={{ ...S.x, color: '#8e8ea0' }} title="Διαγραφή σετ" onClick={() => deleteSet(s)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Αρχεία βιβλιοθήκης */}
            <div style={{ ...S.card, background: C.dark, border: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.live, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>📄 Αρχεία ({library.length})</div>
              {!library.length && <div style={{ fontSize: 13, color: '#8e8ea0' }}>Τίποτα ακόμη — ανέβασε το πρώτο αρχείο.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {library.map((f) => {
                  const inLive = liveDriveItems.some((x) => x.id === f.id);
                  const pub = isPublicFile(f);
                  const btnOpen = (
                    <button onClick={() => openLibFile(f)} title="Άνοιγμα / προεπισκόπηση"
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#ececec', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      👁
                    </button>
                  );
                  const btnLive = (
                    <button onClick={() => addLibToLive(f)} disabled={inLive} title="Προσθήκη στη σύνθεση Live"
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(232,201,106,0.4)', background: inLive ? 'rgba(232,201,106,0.15)' : 'transparent', color: C.live, fontSize: 12, fontWeight: 600, cursor: inLive ? 'default' : 'pointer', flexShrink: 0 }}>
                      {inLive ? '✓ στο Live' : '➕ Live'}
                    </button>
                  );
                  const btnPub = isPersonalFile(f) ? (
                    <button onClick={() => unpersonal(f)} title={'Προσωπικό — το βλέπει μόνο: ' + personalRecipient(f) + '. Πάτησε για ανάκληση.'}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.5)', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      👤 {personalRecipients(f).length > 1 ? personalRecipients(f).length + ' μαθητές' : (personalRecipients(f)[0] || '').split('@')[0]}
                    </button>
                  ) : (
                    <button onClick={() => togglePublic(f)} title={pub ? 'Απόσυρση από τη δημόσια σελίδα' : 'Δημοσίευση στη δημόσια σελίδα'}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid ' + (pub ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.2)'), background: pub ? 'rgba(74,222,128,0.12)' : 'transparent', color: pub ? '#4ade80' : '#8e8ea0', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      {pub ? '🌍 Δημόσιο' : '🌍 Όχι'}
                    </button>
                  );
                  // 👤 δίπλα στο 🌍: προσωπική αποστολή αρχείου βιβλιοθήκης σε μαθητή
                  const btnPers = isPersonalFile(f) ? null : (
                    <button onClick={() => sendLibToStudent(f)} title="Αποστολή σε συγκεκριμένο μαθητή (ψευδομέιλ)"
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.4)', background: 'transparent', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      👤
                    </button>
                  );
                  const btnDel = (
                    <button style={{ ...S.x, color: '#f87171' }} title="Οριστική διαγραφή από βιβλιοθήκη & Drive" onClick={() => removeFromLibrary(f)}>✕</button>
                  );
                  return isMobile ? (
                    /* Κινητό: εικονίδιο αριστερά σε όλο το ύψος · δεξιά πάνω το όνομα (κόβεται), κάτω τα κουμπιά */
                    <div key={f.id} style={{ ...S.row, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', alignItems: 'center' }}>
                      <span style={{ fontSize: 24, flexShrink: 0 }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <span onClick={() => openLibFile(f)} title="Άνοιγμα / προεπισκόπηση"
                          style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{cleanName(f.name)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {btnOpen}
                          {btnLive}
                          {btnPub}
                          {btnPers}
                          <span style={{ flex: 1 }} />
                          {btnDel}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop: μία γραμμή, όπως πριν */
                    <div key={f.id} style={{ ...S.row, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <span>📄</span>
                      <span onClick={() => openLibFile(f)} title="Άνοιγμα / προεπισκόπηση"
                        style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, cursor: 'pointer' }}>{cleanName(f.name)}</span>
                      {btnOpen}
                      {btnLive}
                      {btnPub}
                      {btnPers}
                      {btnDel}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.mut, textAlign: 'center' }}>
              Τα αρχεία φυλάσσονται στο Google Drive σου. {' '}
              <button onClick={hideLibrary} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Απόκρυψη βιβλιοθήκης
              </button>
              {' '}(τα αρχεία δεν διαγράφονται).
            </div>
          </>
        )}
      </div>

      {/* ── Κάτω μπάρα (μόνο mobile): πλοήγηση, Βιβλιοθήκη, Ανοιχτή πρόσβαση, Έξοδος ── */}
      {isMobile && (
        <nav style={S.mobBar}>
          <MobB icon="📚" label="Βιβλιοθήκη" active={mode === 'library'} onClick={() => setMode('library')} />
          <MobB icon="🌍" label="Ανοιχτή" onClick={() => router.push(publicPath)} />
          <MobB icon="⏻" label="Έξοδος" red onClick={() => signOut({ callbackUrl: '/login' })} />
        </nav>
      )}
    </div>
  );
}

/* Κουμπί κάτω μπάρας (mobile) */
function MobB({ icon, label, active, red, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'transparent', border: 'none',
        color: red ? '#f87171' : active ? '#ececec' : '#8e8ea0', fontSize: 11, cursor: 'pointer', padding: '6px 10px' }}>
      <span style={{ fontSize: 19, lineHeight: '21px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
