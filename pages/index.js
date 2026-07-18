// pages/index.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

// ── Energy Insights palette (από το παλιό ΛΕΒΙΑΘΑΝ) ──
const PALETTE = {
  cream:   { bg:'#f7f3e8', bgSoft:'#fcf9f0', accent:'#e9e0c8', text:'#3d3a2e', deep:'#8a7d4a' },
  peach:   { bg:'#fae0cc', bgSoft:'#fdf0e4', accent:'#f0c4a0', text:'#5c3826', deep:'#c97b5a' },
  mustard: { bg:'#f0e4a8', bgSoft:'#f8f0c8', accent:'#d9be52', text:'#4a3f1a', deep:'#a68a2e' },
};
const TONES = ['cream', 'peach', 'mustard'];

const SUGGESTED_TAGS = [
  'Γλώσσα','Λογοτεχνία','Ιστορία','Αρχαία','Λατινικά',
  'Έκθεση','Γραμματική','Λεξιλόγιο','Ανάλυση','Αξιολόγηση',
  'Α΄ Λυκείου','Β΄ Λυκείου','Γ΄ Λυκείου',
];
const SUGGESTED_URLS = [
  { name:'YouTube', url:'https://www.youtube.com' },
  { name:'Wikipedia', url:'https://el.wikipedia.org' },
  { name:'Λεξικό Τριανταφυλλίδη (Ηλεκτρονικό)', url:'http://www.greek-language.gr/greekLang/modern_greek/tools/lexica/triantafyllides/' },
  { name:'Χρηστικό λεξικό – Ακαδημία Αθηνών', url:'https://www.lexikon.academyofathens.gr' },
  { name:'Ψηφιακό φροντιστήριο', url:'https://dschool.edu.gr' },
  { name:'Study4exams', url:'https://www.study4exams.gr' },
  { name:'ΕΡΤ', url:'https://www.ert.gr' },
  { name:'Πύλη για την Ελληνική Γλώσσα', url:'http://www.greek-language.gr' },
  { name:'Φωτόδεντρο', url:'http://photodentro.edu.gr' },
  { name:'Μελίσπη – Ψηφιακή Βιβλιοθήκη', url:'https://melispe.gr' },
];
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (tag) => TAG_COLORS[Math.abs([...tag].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

// Μετατροπή ΛΕΒΙΑΘΑΝ link /api/file/{id} → δημόσιο /api/student-file (κρατά το #set=…).
// Εξωτερικά URLs (synoxi κ.λπ.) μένουν ως έχουν. Χρησιμοποιείται σε ΟΛΑ τα σημεία που δέχονται URL.
function toPublicLink(raw) {
  if (!raw) return raw;
  let url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  const m = url.match(/\/api\/file\/([^?#]+)(#.*)?$/);
  if (m) {
    const origin = (typeof window !== 'undefined') ? window.location.origin : 'https://leviathan-olive.vercel.app';
    url = `${origin}/api/student-file?id=${m[1]}${m[2] || ''}`;
  }
  return url;
}
const newQid = () => Math.random().toString(36).slice(2, 8);
const Q_CODES = ['Α', 'Β1', 'Β2', 'Β3', 'Γ', 'Δ'];
function parseQuestions(raw) {
  if (!raw) return Q_CODES.map(code => ({ code, text: '' }));
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) return Q_CODES.map(code => ({ code, text: (arr.find(q => q.code === code) || {}).text || '' }));
  } catch {}
  return Q_CODES.map((code, i) => ({ code, text: i === 0 ? String(raw) : '' }));
}
function serializeQuestions(qArr) { return JSON.stringify(qArr.filter(q => q.text?.trim())); }
function hasAnyQuestions(raw) {
  if (!raw || !String(raw).trim()) return false;
  try { const a = JSON.parse(raw); return Array.isArray(a) && a.some(q => q.text?.trim()); } catch { return !!String(raw).trim(); }
}
const trunc = (s, max = 15) => s && s.length > max ? s.slice(0, max) + '…' : s || '';
const getFileUrl = (f) => `https://drive.google.com/file/d/${f.id}/view`;
// ── Άνοιγμα εξωτερικού συνδέσμου (π.χ. προβολή Drive) ──
// Σε εγκατεστημένο PWA (standalone) το window.open('_blank') αφήνει κενό ενδιάμεσο
// παράθυρο (λευκή σελίδα με «✕») → διπλό πάτημα για επιστροφή. Με window.location.href
// το iOS ανοίγει τον cross-origin σύνδεσμο ως in-app browser πάνω από την εφαρμογή,
// οπότε το «◀» επιστρέφει μονοβηματικά. Στον Safari κρατάμε τη νέα καρτέλα.
const isStandalonePWA = () =>
  (typeof navigator !== 'undefined' && navigator.standalone === true) ||
  (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
const openExternal = (url) => {
  if (isStandalonePWA()) { window.location.href = url; }
  else { window.open(url, '_blank'); }
};

// ── Μικρό toast (εκτός React — καλείται από τους helpers εκτύπωσης/προβολής) ──
let _printToastEl = null;
function showPrintToast(text = '⏳ Προετοιμασία εκτύπωσης…') {
  hidePrintToast();
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;bottom:calc(28px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;';
  document.body.appendChild(el);
  _printToastEl = el;
}
function hidePrintToast() {
  if (_printToastEl) { try { _printToastEl.remove(); } catch {} _printToastEl = null; }
}

// ── Κουμπί «Έτοιμο για εκτύπωση» (κινητό/PWA) ──
// Το navigator.share απαιτεί φρέσκο user gesture: αν χάθηκε όσο ετοιμαζόταν το PDF,
// δείχνουμε κουμπί — το πάτημά του δίνει νέο gesture και το φύλλο κοινής χρήσης ανοίγει.
let _printBtnEl = null;
function hidePrintReadyButton() {
  if (_printBtnEl) { try { _printBtnEl.remove(); } catch {} _printBtnEl = null; }
}
function showPrintReadyButton(file, fname) {
  hidePrintToast(); hidePrintReadyButton();
  if (typeof document === 'undefined') return;
  const el = document.createElement('button');
  el.textContent = '🖨️ Έτοιμο — πάτησε για εκτύπωση';
  el.style.cssText = 'position:fixed;bottom:calc(28px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;padding:14px 22px;border:none;border-radius:14px;font-size:15px;font-weight:700;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer;';
  el.onclick = () => {
    hidePrintReadyButton();
    try { navigator.share({ files: [file], title: fname }).catch(() => {}); } catch {}
  };
  document.body.appendChild(el);
  _printBtnEl = el;
  setTimeout(() => { if (_printBtnEl === el) hidePrintReadyButton(); }, 45000);
}

// Safari σε Mac (όχι Chrome/Firefox/Edge, όχι κινητό): η εκτύπωση PDF μέσα από
// iframe έχει γνωστό bug WebKit — προειδοποίηση «δεν επιτρέπεται η εκτύπωση» και
// εκτύπωση μόνο της 1ης σελίδας. Εκεί ανοίγουμε το PDF σε καρτέλα και η εκτύπωση
// γίνεται από τον native PDF viewer του Safari (⌘P) — όλες οι σελίδες, χωρίς προειδοποίηση.
const isSafariDesktop = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return false;
  return /safari/i.test(ua) && !/chrome|crios|chromium|edg|opr|fxios/i.test(ua);
};

// ── Εκτύπωση χωρίς «παράθυρο-παγίδα» στο PWA ──
// Κινητό/PWA: navigator.share με το ίδιο το αρχείο → φύλλο κοινής χρήσης iOS/Android
//   με επιλογή «Εκτύπωση» (AirPrint κ.λπ.) — και καθαρή επιστροφή στην εφαρμογή.
// Desktop Chrome/Firefox/Edge: κρυφό iframe → print() → κατευθείαν ο διάλογος εκτυπωτή.
// Desktop Safari: preWin (προανοιγμένη καρτέλα) → native PDF viewer.
async function printPdfBlob(blob, name, preWin) {
  hidePrintToast(); // το αρχείο είναι έτοιμο — το φύλλο/διάλογος αναλαμβάνει
  // Σεβόμαστε τον πραγματικό τύπο: το /api/file στέλνει PDF για Office/PDF, εικόνες ως έχουν.
  const isImage = (blob.type || '').startsWith('image/');
  const type = isImage ? blob.type : 'application/pdf';
  const fname = isImage ? name : (/\.pdf$/i.test(name) ? name : name.replace(/\.(docx?|pptx?|xlsx?)$/i, '') + '.pdf');
  const outBlob = blob.type === type ? blob : new Blob([blob], { type });
  const isMobileUA = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobileUA || isStandalonePWA()) {
    // Σε κινητό/PWA ΔΕΝ χρησιμοποιούμε ποτέ iframe print (WebKit: προειδοποίηση
    // «αυτόματη εκτύπωση» + μόνο 1η σελίδα). Μόνο share sheet — με κουμπί αν χρειάζεται.
    const file = new File([outBlob], fname, { type });
    const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try { await navigator.share({ files: [file], title: fname }); return; }
      catch (e) {
        if (e && e.name === 'AbortError') return; // ο χρήστης έκλεισε το φύλλο — ΟΚ
        // NotAllowedError κ.ά.: χάθηκε το user gesture όσο ετοιμαζόταν το PDF
        showPrintReadyButton(file, fname);
        return;
      }
    }
    // Χωρίς υποστήριξη Web Share αρχείων: άνοιξε το PDF — εκτύπωση από τον viewer
    openExternal(URL.createObjectURL(outBlob));
    return;
  }
  // Desktop / fallback
  const url = URL.createObjectURL(outBlob);
  // Safari (Mac): προανοιγμένη καρτέλα → native PDF viewer (αποφυγή του iframe bug)
  if (preWin && !preWin.closed) { preWin.location.href = url; return; }
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;border:0;visibility:hidden;';
  fr.src = url;
  fr.onload = () => {
    try { fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch { openExternal(url); }
    setTimeout(() => { try { URL.revokeObjectURL(url); fr.remove(); } catch {} }, 60000);
  };
  document.body.appendChild(fr);
}

// Εκτύπωση αρχείου βιβλιοθήκης: το /api/file σερβίρει ΔΙΚΑ μας αρχεία με το token
// του χρήστη και μετατρέπει Office → PDF on-the-fly — δουλεύει και για μη δημοσιευμένα.
async function printFileById(f) {
  // Safari (Mac): άνοιγμα του PDF απευθείας σε καρτέλα (συγχρονισμένα — δεν
  // μπλοκάρεται ως popup) και εκτύπωση από τον native viewer με ⌘P.
  if (isSafariDesktop()) { window.open('/api/file/' + f.id, '_blank'); return; }
  showPrintToast();
  try {
    const r = await fetch('/api/file/' + f.id);
    if (!r.ok) throw new Error('αποτυχία λήψης του αρχείου');
    await printPdfBlob(await r.blob(), f.name || 'αρχείο');
  } catch (e) { alert('Σφάλμα εκτύπωσης: ' + e.message); }
  finally { hidePrintToast(); }
}
// ── Κοινή χρήση εφαρμογών: HTML αρχεία ανοίγουν ΖΩΝΤΑΝΑ μέσω /api/student-file (όχι προεπισκόπηση Drive) ──
const isHtmlApp = (f) => /\.html?$/i.test(f?.name || '') || (f?.mimeType || '') === 'text/html';
// native Google editor (Docs/Sheets/Slides): δεν έχουν κατάληξη — ανίχνευση από mimeType.
// Επιστρέφει το path για read-only cross-origin preview (docs.google.com/{type}/d/{id}/preview) ή '' αν δεν είναι Google editor.
const gEditorType = (m) => m === 'application/vnd.google-apps.spreadsheet' ? 'spreadsheets'
  : m === 'application/vnd.google-apps.presentation' ? 'presentation'
  : m === 'application/vnd.google-apps.document' ? 'document' : '';
// Δημόσιο URL εφαρμογής GitHub (public/apps) — από το path του apps-manifest.json
const ghUrl = (app) => (((typeof window !== 'undefined') ? window.location.origin : 'https://leviathan-olive.vercel.app') + '/apps/' + String(app.path || '').split('/').map(encodeURIComponent).join('/'));
const getShareUrl = (f) => {
  if (!f) return '';
  if (f._ghUrl) return f._ghUrl; // εφαρμογή GitHub — άμεσο στατικό λινκ
  if (isHtmlApp(f)) {
    const origin = (typeof window !== 'undefined') ? window.location.origin : 'https://leviathan-olive.vercel.app';
    return `${origin}/api/student-file?id=${f.id}`;
  }
  return getFileUrl(f);
};
// Σύντομη ένδειξη κατάστασης κοινοποίησης (visibility)
const shareLabel = (v) => !v || v === 'none' ? null
  : v === 'public' ? '🌍 Δημόσιο'
  : v === 'connections' ? '👥 Συνδέσεις'
  : '👤 Επιλεγμένοι';
// Υποφάκελοι Drive μέσα στον φάκελο «Εφαρμογές»
const isDriveFolder = (f) => (f?.mimeType || '') === 'application/vnd.google-apps.folder';
const toEmbedUrl = (url) => {
  if (!url) return url;
  // YouTube → embed
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // Ήδη embed ή άλλο URL → ως έχει
  return url;
};
const QrIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>;

const getEditUrl = (f) => {
  if (!f) return null;
  const m = f.mimeType || '';
  if (m === 'application/vnd.google-apps.document' || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || m === 'application/msword')
    return `https://docs.google.com/document/d/${f.id}/edit`;
  if (m === 'application/vnd.google-apps.presentation' || m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || m === 'application/vnd.ms-powerpoint')
    return `https://docs.google.com/presentation/d/${f.id}/edit`;
  if (m === 'application/vnd.google-apps.spreadsheet' || m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || m === 'application/vnd.ms-excel')
    return `https://docs.google.com/spreadsheets/d/${f.id}/edit`;
  return null;
};

// ── SVG εικονίδια (ίδια με το παλιό) ──
const Icon = {
  home:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  net:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg>,
  netAdd:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/><circle cx="12" cy="12" r="9"/></svg>,
  apps:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  student: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><rect x="1" y="3" width="4" height="4" rx="0.5"/><rect x="1" y="9" width="4" height="4" rx="0.5"/><rect x="1" y="15" width="4" height="4" rx="0.5"/></svg>,
  logout:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  star:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  newDoc:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  search:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  folder:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.peach.deep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bolt:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.mustard.deep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  collapseL:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  collapseR:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  live:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  book:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  filePdf: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h1.5a1.5 1.5 0 000-3H9v6"/><path d="M15.5 12H14v6M14 15h1.2"/></svg>,
  send:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  globe:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
};

function EmbedFrame({ src, title, style }) {
  const [blocked, setBlocked] = useState(false);
  const isExternal = src && !src.startsWith('/');
  useEffect(() => { setBlocked(false); }, [src]);
  if (!isExternal) return <iframe src={src} style={{ ...style, width:'100%', height:'100%' }} title={title} />;
  return (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <iframe src={src} style={{ ...style, width:'100%', height:'100%' }} title={title}
        onLoad={(e) => {
          try { const d = e.target.contentDocument; if (d && d.body && d.body.innerHTML === '') setBlocked(true); } catch { /* cross-origin = φόρτωσε κάτι */ }
        }}
        onError={() => setBlocked(true)} />
      {blocked && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.95)', gap:12 }}>
          <div style={{ fontSize:14, color:'#666', textAlign:'center', maxWidth:280 }}>Ο ιστότοπος δεν επιτρέπει ενσωμάτωση σε πλαίσιο.</div>
          <button onClick={() => window.open(src, '_blank')}
            style={{ padding:'10px 22px', borderRadius:12, border:'1.5px solid #8a7d4a', background:PALETTE.cream.bgSoft, color:'#5c4a1e', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Άνοιγμα σε νέο παράθυρο ↗
          </button>
        </div>
      )}
      {!blocked && (
        <button onClick={() => window.open(src, '_blank')}
          style={{ position:'absolute', bottom:10, right:10, padding:'6px 14px', borderRadius:10, border:'1px solid rgba(0,0,0,0.15)', background:'rgba(255,255,255,0.9)', color:'#555', fontSize:11, fontWeight:600, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.1)', zIndex:2 }}>
          ↗ Νέο παράθυρο
        </button>
      )}
    </div>
  );
}

function loadPickerApi() {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) return resolve();
    const existing = document.getElementById('gapi-script');
    const onload = () => window.gapi.load('picker', { callback: resolve });
    if (existing) { onload(); return; }
    const s = document.createElement('script');
    s.id = 'gapi-script'; s.src = 'https://apis.google.com/js/api.js';
    s.onload = onload; s.onerror = reject; document.body.appendChild(s);
  });
}

/* ── Φωτογραφίες → PDF (client-side, χωρίς εξωτερική βιβλιοθήκη) ──
   Κάθε φωτογραφία γίνεται μία σελίδα A4 σε ενιαίο PDF (JPEG/DCTDecode) */
const fileToJpeg = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const MAX = 1600;
    let w = img.naturalWidth, h = img.naturalHeight;
    const sc = Math.min(1, MAX / Math.max(w, h));
    w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    cv.toBlob(async b => {
      if (!b) { reject(new Error('jpeg fail')); return; }
      resolve({ data: new Uint8Array(await b.arrayBuffer()), w, h });
    }, 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load fail')); };
  img.src = url;
});

const buildPdfFromJpegs = (images) => {
  const enc = new TextEncoder();
  const chunks = []; let offset = 0; const xrefArr = [];
  const push = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); offset += b.length; };
  push('%PDF-1.4\n');
  const objCount = 2 + images.length * 3;
  const addObj = (num, body) => { xrefArr[num] = offset; push(`${num} 0 obj\n${body}\nendobj\n`); };
  const pageNums = images.map((_, i) => 3 + i * 3);
  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, `<< /Type /Pages /Kids [${pageNums.map(n => n + ' 0 R').join(' ')}] /Count ${images.length} >>`);
  images.forEach((im, i) => {
    const pn = 3 + i * 3, cn = pn + 1, xn = pn + 2;
    const A4W = 595, A4H = 842;
    const scale = Math.min(A4W / im.w, A4H / im.h);
    const w = im.w * scale, h = im.h * scale, x = (A4W - w) / 2, y = (A4H - h) / 2;
    addObj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources << /XObject << /Im${i} ${xn} 0 R >> >> /Contents ${cn} 0 R >>`);
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    addObj(cn, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    xrefArr[xn] = offset;
    push(`${xn} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
    push(im.data);
    push('\nendstream\nendobj\n');
  });
  const xrefStart = offset;
  let xr = `xref\n0 ${objCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objCount; n++) xr += String(xrefArr[n]).padStart(10, '0') + ' 00000 n \n';
  xr += `trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  push(xr);
  return new Blob(chunks, { type: 'application/pdf' });
};

async function photosToPdfFile(files) {
  const jpegs = [];
  for (const f of files) jpegs.push(await fileToJpeg(f));
  const blob = buildPdfFromJpegs(jpegs);
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const name = `Φωτογραφίες_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
  return new File([blob], name, { type: 'application/pdf' });
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [folders, setFolders] = useState([]);
  const [appsFolderId, setAppsFolderId] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [minLoadDone, setMinLoadDone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [walletActive, setWalletActive] = useState(null);
  const [statActive, setStatActive] = useState(null);
  const [activeView, setActiveView] = useState('home'); // home | folder | favorites | newFiles | tagSearch | netBuilder
  const [openFolder, setOpenFolder] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [mobileZoom, setMobileZoom] = useState(1);
  const [busy, setBusy] = useState('');
  const uploadRef = useRef(null);

  // Ετικέτες & σχόλια στο viewer
  const [showMetaPanel, setShowMetaPanel] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const saveTimer = useRef(null);
  const saveTimerQ = useRef(null);
  const saveTimerI = useRef(null);
  const saveTimerNetC = useRef(null);
  const saveTimerNetI = useRef(null);
  const saveTimerPdf = useRef(null);
  const currentNetRef = useRef(null);
  const networksRef = useRef([]);

  // Αναζήτηση με ετικέτες
  const [searchTags, setSearchTags] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchCategory, setSearchCategory] = useState('texts'); // 'texts' | 'networks' | 'apps'
  const [folderSearch, setFolderSearch] = useState('');

  // ── Προβολή «Εφαρμογές» ως κάρτες-φάκελοι ──
  const [appsFilter, setAppsFilter] = useState(null);     // null | 'favorites' | 'popular'
  const [appsSearchOn, setAppsSearchOn] = useState(false);
  const [appsSearchText, setAppsSearchText] = useState('');
  const [appsTagFilter, setAppsTagFilter] = useState(null);
  const [appsStatActive, setAppsStatActive] = useState(null);   // wallet (κινητό) — ποια στατιστική κάρτα
  const [appsWalletActive, setAppsWalletActive] = useState(null); // wallet (κινητό) — ποια εφαρμογή

  // ── Εφαρμογές GitHub (public/apps → apps-manifest.json) ──
  const [ghApps, setGhApps] = useState(null);        // null = φόρτωση · {folders, root}
  const [ghAppsError, setGhAppsError] = useState(false);
  const [ghOpenFolder, setGhOpenFolder] = useState(null); // όνομα ανοιχτού υποφακέλου GitHub
  const [ghSearch, setGhSearch] = useState('');
  const [ghCopied, setGhCopied] = useState(null);    // path εφαρμογής που μόλις αντιγράφηκε

  // Live & Συνδέσεις
  const [liveFile, setLiveFile] = useState(null);
  const [activeLiveTab, setActiveLiveTab] = useState(0);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkNameInput, setLinkNameInput] = useState('');
  const [customUrls, setCustomUrls] = useState([]);
  const [modalPickerSection, setModalPickerSection] = useState(null);
  const [studentUrl, setStudentUrl] = useState('/student');
  const [publishing, setPublishing] = useState(false);
  const [liveSending, setLiveSending] = useState(false);
  const [liveToast, setLiveToast] = useState(null);
  const [visibilityPicker, setVisibilityPicker] = useState(null);
  const [visibilityDraft, setVisibilityDraft] = useState('none'); // πρόχειρη επιλογή — αποθηκεύεται μόνο με «Αποθήκευση»
  const [customRecipient, setCustomRecipient] = useState(''); // ψευδομέιλ εκτός συνδέσεων (όπως στη Light)
  const [shareMessage, setShareMessage] = useState('');
  const [networkData, setNetworkData] = useState({ connections:[], received:[], sent:[], inbox:[], unseenCount:0 });
  const [networkInviteEmail, setNetworkInviteEmail] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);
  const [expandedInbox, setExpandedInbox] = useState(null);
  const [inboxFilter, setInboxFilter] = useState(null); // null=όλα, string email, ή array emails (ομάδα)
  const [inboxShowAll, setInboxShowAll] = useState(false); // 10 + Περισσότερα
  const [liveItems, setLiveItems] = useState([]); // [{kind:'file'|'app'|'url', id?, name, url?}]
  const [liveUrlInput, setLiveUrlInput] = useState('');
  const [liveUrlName, setLiveUrlName] = useState('');
  const [liveCenterCode, setLiveCenterCode] = useState(null);
  const [liveCenterBusy, setLiveCenterBusy] = useState(false);
  const [liveSentItems, setLiveSentItems] = useState([]); // στοιχεία που βρίσκονται ΗΔΗ στο ενεργό live
  const [liveAddBusy, setLiveAddBusy] = useState(false);   // αποστολή προσθήκης σε εξέλιξη
  const [liveCenterSection, setLiveCenterSection] = useState(null); // ποιος φάκελος/εφαρμογές ανοιχτός
  // 📷 Φωτογραφίες → PDF για την παρουσίαση Live
  const [livePhotos, setLivePhotos] = useState([]); // [{file,url}]
  const [livePhotoBusy, setLivePhotoBusy] = useState(false);
  const [createMenu, setCreateMenu] = useState(false); // μενού: Νέο / Συγχώνευση
  const [createMenuFolder, setCreateMenuFolder] = useState(''); // προεπιλεγμένος φάκελος (αν ανοίγει από φάκελο)
  const [newDocForm, setNewDocForm] = useState(false); // φόρμα νέου εγγράφου
  const [newDocName, setNewDocName] = useState('');
  const [newDocFolder, setNewDocFolder] = useState('');
  const [newDocTemplate, setNewDocTemplate] = useState(''); // '' = κενό, αλλιώς id προτύπου
  const [newDocBusy, setNewDocBusy] = useState(false);
  const [inboxSaveTarget, setInboxSaveTarget] = useState(null); // fileId+i for which item shows folder picker
  const [userRole, setUserRole] = useState(null); // 'teacher' | 'student'
  const [contactInfo, setContactInfo] = useState({}); // { email: {firstName,lastName,email,school,roleTitle,phone,note} }
  const [contactPicker, setContactPicker] = useState(null); // email του χρήστη που επεξεργαζόμαστε
  const [contactDraft, setContactDraft] = useState({});

  // ── Network Builder (Δίκτυα Κειμένων) ──
  const [networks, setNetworks] = useState([]);
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [netSaving, setNetSaving] = useState(false);
  const [netMsg, setNetMsg] = useState('');
  const [merging, setMerging] = useState(false);
  const [showNewNetForm, setShowNewNetForm] = useState(false);
  const [newNetName, setNewNetName] = useState('');
  const [newNetFolder, setNewNetFolder] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMode, setPickerMode] = useState('texts'); // 'texts' | 'apps'
  const [netTagInput, setNetTagInput] = useState('');
  const [openAccordions, setOpenAccordions] = useState({});
  const [qrFile, setQrFile] = useState(null);
  const [qrCopied, setQrCopied] = useState(false);
  useEffect(() => { setQrCopied(false); }, [qrFile]);
  const [appsSubfolder, setAppsSubfolder] = useState(null); // {id,name} — ανοιχτός υποφάκελος στις Εφαρμογές
  // ── Ομάδες χρηστών + όψη «Εισερχ./Απεστ.» ──
  const [groups, setGroups] = useState([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [groupMsg, setGroupMsg] = useState('');
  const [msgFolder, setMsgFolder] = useState(null); // {type:'inbox'|'sent'|'search'|'user'|'group', email?, group?, name}
  const [msgSearch, setMsgSearch] = useState('');
  const [msgWalletActive, setMsgWalletActive] = useState(null);
  const [msgSending, setMsgSending] = useState(false);      // αποστολή αρχείου από φάκελο χρήστη/ομάδας
  const [msgPhotoMode, setMsgPhotoMode] = useState(false);  // modal «Φωτογραφίες → PDF»
  const [msgPhotos, setMsgPhotos] = useState([]);           // [{file,url}]
  const [msgPhotoBusy, setMsgPhotoBusy] = useState(false);
  const [msgStatActive, setMsgStatActive] = useState(null);
  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (session?.error === 'RefreshAccessTokenError') signOut({ callbackUrl: '/login' });
  }, [status, session, router]);

  useEffect(() => { const t = setTimeout(() => setMinLoadDone(true), 1500); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { currentNetRef.current = currentNetwork; }, [currentNetwork]);
  useEffect(() => { networksRef.current = networks; }, [networks]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rf, rr] = await Promise.all([fetch('/api/folders'), fetch('/api/registry')]);
      const df = await rf.json(); const dr = await rr.json();
      setFolders(Array.isArray(df.folders) ? df.folders : []);
      setAppsFolderId(df.appsFolderId || null);
      setFiles(Array.isArray(dr.files) ? dr.files : []);
    } catch (e) {}
    setLoading(false);
  }, []);

  // ── Ανανέωση όταν το PWA επανέρχεται στο προσκήνιο ──
  // Το εγκατεστημένο PWA μένει «ζωντανό» στο παρασκήνιο για μέρες: χωρίς αυτό,
  // αρχεία που ανέβηκαν από άλλη συσκευή (π.χ. desktop) δεν φαίνονται παρά μόνο
  // με πλήρη επανεκκίνηση της εφαρμογής.
  useEffect(() => {
    if (status !== 'authenticated') return;
    let last = Date.now();
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - last < 5000) return; // όχι καταιγισμός σε γρήγορα tab switches
      last = Date.now();
      loadAll();
      loadNetworks(); // και τα δίκτυα — αλλιώς αποτυχία στο κρύο ξεκίνημα τα αφήνει άδεια για πάντα
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible); // επιστροφή από bfcache (Safari)
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [status, loadAll]);
  const loadRole = async () => {
    try {
      const r = await fetch('/api/role');
      const d = await r.json();
      if (d.role) {
        if (d.role === 'student') { router.replace('/student'); return; }
        setUserRole(d.role);
      }
    } catch {}
  };
  const loadCustomUrls = async () => {
    try { const r = await fetch('/api/custom-urls'); const d = await r.json(); setCustomUrls(d.urls || []); } catch {}
  };
  const addCustomUrl = async (name, url) => {
    const entry = { name: name.trim(), url: url.trim() };
    if (!entry.name || !entry.url) return;
    try {
      const r = await fetch('/api/custom-urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(entry) });
      const d = await r.json(); if (d.urls) setCustomUrls(d.urls);
    } catch {}
  };
  const removeCustomUrl = async (url) => {
    try {
      const r = await fetch('/api/custom-urls', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url }) });
      const d = await r.json(); if (d.urls) setCustomUrls(d.urls);
    } catch {}
  };
  const resetCustomUrls = async () => {
    try {
      const r = await fetch('/api/custom-urls', { method:'PUT' });
      const d = await r.json(); if (d.urls) setCustomUrls(d.urls);
    } catch {}
  };
  // customUrls = πλήρης λίστα ιστοτόπων (defaults + custom), fallback σε SUGGESTED_URLS
  const allSuggestedUrls = customUrls.length > 0 ? customUrls : SUGGESTED_URLS;

  // Φόρτωση manifest εφαρμογών GitHub — παράγεται σε κάθε build από το scripts/generate-apps-manifest.js
  useEffect(() => {
    fetch('/apps-manifest.json?ts=' + Date.now())
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('missing')))
      .then((d) => setGhApps({ folders: d.folders || [], root: d.root || [] }))
      .catch(() => { setGhApps({ folders: [], root: [] }); setGhAppsError(true); });
  }, []);

  useEffect(() => { if (status === 'authenticated') { loadAll(); loadNetwork(); loadNetworks(); loadRole(); loadCustomUrls(); loadContacts(); } }, [status, loadAll]);

  // ── Επαναφορά ενεργού Live (π.χ. μετά από ανανέωση σελίδας): ο server ξέρει το live_active:{email} ──
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const r = await fetch('/api/live?active=1');
        if (!r.ok) return;
        const d = await r.json();
        if (!d.code) return;
        setLiveCenterCode(d.code);
        // Ανασύσταση των στοιχείων του live → σήμανση «σε live» + αποφυγή διπλοεγγραφών
        if (d.data) {
          const sent = [];
          if (d.data.fileId) sent.push({ kind:'file', id:d.data.fileId, name:d.data.title });
          else if (d.data.isUrl && d.data.src) sent.push({ kind:'url', url:d.data.src, name:d.data.title });
          (d.data.links || []).forEach(l => sent.push(l.type === 'url'
            ? { kind:'url', url:l.url, name:l.name }
            : { kind:'file', id:l.targetId, name:l.name }));
          setLiveSentItems(sent);
          setLiveItems(p => p.length ? p : sent); // αν η λίστα είναι κενή, δείξε το περιεχόμενο του live
        }
      } catch {}
    })();
  }, [status]);
  // Περιοδική ανανέωση δικτύου ώστε να εμφανίζεται το κόκκινο σήμα όταν έρχεται νέα αποστολή
  useEffect(() => { if (status !== 'authenticated') return; const iv = setInterval(() => { loadNetwork(); }, 30000); return () => clearInterval(iv); }, [status]);

  // ── Φάκελοι ──
  const addFolder = async () => {
    const name = prompt('Όνομα νέου φακέλου:');
    if (!name || !name.trim()) return;
    setBusy('folder');
    try {
      const r = await fetch('/api/folders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim() }) });
      const d = await r.json();
      if (!r.ok) alert(d.error || 'Σφάλμα δημιουργίας φακέλου'); else setFolders(d.folders);
    } catch (e) { alert('Σφάλμα: ' + e.message); }
    setBusy('');
  };
  const removeFolder = async (folder) => {
    const choice = prompt(`Διαγραφή του φακέλου «${folder.name}».\n\n  1 = αφαίρεση μόνο από τη λίστα (τα αρχεία μένουν στο Drive)\n  2 = διαγραφή και από το Google Drive (στον κάδο)\n\n(Άκυρο για ακύρωση)`, '1');
    if (choice !== '1' && choice !== '2') return;
    setBusy('folder');
    try {
      const r = await fetch('/api/folders', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: folder.id, deleteFromDrive: choice === '2' }) });
      const d = await r.json();
      if (d.folders) setFolders(d.folders);
      setFiles((prev) => prev.filter((f) => f.folderId !== folder.id));
      if (openFolder?.id === folder.id) { setOpenFolder(null); setActiveView('home'); }
    } catch (e) { alert('Σφάλμα: ' + e.message); }
    setBusy('');
  };
  const renameFolder = async (folder) => {
    const name = prompt('Νέο όνομα φακέλου:', folder.name);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    const newName = name.trim();
    setBusy('folder');
    // optimistic ενημέρωση UI
    setFolders((prev) => prev.map((f) => f.id === folder.id ? { ...f, name: newName } : f));
    if (openFolder?.id === folder.id) setOpenFolder((o) => o ? { ...o, name: newName } : o);
    try {
      // Μετονομασία του πραγματικού φακέλου στο Drive
      try { await fetch(`https://www.googleapis.com/drive/v3/files/${folder.id}`, { method:'PATCH', headers:{ Authorization:'Bearer ' + session.accessToken, 'Content-Type':'application/json' }, body: JSON.stringify({ name: newName }) }); } catch {}
      // Ενημέρωση μητρώου (χρειάζεται PATCH στο /api/folders για μόνιμη αποθήκευση)
      const r = await fetch('/api/folders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: folder.id, name: newName }) });
      if (r.ok) { const d = await r.json(); if (d.folders) setFolders(d.folders); }
    } catch (e) {}
    setBusy('');
  };

  // ── Μητρώο ──
  const registerFiles = async (items) => {
    const r = await fetch('/api/registry', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ files: items }) });
    const d = await r.json(); if (d.files) setFiles(d.files);
  };

  // ── Νέο έγγραφο: κενό Google Doc ή αντίγραφο προτύπου → register → άνοιγμα ──
  const createNewDoc = async () => {
    const name = newDocName.trim();
    if (!name || !newDocFolder || newDocBusy) return;
    setNewDocBusy(true);
    try {
      let doc;
      if (newDocTemplate) {
        // Αντιγραφή προτύπου με νέο όνομα, στον επιλεγμένο φάκελο
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${newDocTemplate}/copy?fields=id,name,mimeType`,
          { method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken, 'Content-Type':'application/json' }, body: JSON.stringify({ name, parents:[newDocFolder] }) });
        doc = await res.json();
      } else {
        // Κενό Google Doc
        const meta = { name, mimeType: 'application/vnd.google-apps.document', parents: [newDocFolder] };
        const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType',
          { method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken, 'Content-Type':'application/json' }, body: JSON.stringify(meta) });
        doc = await res.json();
      }
      if (doc.id) {
        await registerFiles([{ id:doc.id, name:doc.name, mimeType:doc.mimeType, folderId:newDocFolder }]);
        window.open(`https://docs.google.com/document/d/${doc.id}/edit`, '_blank');
        setNewDocForm(false); setNewDocName(''); setNewDocFolder(''); setNewDocTemplate('');
      } else {
        alert('Σφάλμα δημιουργίας εγγράφου');
      }
    } catch (e) { alert('Σφάλμα: ' + e.message); }
    setNewDocBusy(false);
  };
  const patchMeta = async (id, body) => {
    setMetaSaving(true);
    try {
      await fetch('/api/registry', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, ...body }) });
    } catch (e) {}
    setMetaSaving(false);
  };

  // ── Ετικέτες & σχόλια ──
  const fileOf = (id) => files.find((f) => f.id === id) || {};
  const fileTags = (id) => fileOf(id).tags || [];
  const fileComment = (id) => fileOf(id).comment || '';
  const addTag = (id, tag) => {
    const t = (tag||'').trim(); if (!t) return;
    const cur = fileTags(id); if (cur.includes(t)) return;
    const next = [...cur, t];
    setFiles((p) => p.map((f) => f.id === id ? { ...f, tags: next } : f));
    patchMeta(id, { tags: next }); setTagInput('');
  };
  const removeTag = (id, tag) => {
    const next = fileTags(id).filter((t) => t !== tag);
    setFiles((p) => p.map((f) => f.id === id ? { ...f, tags: next } : f));
    patchMeta(id, { tags: next });
  };
  const updateComment = (id, value) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, comment: value } : f));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => patchMeta(id, { comment: value }), 800);
  };
  const fileInfo = (id) => fileOf(id).info || '';
  const updateInfo = (id, value) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, info: value } : f));
    if (saveTimerI.current) clearTimeout(saveTimerI.current);
    saveTimerI.current = setTimeout(() => patchMeta(id, { info: value }), 800);
  };
  const fileQuestions = (id) => fileOf(id).questions || '';
  const updateQuestions = (id, value) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, questions: value } : f));
    if (saveTimerQ.current) clearTimeout(saveTimerQ.current);
    saveTimerQ.current = setTimeout(() => patchMeta(id, { questions: value }), 800);
    // Αν το αρχείο είναι PDF δικτύου, αναγέννησε το PDF μετά από μεγαλύτερη καθυστέρηση
    // Αναγνώριση: με pdfFileId, με μόνιμη ταυτότητα networkId, ή με τη σύμβαση ονόματος {δίκτυο}.pdf
    const fObj = fileOf(id);
    const qNet = networksRef.current.find(n => n.pdfFileId === id || (fObj?.networkId && n.id === fObj.networkId) || (fObj?.name && fObj.name === n.name + '.pdf'));
    if (qNet) {
      if (saveTimerPdf.current) clearTimeout(saveTimerPdf.current);
      saveTimerPdf.current = setTimeout(() => regenerateNetworkPdf(id, value, qNet), 2000);
    }
  };
  const fileLinks = (id) => fileOf(id).links || [];
  const addLink = (id, link) => {
    const cur = fileLinks(id);
    const next = [...cur, link];
    setFiles((p) => p.map((f) => f.id === id ? { ...f, links: next } : f));
    patchMeta(id, { links: next });
  };
  const removeLink = (id, idx) => {
    const next = fileLinks(id).filter((_, i) => i !== idx);
    setFiles((p) => p.map((f) => f.id === id ? { ...f, links: next } : f));
    patchMeta(id, { links: next });
  };
  const loadNetwork = async () => {
    try { const r = await fetch('/api/network'); const d = await r.json(); setNetworkData(d); } catch(e) {}
  };

  // ── Στοιχεία επικοινωνίας συνδέσεων ──
  const loadContacts = async () => {
    try { const r = await fetch('/api/contact-info'); const d = await r.json(); setContactInfo(d.contacts || {}); } catch(e) {}
  };
  const openContactPicker = (email) => {
    const existing = contactInfo[email] || {};
    const conn = (networkData.connections||[]).find(c=>c.email===email);
    setContactDraft({
      firstName: existing.firstName || '',
      lastName: existing.lastName || (conn?.name && !conn.name.includes('@') ? conn.name : ''),
      email,
      school: existing.school || '',
      roleTitle: existing.roleTitle || '',
      phone: existing.phone || '',
      note: existing.note || '',
    });
    setContactPicker(email);
  };
  const saveContact = async () => {
    const email = contactPicker;
    if (!email) return;
    setContactInfo(prev => ({ ...prev, [email]: { ...contactDraft } }));
    try { await fetch('/api/contact-info', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, info: contactDraft }) }); } catch(e) {}
    setContactPicker(null);
  };

  // ── Network Builder (Δίκτυα Κειμένων) ─────────────────────────────────
  const loadNetworks = async () => {
    try {
      const r = await fetch('/api/networks');
      const d = await r.json();
      if (!r.ok) return null; // π.χ. 401 στο κρύο ξεκίνημα — ΜΗΝ μηδενίσεις τη λίστα
      const normalized = (d.networks || []).map(n => ({ ...n, items: Array.isArray(n.items) ? n.items : [], tags: Array.isArray(n.tags) ? n.tags : [], comment: n.comment || '', info: n.info || '' }));
      setNetworks(normalized);
      return normalized;
    } catch (e) { return null; } // αποτυχία δικτύου: κράτα ό,τι υπάρχει, θα ξαναδοκιμαστεί
  };
  const saveNetworkData = async (net) => {
    setNetSaving(true); setNetMsg('');
    try {
      const r = await fetch('/api/networks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(net) });
      const d = await r.json();
      if (r.ok) { setNetMsg('✓ Αποθηκεύτηκε'); setTimeout(() => setNetMsg(''), 2000); setNetSaving(false); return d.driveFileId; }
      else setNetMsg('✗ Σφάλμα');
    } catch { setNetMsg('✗ Σφάλμα'); }
    setNetSaving(false);
    return null;
  };
  const createNetworkItem = async () => {
    if (!newNetName.trim() || !newNetFolder) return;
    const net = { id: Date.now().toString(), name: newNetName.trim(), folderId: newNetFolder, items: [], tags: [], comment: '', info: '', pdfFileId: null, driveFileId: null };
    setNewNetName(''); setShowNewNetForm(false);
    const driveFileId = await saveNetworkData(net);
    if (!driveFileId) { setNetMsg('✗ Αποτυχία δημιουργίας'); return; }
    const newNet = { ...net, driveFileId };
    setNetworks(prev => [newNet, ...prev]);
    setCurrentNetwork(newNet);
  };
  const deleteNetworkItem = async (net) => {
    if (!confirm(`Διαγραφή δικτύου «${net.name}»;`)) return;
    if (!net.driveFileId) { setNetworks(prev => prev.filter(n => n.id !== net.id)); if (currentNetwork?.id === net.id) setCurrentNetwork(null); return; }
    try {
      await fetch('/api/networks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: net.id, driveFileId: net.driveFileId }) });
      setNetworks(prev => prev.filter(n => n.id !== net.id));
      if (currentNetwork?.id === net.id) setCurrentNetwork(null);
    } catch { alert('Σφάλμα διαγραφής'); }
  };
  const updateNet = (updated) => {
    const safe = { ...updated, items: Array.isArray(updated.items) ? updated.items : [], tags: Array.isArray(updated.tags) ? updated.tags : [], comment: updated.comment || '', info: updated.info || '' };
    setCurrentNetwork(safe);
    setNetworks(prev => prev.map(n => n.id === safe.id ? safe : n));
  };
  const addFileToNetwork = (file) => {
    if (!currentNetwork) return;
    const currentItems = currentNetwork.items || [];
    if (currentItems.some(i => i.fileId === file.id)) return;
    // Εισαγωγή δομημένων ερωτήσεων
    const metaQ = fileQuestions(file.id);
    let importedQs = [];
    try {
      const parsed = JSON.parse(metaQ);
      if (Array.isArray(parsed)) {
        importedQs = parsed.filter(q => q.text?.trim()).map(q => ({ id: newQid(), code: q.code || '', text: q.text, selected: false }));
      }
    } catch {
      if (metaQ && typeof metaQ === 'string' && metaQ.trim()) {
        importedQs = [{ id: newQid(), code: '', text: metaQ.trim(), selected: false }];
      }
    }
    // Συγκέντρωση ετικετών, σχολίων, πληροφοριών από το αρχείο
    const srcTags = fileTags(file.id);
    const srcComment = fileComment(file.id);
    const srcInfo = fileInfo(file.id);
    const mergedTags = [...new Set([...(currentNetwork.tags || []), ...srcTags])];
    const shortName = (file.name || '').replace(/\.[^.]+$/, '');
    let mergedComment = currentNetwork.comment || '';
    if (srcComment.trim()) {
      mergedComment = mergedComment ? mergedComment + '\n\n' + '▸ ' + shortName + ':\n' + srcComment.trim() : '▸ ' + shortName + ':\n' + srcComment.trim();
    }
    let mergedInfo = currentNetwork.info || '';
    if (srcInfo.trim()) {
      mergedInfo = mergedInfo ? mergedInfo + '\n\n' + '▸ ' + shortName + ':\n' + srcInfo.trim() : '▸ ' + shortName + ':\n' + srcInfo.trim();
    }
    const item = { fileId: file.id, name: file.name, questions: importedQs };
    const updated = { ...currentNetwork, items: [...currentItems, item], tags: mergedTags, comment: mergedComment, info: mergedInfo };
    updateNet(updated); saveNetworkData(updated);
    setOpenAccordions(prev => ({ ...prev, [file.id]: true }));
  };
  const removeFromNetwork = (fileId) => {
    const updated = { ...currentNetwork, items: currentNetwork.items.filter(i => i.fileId !== fileId) };
    updateNet(updated); saveNetworkData(updated);
  };
  const moveNetItem = (idx, dir) => {
    const items = [...currentNetwork.items]; const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    const updated = { ...currentNetwork, items };
    updateNet(updated); saveNetworkData(updated);
  };
  const addNetQuestion = (fileId, code) => {
    const targetFileId = fileId || (currentNetwork.items[0]?.fileId);
    if (!targetFileId) return;
    const items = currentNetwork.items.map(item => item.fileId !== targetFileId ? item : { ...item, questions: [...item.questions, { id: newQid(), code: code || '', text: '', selected: false }] });
    updateNet({ ...currentNetwork, items });
  };
  const updateNetQuestion = (fileId, qid, field, value) => {
    const items = currentNetwork.items.map(item => item.fileId !== fileId ? item : { ...item, questions: item.questions.map(q => q.id === qid ? { ...q, [field]: value } : q) });
    updateNet({ ...currentNetwork, items });
  };
  const removeNetQuestion = (fileId, qid) => {
    const items = currentNetwork.items.map(item => item.fileId !== fileId ? item : { ...item, questions: item.questions.filter(q => q.id !== qid) });
    const updated = { ...currentNetwork, items };
    updateNet(updated); saveNetworkData(updated);
  };
  const toggleNetQuestionSelected = (fileId, qid) => {
    const items = currentNetwork.items.map(item => item.fileId !== fileId ? item : { ...item, questions: item.questions.map(q => q.id === qid ? { ...q, selected: !q.selected } : q) });
    const updated = { ...currentNetwork, items };
    updateNet(updated); saveNetworkData(updated);
  };
  const saveNetQuestionsNow = () => { if (currentNetwork) saveNetworkData(currentNetwork); };

  // ── Αναγέννηση PDF δικτύου όταν αλλάζουν ερωτήσεις από κάρτα/modal ──
  const regenerateNetworkPdf = async (fileId, questionsRaw, netArg) => {
    const net = netArg || networksRef.current.find(n => n.pdfFileId === fileId);
    if (!net || !net.items?.length) return;
    const parsedQs = parseQuestions(questionsRaw);
    const nonEmptyQs = parsedQs.filter(q => q.text?.trim());
    const filteredItems = net.items.map((item, idx) => ({
      ...item,
      questions: idx === 0
        ? nonEmptyQs.map(q => ({ id: 'final_' + q.code, code: q.code, text: q.text, selected: true }))
        : [],
    }));
    // Στόχος του merge: ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΑΓΓΙΞΕ ο χρήστης (fileId) — όχι το τυχόν
    // ξεπερασμένο net.pdfFileId. Έτσι ο δεσμός συγκλίνει στο σωστό αντίγραφο.
    const filteredNetwork = { ...net, pdfFileId: fileId, items: filteredItems };
    try {
      const r = await fetch('/api/networks/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: filteredNetwork }),
      });
      const d = await r.json();
      if (r.ok) {
        const updated = { ...net, pdfFileId: d.pdfFileId, pdfFilename: d.pdfFilename };
        setNetworks(prev => prev.map(n => n.id === net.id ? updated : n));
        saveNetworkData(updated); // μονιμοποίηση του νέου pdfFileId — αλλιώς μετά από reload το δίκτυο «χάνει» το PDF του
        setNetMsg('✓ PDF ενημερώθηκε');
        setTimeout(() => setNetMsg(''), 2500);
        return d.pdfFileId; // νέο id του συγχωνευμένου PDF
      } else {
        setNetMsg('✗ Αποτυχία αναγέννησης PDF');
        setTimeout(() => setNetMsg(''), 2500);
      }
    } catch {
      setNetMsg('✗ Σφάλμα αναγέννησης PDF');
      setTimeout(() => setNetMsg(''), 2500);
    }
    return null;
  };

  // ── Ανανέωση συγχωνευμένου PDF με το ΤΡΕΧΟΝ περιεχόμενο των πηγαίων κειμένων ──
  // Ο server ξαναδιαβάζει τα πηγαία αρχεία σε κάθε συγχώνευση, οπότε τυχόν αλλαγές
  // στα κείμενα ενσωματώνονται. Οι αποθηκευμένες ερωτήσεις του PDF διατηρούνται.
  const [netRefreshing, setNetRefreshing] = useState(null); // id δικτύου σε ανανέωση
  const refreshNetworkPdf = async (net, srcFile) => {
    if ((!net?.pdfFileId && !srcFile?.id) || netRefreshing) return null;
    setNetRefreshing(net.id);
    showPrintToast('⏳ Ανανέωση από τα πηγαία κείμενα…');
    // Στόχος: το αρχείο που πατήθηκε. Ερωτήσεις: ΠΑΝΤΑ από τη ζωντανή κατάσταση
    // (το srcFile μπορεί να είναι παγωμένο στιγμιότυπο του modal με παλιές ερωτήσεις —
    // αν περάσει, η αναγέννηση επαναφέρει/ξαναγράφει τα αρχικά ερωτήματα).
    const targetId = srcFile?.id || net.pdfFileId;
    const fresh = files.find((x) => x.id === targetId);
    const newId = await regenerateNetworkPdf(targetId, (fresh?.questions ?? srcFile?.questions) || '', net);
    await loadAll(); // το pdfFileId μπορεί να άλλαξε — φρέσκια λίστα αρχείων
    hidePrintToast();
    showPrintToast(newId ? '✓ Το PDF ενημερώθηκε' : '✗ Αποτυχία ανανέωσης — δοκίμασε ξανά');
    setTimeout(hidePrintToast, 2500);
    setNetRefreshing(null);
    return newId;
  };
  // Ανανέωση με αφετηρία την ΚΑΡΤΑ ή το modal του συγχωνευμένου αρχείου
  // Εύρεση δικτύου: μόνιμη ταυτότητα networkId → pdfFileId → αποθηκευμένο pdfFilename
  // → σύμβαση ονόματος {όνομα δικτύου}.pdf (καλύπτει παλιά αντίγραφα χωρίς μεταδεδομένα).
  const matchNet = (list, id, name, nid) =>
    (nid ? list.find((n) => n.id === nid) : null)
    || list.find((n) => n.pdfFileId === id)
    || (name ? list.find((n) => (n.pdfFilename && n.pdfFilename === name) || name === n.name + '.pdf') : null)
    || null;
  const netOfFile = (id, name, nid) => matchNet(networks, id, name, nid);
  const netRefreshByFile = async (f) => {
    let net = netOfFile(f.id, f.name, f.networkId);
    if (!net) {
      // Η λίστα δικτύων μπορεί να μη φορτώθηκε (π.χ. 401 στο κρύο ξεκίνημα του PWA) —
      // φρέσκια φόρτωση και δεύτερη προσπάθεια πριν παραδοθούμε.
      const fresh = await loadNetworks();
      if (fresh) net = matchNet(fresh, f.id, f.name, f.networkId);
    }
    if (!net) { alert('Δεν βρέθηκε το δίκτυο αυτού του αρχείου. Άνοιξε το δίκτυο στα «Δίκτυα» και πάτησε Συγχώνευση για να ξαναδεθεί.'); return null; }
    return refreshNetworkPdf(net, f);
  };
  const refreshViewingNetwork = async () => {
    if (!viewing) return;
    const newId = await netRefreshByFile(viewing);
    if (newId) setViewing((v) => v ? { ...v, id: newId, previewUrl: undefined } : v);
  };

  // ── Αυτο-επιδιόρθωση δεσμού δικτύου↔PDF μετά τη φόρτωση ──
  // Δίκτυα από παλαιότερες εκδόσεις δεν έχουν αποθηκευμένο pdfFileId/pdfFilename
  // στο JSON τους → μετά από reload η κάρτα «ξεχνά» ότι το PDF είναι δίκτυο
  // (χάνει το 🔄, εμφανίζει διπλή εκτύπωση+ερωτήσεις). Εδώ ο δεσμός ξαναχτίζεται
  // με τη σύμβαση ονομασίας του merge ({όνομα δικτύου}.pdf) και ΑΠΟΘΗΚΕΥΕΤΑΙ — μία φορά.
  const netHealRan = useRef(false);
  useEffect(() => {
    if (netHealRan.current || !networks.length || !files.length) return;
    netHealRan.current = true;
    const fixes = [];
    for (const n of networks) {
      if (n.pdfFileId && files.some((f) => f.id === n.pdfFileId)) continue; // δεσμός υγιής
      const pdfName = `${n.name}.pdf`;
      const cand = files.find((f) => f.networkId === n.id)
        || files.find((f) => f.name === pdfName && ((f.tags || []).includes('Δίκτυο') || (f.comment || '').startsWith('Δίκτυο:') || f._isNetwork))
        || files.find((f) => f.name === pdfName);
      if (cand && cand.id !== n.pdfFileId) fixes.push({ ...n, pdfFileId: cand.id, pdfFilename: cand.name });
    }
    if (fixes.length) {
      setNetworks((prev) => prev.map((p) => fixes.find((x) => x.id === p.id) || p));
      fixes.forEach((x) => saveNetworkData(x));
    }
  }, [networks, files]);

  // ── Μεταδεδομένα δικτύου (ετικέτες, σχόλια, πληροφορίες) ──
  const addNetTag = (tag) => {
    if (!currentNetwork) return;
    const t = (tag || '').trim(); if (!t) return;
    const cur = currentNetwork.tags || [];
    if (cur.includes(t)) return;
    const updated = { ...currentNetwork, tags: [...cur, t] };
    updateNet(updated); saveNetworkData(updated);
  };
  const removeNetTag = (tag) => {
    if (!currentNetwork) return;
    const updated = { ...currentNetwork, tags: (currentNetwork.tags || []).filter(t => t !== tag) };
    updateNet(updated); saveNetworkData(updated);
  };
  const updateNetComment = (value) => {
    if (!currentNetwork) return;
    const updated = { ...currentNetwork, comment: value };
    updateNet(updated);
    if (saveTimerNetC.current) clearTimeout(saveTimerNetC.current);
    saveTimerNetC.current = setTimeout(() => { if (currentNetRef.current) saveNetworkData(currentNetRef.current); }, 800);
  };
  const updateNetInfo = (value) => {
    if (!currentNetwork) return;
    const updated = { ...currentNetwork, info: value };
    updateNet(updated);
    if (saveTimerNetI.current) clearTimeout(saveTimerNetI.current);
    saveTimerNetI.current = setTimeout(() => { if (currentNetRef.current) saveNetworkData(currentNetRef.current); }, 800);
  };
  const toggleAccordion = (fileId) => setOpenAccordions(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  const mergeAndSave = async () => {
    if (!currentNetwork?.items?.length) { alert('Προσθέστε κείμενα πρώτα.'); return; }
    setMerging(true); setNetMsg('');
    // ── Συγκέντρωση μεταδεδομένων ΠΡΙΝ τη δημιουργία ──
    const allTags = [...new Set(currentNetwork.items.flatMap(item => fileTags(item.fileId)))];
    const allComment = currentNetwork.items
      .map(item => { const c = fileComment(item.fileId); return c.trim() ? '▸ ' + (item.name || '').replace(/\.[^.]+$/, '') + ':\n' + c.trim() : ''; })
      .filter(Boolean).join('\n\n');
    const allInfo = currentNetwork.items
      .map(item => { const inf = fileInfo(item.fileId); return inf.trim() ? '▸ ' + (item.name || '').replace(/\.[^.]+$/, '') + ':\n' + inf.trim() : ''; })
      .filter(Boolean).join('\n\n');
    // Φιλτραρισμένο δίκτυο: μόνο τσεκαρισμένες, ομαδοποιημένες ερωτήσεις → server
    const selectedQs = currentNetwork.items.flatMap(item =>
      (item.questions || []).filter(q => q.selected && q.text?.trim()).map(q => ({ code: q.code || '', text: q.text.trim(), selected: true }))
    );
    const finalQuestions = Q_CODES.map(code => {
      const texts = selectedQs.filter(q => q.code === code).map(q => q.text);
      return { code, text: texts.join('\n\n') };
    }).filter(q => q.text);
    const filteredItems = currentNetwork.items.map((item, idx) => ({
      ...item,
      questions: idx === 0
        ? finalQuestions.map(q => ({ id: 'final_' + q.code, code: q.code, text: q.text, selected: true }))
        : []
    }));
    const filteredNetwork = { ...currentNetwork, items: filteredItems };
    try {
      const r = await fetch('/api/networks/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network: filteredNetwork }) });
      const d = await r.json();
      if (r.ok) {
        const updated = { ...currentNetwork, pdfFileId: d.pdfFileId, pdfFilename: d.pdfFilename };
        updateNet(updated);
        saveNetworkData(updated);
        // Ο server αποθήκευσε ήδη τις ερωτήσεις (ομαδοποιημένες) στο registry.
        // PATCH μόνο tags/comment/info — ΟΧΙ questions (τα χειρίζεται ο server).
        const metaPatch = { _isNetwork: true };
        // ΠΡΟΣΟΧΗ: διατήρηση της ετικέτας «Δίκτυο» — χωρίς αυτήν η κάρτα «ξεχνά»
        // ότι είναι δίκτυο μετά από reload (χάνει το 🔄, εμφανίζει διπλή εκτύπωση+ερωτήσεις)
        if (allTags.length) metaPatch.tags = [...new Set(['Δίκτυο', ...allTags])];
        if (allComment) metaPatch.comment = allComment;
        if (allInfo) metaPatch.info = allInfo;
        if (Object.keys(metaPatch).length) {
          const pr = await fetch('/api/registry', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: d.pdfFileId, ...metaPatch }) });
          const pd = await pr.json();
          if (pd.files) setFiles(pd.files);
        } else {
          await loadAll();
        }
        setNetMsg('✓ PDF + μεταδεδομένα αποθηκεύτηκαν');
      }
      else setNetMsg(`✗ ${d.error || 'Σφάλμα'}`);
    } catch { setNetMsg('✗ Σφάλμα σύνδεσης'); }
    setMerging(false); setTimeout(() => setNetMsg(''), 4000);
  };
  const printWithQuestions = async (f) => {
    const qs = f.questions;
    if (!hasAnyQuestions(qs)) return;
    // Χωρίς window.open: το PDF πάει κατευθείαν στο φύλλο κοινής χρήσης (κινητό)
    // ή στον διάλογο εκτυπωτή (desktop). Στον Safari (Mac) προανοίγουμε καρτέλα
    // (σύγχρονα, στο user gesture) όπου θα φορτωθεί το PDF για εκτύπωση με ⌘P.
    let preWin = null;
    if (isSafariDesktop()) {
      preWin = window.open('', '_blank');
      if (preWin) preWin.document.write('<html><head><title>Εκτύπωση…</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#888">⏳ Δημιουργία PDF…</body></html>');
    }
    showPrintToast();
    try {
      const r = await fetch('/api/print-with-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: f.id, fileName: f.name, questions: qs }),
      });
      if (!r.ok) { if (preWin) preWin.close(); alert('✗ Σφάλμα δημιουργίας PDF'); return; }
      const blob = await r.blob();
      await printPdfBlob(blob, (f.name || 'αρχείο').replace(/\.[^.]+$/, '') + ' — ερωτήσεις', preWin);
    } catch (e) { if (preWin) preWin.close(); alert('✗ ' + e.message); }
    finally { hidePrintToast(); }
  };

  const openLive = async (f) => {
    if (liveSending) return;
    const fLinks = fileLinks(f.id); // μπορεί να είναι κενό — επιτρέπεται live μεμονωμένου
    setLiveSending(true);
    try {
      const r = await fetch('/api/live', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file:{ id:f.id, name:f.name, tags:f.tags||[], questions:f.questions||'' }, links:fLinks }) });
      const d = await r.json();
      if (d.code) {
        const url = `${window.location.origin}/live?code=${d.code}`;
        try { await navigator.clipboard.writeText(url); } catch(e) {}
        setLiveToast({ code:d.code, url });
        setTimeout(() => setLiveToast(null), 8000);
        // Συγχρονισμός πίνακα ελέγχου: αυτό είναι πλέον το ενεργό live
        const its = [{ kind:'file', id:f.id, name:f.name }, ...linksToItems(fLinks)];
        setLiveCenterCode(d.code);
        setLiveSentItems(its);
        setLiveItems(its);
      }
    } catch(e) {}
    setLiveSending(false);
  };

  // ── Κέντρο Live: δημιουργία από πολλαπλά στοιχεία (αρχεία/εφαρμογές/URLs) ──
  const linksToItems = (ls) => (ls || []).map(l => l.type === 'url'
    ? { kind:'url', url:l.url, name:l.name }
    : { kind:'file', id:l.targetId, name:l.name });
  const isInLive = (it) => liveSentItems.some(x => (it.id && x.id === it.id) || (it.url && x.url === it.url));
  const addLiveItem = (it) => setLiveItems(p => p.find(x => (x.id&&x.id===it.id)||(x.url&&x.url===it.url)) ? p : [...p, it]);
  const removeLiveItem = (i) => setLiveItems(p => p.filter((_, idx) => idx !== i));
  const addLiveUrl = () => {
    const u = liveUrlInput.trim();
    if (!u) return;
    const url = toPublicLink(u);
    // Αν δεν δοθεί όνομα, φτιάξε σύντομη ετικέτα (domain) αντί για ολόκληρο το URL
    let label = liveUrlName.trim();
    if (!label) {
      try { const h = new URL(url).hostname.replace('www.',''); label = h + ' …'; } catch { label = url.slice(0, 40) + '…'; }
    }
    addLiveItem({ kind:'url', url, name: label });
    setLiveUrlInput(''); setLiveUrlName('');
  };
  const createLiveFromItems = async () => {
    if (!liveItems.length || liveCenterBusy) return;
    setLiveCenterBusy(true); setLiveCenterCode(null);
    try {
      const r = await fetch('/api/live', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items: liveItems, title: liveItems[0].name }) });
      const d = await r.json();
      if (d.code) { setLiveCenterCode(d.code); setLiveSentItems([...liveItems]); }
    } catch(e) {}
    setLiveCenterBusy(false);
  };

  // ── Προσθήκη ΝΕΩΝ στοιχείων στο ήδη ενεργό live (PATCH /api/live) ──
  const addNewItemsToLive = async () => {
    const fresh = liveItems.filter(it => !isInLive(it));
    if (!fresh.length || liveAddBusy) return;
    setLiveAddBusy(true);
    try {
      for (const it of fresh) {
        const r = await fetch('/api/live', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item: it, code: liveCenterCode }) });
        if (r.ok) {
          setLiveSentItems(p => [...p, it]);
        } else {
          const d = await r.json().catch(() => ({}));
          alert('✗ ' + (d.error || 'Σφάλμα προσθήκης στο live'));
          if (r.status === 404) { setLiveCenterCode(null); setLiveSentItems([]); } // το live έληξε
          break;
        }
      }
    } catch(e) {}
    setLiveAddBusy(false);
  };

  // ── Τερματισμός ενεργού live (DELETE /api/live) ──
  const stopLive = async () => {
    if (!confirm('Να τερματιστεί το ενεργό Live; Οι θεατές θα χάσουν την πρόσβαση.')) return;
    try { await fetch('/api/live', { method:'DELETE' }); } catch(e) {}
    setLiveCenterCode(null);
    setLiveSentItems([]);
  };
  const setVisibility = async (id, visibility) => {
    setPublishing(true);
    let ok = false;
    try {
      const r = await fetch('/api/publish', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, visibility, message: shareMessage.trim() || undefined }) });
      if (r.ok) { setFiles((p) => p.map((f) => f.id === id ? { ...f, visibility, published: visibility !== 'none' } : f)); ok = true; }
    } catch(e) {}
    setPublishing(false);
    if (ok) { setVisibilityPicker(null); setShareMessage(''); }
    else alert('Σφάλμα αποθήκευσης — δοκιμάστε ξανά.');
    return ok;
  };
  const togglePublish = (id) => {
    setShareMessage('');
    setVisibilityDraft(fileOf(id).visibility || 'none'); // ξεκίνα από την αποθηκευμένη κατάσταση
    setVisibilityPicker(id);
  };
  const openNetwork = async () => {
    setActiveView('network');
    setNetworkLoading(true);
    await loadNetwork();
    setNetworkLoading(false);
  };
  const sendInvite = async () => {
    if (!networkInviteEmail.trim()) return;
    setNetworkLoading(true);
    try {
      const r = await fetch('/api/network', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ toEmail:networkInviteEmail.trim() }) });
      const d = await r.json();
      if (d.ok) { setNetworkInviteEmail(''); await loadNetwork(); }
      else alert(d.error || 'Σφάλμα');
    } catch(e) {}
    setNetworkLoading(false);
  };
  const respondInvite = async (fromEmail, action) => {
    try { await fetch('/api/network', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fromEmail, action }) }); await loadNetwork(); } catch(e) {}
  };
  const disconnect = async (email) => {
    if (!confirm(`Αποσύνδεση από ${email};`)) return;
    try { await fetch('/api/network', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) }); await loadNetwork(); } catch(e) {}
  };
  const markInboxSeen = async (fileId) => {
    try { await fetch('/api/network', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'seen', fileId }) }); await loadNetwork(); } catch(e) {}
  };
  const saveInboxToDrive = async (fileId, fileName, targetFolderId) => {
    if (!session?.accessToken) return;
    setBusy('inbox-save');
    try {
      // Server-side αντιγραφή: ο server κατεβάζει το αρχείο και το ανεβάζει στον φάκελο του χρήστη
      const res = await fetch('/api/inbox/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName, targetFolderId }),
      });
      const doc = await res.json();
      if (doc.id) {
        await registerFiles([{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: targetFolderId }]);
        markInboxSeen(fileId);
        setInboxSaveTarget(null);
        alert('✓ Αποθηκεύτηκε στον φάκελο!');
      } else {
        alert('Σφάλμα αντιγραφής: ' + (doc.error || 'Άγνωστο'));
      }
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };
  const toggleFavorite = (id, e) => {
    if (e) e.stopPropagation();
    const cur = !!fileOf(id).favorite;
    setFiles((p) => p.map((f) => f.id === id ? { ...f, favorite: !cur } : f));
    patchMeta(id, { favorite: !cur });
  };

  // ── Picker / Upload (στον τρέχοντα φάκελο) ──
  const openPicker = async () => {
    if (!openFolder) return;
    try {
      setBusy('picker'); await loadPickerApi();
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(false)
        .setMimeTypes('application/pdf,application/vnd.google-apps.document,application/vnd.google-apps.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/html');
      const picker = new window.google.picker.PickerBuilder().addView(view)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(session.accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
        .setAppId(process.env.NEXT_PUBLIC_GOOGLE_APP_ID)
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const items = (data.docs || []).map((d) => ({ id:d.id, name:d.name, mimeType:d.mimeType, folderId: openFolder.id }));
            if (items.length) await registerFiles(items);
          }
          setBusy('');
        }).build();
      picker.setVisible(true);
    } catch (e) { alert('Σφάλμα Picker: ' + e.message + '\n\n(Αν χρησιμοποιείς Safari, ίσως χρειάζεται να επιτρέψεις cookies τρίτων. Εναλλακτικά, χρησιμοποίησε το «Ανέβασμα αρχείου».)'); setBusy(''); }
  };
  const onUpload = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length || !openFolder) return;
    setBusy('upload');
    try {
      const added = [];
      for (const file of list) {
        const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream', parents: [openFolder.id] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
          { method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken }, body: form });
        const doc = await res.json();
        if (doc.id) added.push({ id:doc.id, name:doc.name, mimeType:doc.mimeType, folderId: openFolder.id });
      }
      if (added.length) await registerFiles(added);
      // Προθέρμανση: για Office αρχεία η δημιουργία του PDF αντιγράφου ξεκινά ΤΩΡΑ
      // (fire-and-forget), ώστε το πρώτο άνοιγμα/εκτύπωση από κινητό να είναι άμεσο
      // και να μη σκοντάφτει σε timeout της πρώτης μετατροπής.
      for (const a of added) {
        if (/\.(docx?|pptx?|xlsx?)$/i.test(a.name || '')) {
          fetch('/api/pdf-copy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: a.id, name: a.name }) })
            .then((r) => r.json())
            .then((d) => { if (d.pdfId) setFiles((p) => p.map((x) => x.id === a.id ? { ...x, pdfId: d.pdfId } : x)); })
            .catch(() => {});
        }
      }
    } catch (err) { alert('Σφάλμα ανεβάσματος: ' + err.message); }
    setBusy('');
  };
  const removeFile = async (id) => {
    const choice = prompt('Αφαίρεση αρχείου.\n\n  1 = αφαίρεση μόνο από τη λίστα (μένει στο Drive)\n  2 = διαγραφή και από το Drive (στον κάδο)\n\n(Άκυρο για ακύρωση)', '1');
    if (choice !== '1' && choice !== '2') return;
    const r = await fetch('/api/registry', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, deleteFromDrive: choice === '2' }) });
    const d = await r.json(); if (d.files) setFiles(d.files);
  };

  // ── Άνοιγμα αρχείου (καταγραφή open) ──
  const openViewer = (f) => {
    // optimistic local bump + server record
    setFiles((p) => p.map((x) => x.id === f.id ? { ...x, openCount:(x.openCount||0)+1, openedAt: Date.now() } : x));
    fetch('/api/registry', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: f.id, recordOpen: true }) }).catch(()=>{});
  if (isMobile) {
      const isHtml = /\.html?$/i.test(f.name);
      const isOffice = /\.(docx?|pptx?|xlsx?)$/i.test(f.name);
      const isGNative = !!gEditorType(f.mimeType || ''); // native Google: PDF ροή (το docs.google.com σε iOS ανοίγει επεξεργαστή)
      if (!isHtml) {
        // Όλα προβάλλονται ως PDF μέσω Drive preview (cross-origin → μονοβηματική
        // επιστροφή «◀» στο PWA). Office/native Google χωρίς έτοιμο αντίγραφο: δημιουργία
        // on-demand μέσω /api/pdf-copy (με το token του χρήστη — δουλεύει και για μη δημοσιευμένα).
        if ((isOffice || isGNative) && !f.pdfId) {
          // Με αυτόματο retry: αν η πρώτη μετατροπή κοπεί από timeout, η επόμενη
          // προσπάθεια βρίσκει/ολοκληρώνει το αντίγραφο και ανοίγει κανονικά.
          showPrintToast('⏳ Προετοιμασία προβολής…');
          const tryCopy = (left) => {
            fetch('/api/pdf-copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, name: f.name, mimeType: f.mimeType || '' }) })
              .then((r) => r.json())
              .then((d) => {
                if (d.pdfId) {
                  hidePrintToast();
                  setFiles((p) => p.map((x) => x.id === f.id ? { ...x, pdfId: d.pdfId } : x));
                  window.location.href = `https://drive.google.com/file/d/${d.pdfId}/preview`;
                } else if (left > 0) {
                  showPrintToast('⏳ Η μετατροπή αργεί — νέα προσπάθεια…');
                  setTimeout(() => tryCopy(left - 1), 1200);
                } else { hidePrintToast(); alert('Δεν ήταν δυνατή η προετοιμασία PDF για προβολή. Δοκίμασε ξανά σε λίγο.'); }
              })
              .catch(() => {
                if (left > 0) { showPrintToast('⏳ Η μετατροπή αργεί — νέα προσπάθεια…'); setTimeout(() => tryCopy(left - 1), 1200); }
                else { hidePrintToast(); alert('Σφάλμα προετοιμασίας προβολής. Δοκίμασε ξανά σε λίγο.'); }
              });
          };
          tryCopy(2);
          return;
        }
        const url = (isOffice || isGNative)
          ? `https://drive.google.com/file/d/${f.pdfId}/preview`
          : `https://drive.google.com/file/d/${f.id}/preview`;
        openExternal(url); return;
      }
      // HTML εφαρμογές: παραμένουν same-origin → πέφτουν στον in-app viewer παρακάτω.
    }
    setViewing(f); setShowMetaPanel(false); setTagInput(''); setMobileZoom(1);
  };

  // ── Ομάδες χρηστών (hybrid: server /api/student-groups + localStorage) ──
  const GROUPS_LSKEY = () => 'lev_groups_' + (session?.user?.email || '');
  useEffect(() => {
    if (status !== 'authenticated') return;
    const LS = GROUPS_LSKEY();
    try { const r = localStorage.getItem(LS); const loc = r ? JSON.parse(r) || [] : []; if (loc.length) setGroups(loc); } catch {}
    (async () => {
      try {
        const r = await fetch('/api/student-groups'); const d = await r.json();
        if (Array.isArray(d.groups) && d.groups.length) { setGroups(d.groups); try { localStorage.setItem(LS, JSON.stringify(d.groups)); } catch {} }
      } catch {}
    })();
  }, [status]);
  const saveGroups = async (g) => {
    setGroups(g);
    try { localStorage.setItem(GROUPS_LSKEY(), JSON.stringify(g)); } catch {}
    setGroupMsg('Αποθήκευση…');
    try {
      const r = await fetch('/api/student-groups', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groups: g }) });
      setGroupMsg(r.ok ? '✓ Αποθηκεύτηκε (συγχρονίζεται)' : '✗ Ο server απάντησε ' + r.status);
    } catch { setGroupMsg('✗ Χωρίς server — μόνο τοπικά'); }
    setTimeout(() => setGroupMsg(''), 6000);
  };
  const toggleGroupMember = (email) => setNewGroupMembers(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email]);
  const createGroup = () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    saveGroups([{ id: Date.now().toString(), name: newGroupName.trim(), members: newGroupMembers }, ...groups]);
    setNewGroupName(''); setNewGroupMembers([]); setShowNewGroup(false);
  };
  const deleteGroup = (id) => { if (!confirm('Διαγραφή ομάδας;')) return; saveGroups(groups.filter(g => g.id !== id)); };

  // ── Εισερχόμενα / Απεσταλμένα ανά χρήστη ή ομάδα ──
  // Απεσταλμένα = δημοσιευμένα αρχεία του εκπαιδευτικού με βάση το visibility
  const visTargets = (f) => {
    const v = f.visibility;
    if (!v || v === 'none') return null;
    if (v === 'public') return { pub: true };
    if (v === 'connections') return { all: true };
    if (v.startsWith('user:')) return [v.slice(5)];
    if (v.startsWith('users:')) { try { return JSON.parse(v.slice(6)); } catch { return []; } }
    return null;
  };
  // Νεότερο πρώτα: απεσταλμένα κατά δημοσίευση, εισερχόμενα κατά παραλαβή
  const byNewestSent = (a, b) => ((b.publishedAt || '').localeCompare(a.publishedAt || '')) || ((b.addedAt || 0) - (a.addedAt || 0));
  const byNewestInbox = (a, b) => (b.sentAt || 0) - (a.sentAt || 0);
  const sentToUser = (email) => files.filter(f => { const t = visTargets(f); if (!t) return false; if (t.all) return true; if (Array.isArray(t)) return t.includes(email); return false; }).sort(byNewestSent);
  const sentToGroup = (g) => files.filter(f => { const t = visTargets(f); if (!t) return false; if (t.all) return true; if (Array.isArray(t)) return t.some(e => (g.members || []).includes(e)); return false; }).sort(byNewestSent);
  const allSentFiles = () => files.filter(f => { const v = f.visibility; return v && v !== 'none'; }).sort(byNewestSent);
  const msgInbox = () => [...(networkData.inbox || [])].sort(byNewestInbox);
  const inboxFromUser = (email) => (networkData.inbox || []).filter(i => i.fromEmail === email).sort(byNewestInbox);
  const inboxFromGroup = (g) => (networkData.inbox || []).filter(i => (g.members || []).includes(i.fromEmail)).sort(byNewestInbox);
  const unseenInbox = (list) => list.filter(i => !i.seen).length;
  // Συνολικά νέα εισερχόμενα: υπολογίζεται και client-side (από το seen flag) ώστε το σήμα να δουλεύει πάντα
  const unseenTotal = Math.max(networkData.unseenCount || 0, unseenInbox(networkData.inbox || []));
  const openMessages = async () => { setActiveView('messages'); setOpenFolder(null); setMsgFolder(null); setMsgSearch(''); setMsgWalletActive(null); setMsgStatActive(null); setNetworkLoading(true); await loadNetwork(); setNetworkLoading(false); };

  // ── Αποστολή από φάκελο χρήστη/ομάδας (Εισερχ./Απεστ.): upload → register → publish ──
  const msgRecipients = () => {
    if (msgFolder?.type === 'user') return [msgFolder.email];
    if (msgFolder?.type === 'group') return (msgFolder.group?.members) || [];
    return [];
  };
  const teacherSendFile = async (file, recipients) => {
    const parent = folders[0]?.id;
    const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream', ...(parent ? { parents: [parent] } : {}) };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      { method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken }, body: form });
    const doc = await res.json();
    if (!doc.id) throw new Error(doc.error?.message || 'Σφάλμα ανεβάσματος');
    await registerFiles([{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: parent || '' }]);
    const visibility = recipients.length === 1 ? 'user:' + recipients[0] : 'users:' + JSON.stringify(recipients);
    const r = await fetch('/api/publish', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: doc.id, visibility }) });
    if (!r.ok) throw new Error('Σφάλμα δημοσίευσης');
    setFiles(p => p.map(f => f.id === doc.id ? { ...f, visibility, published: true } : f));
    return doc;
  };
  const handleMsgFileSelect = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length || !msgFolder) return;
    const rcp = msgRecipients();
    if (!rcp.length) { alert('Ο φάκελος δεν έχει παραλήπτες.'); return; }
    setMsgSending(true);
    try { for (const f of list) await teacherSendFile(f, rcp); alert('✅ Εστάλη!'); }
    catch (err) { alert('❌ ' + err.message); }
    setMsgSending(false);
  };
  // Φωτογραφίες → PDF (χωρίς όριο πλήθους)
  const addMsgPhoto = (e) => {
    const fs = Array.from(e.target.files || []);
    if (fs.length) setMsgPhotos(p => [...p, ...fs.map(f => ({ file: f, url: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };
  const removeMsgPhoto = (i) => setMsgPhotos(p => { try { URL.revokeObjectURL(p[i].url); } catch {} return p.filter((_, j) => j !== i); });
  const closeMsgPhotos = () => { msgPhotos.forEach(p => { try { URL.revokeObjectURL(p.url); } catch {} }); setMsgPhotos([]); setMsgPhotoMode(false); };
  const sendMsgPhotosPdf = async () => {
    if (msgPhotos.length === 0 || msgPhotoBusy) return;
    const rcp = msgRecipients();
    if (!rcp.length) { alert('Ο φάκελος δεν έχει παραλήπτες.'); return; }
    setMsgPhotoBusy(true);
    try {
      const pdf = await photosToPdfFile(msgPhotos.map(p => p.file));
      await teacherSendFile(pdf, rcp);
      closeMsgPhotos();
      alert('✅ Εστάλη: ' + pdf.name);
    } catch (err) { alert('❌ Σφάλμα δημιουργίας/αποστολής PDF'); }
    setMsgPhotoBusy(false);
  };

  // ── Live: φωτογραφίες → ενιαίο PDF → ανέβασμα → προσθήκη στη σύνθεση ──
  const addLivePhoto = (e) => {
    const fs = Array.from(e.target.files || []);
    if (fs.length) setLivePhotos(p => [...p, ...fs.map(f => ({ file: f, url: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };
  const removeLivePhoto = (i) => setLivePhotos(p => { try { URL.revokeObjectURL(p[i].url); } catch {} return p.filter((_, j) => j !== i); });
  const clearLivePhotos = () => { livePhotos.forEach(p => { try { URL.revokeObjectURL(p.url); } catch {} }); setLivePhotos([]); };
  const finishLivePhotos = async () => {
    if (!livePhotos.length || livePhotoBusy) return;
    setLivePhotoBusy(true);
    try {
      const pdf = await photosToPdfFile(livePhotos.map(p => p.file));
      const parent = folders[0]?.id;
      const metadata = { name: pdf.name, mimeType: 'application/pdf', ...(parent ? { parents: [parent] } : {}) };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', pdf);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
        { method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken }, body: form });
      const doc = await res.json();
      if (!doc.id) throw new Error(doc.error?.message || 'Αποτυχία ανεβάσματος');
      await registerFiles([{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: parent || '' }]);
      addLiveItem({ kind: 'file', id: doc.id, name: doc.name });
      clearLivePhotos();
    } catch (err) { alert('Σφάλμα: ' + (err.message || 'δημιουργίας PDF')); }
    setLivePhotoBusy(false);
  };

  // Κόκκινο σήμα στο εικονίδιο της εφαρμογής (PWA badge) — κινητό & desktop
  useEffect(() => { try { if ('setAppBadge' in navigator) { const n = unseenTotal; if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch {} }, [unseenTotal]);

  // ── Navigation helpers ──
  const goHome = () => { setActiveView('home'); setOpenFolder(null); setActiveTagFilter(null); setWalletActive(null); setStatActive(null); setCurrentNetwork(null); setShowNewNetForm(false); setInboxFilter(null); setSearchCategory('texts'); };
  const openFolderView = (fld) => { setOpenFolder(fld); setActiveView('folder'); setActiveTagFilter(null); setFolderSearch(''); setWalletActive(null); };
  const openApps = () => {
    setGhOpenFolder(null); setGhSearch('');
    setAppsSubfolder(null);
    setOpenFolder({ id: appsFolderId || 'gh-apps', name: 'Εφαρμογές', isApps: true });
    setActiveView('apps'); setActiveTagFilter(null);
    setAppsFilter(null); setAppsSearchOn(false); setAppsSearchText(''); setAppsTagFilter(null);
    setAppsStatActive(null); setAppsWalletActive(null);
  };
  // Άνοιγμα υποφακέλου εφαρμογών — μένουμε στην προβολή «Εφαρμογές», αλλάζει μόνο το scope
  const openAppSubfolder = (f) => {
    setAppsSubfolder({ id: f.id, name: f.name });
    setOpenFolder({ id: f.id, name: f.name, isApps: true, isSub: true });
    setAppsFilter(null); setAppsSearchOn(false); setAppsSearchText(''); setAppsTagFilter(null);
    setAppsStatActive(null); setAppsWalletActive(null);
  };
  // Δημιουργία υποφακέλου στο Drive (μέσα στον φάκελο Εφαρμογών) + εγγραφή στο μητρώο
  const addAppSubfolder = async () => {
    if (!appsFolderId || !session?.accessToken) return;
    const name = prompt('Όνομα νέου υποφακέλου εφαρμογών:');
    if (!name || !name.trim()) return;
    setBusy('subfolder');
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType', {
        method:'POST', headers:{ Authorization:'Bearer ' + session.accessToken, 'Content-Type':'application/json' },
        body: JSON.stringify({ name: name.trim(), mimeType:'application/vnd.google-apps.folder', parents:[appsFolderId] }),
      });
      const doc = await res.json();
      if (doc.id) await registerFiles([{ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: appsFolderId }]);
      else alert('Σφάλμα δημιουργίας φακέλου' + (doc.error?.message ? ': ' + doc.error.message : ''));
    } catch (e) { alert('Σφάλμα δημιουργίας φακέλου: ' + e.message); }
    setBusy('');
  };

  // ── Wallet renderer (κινητό): στοιβαγμένες κάρτες — κοινό για φακέλους & εφαρμογές ──
  // items: [{ view, type:'stat'|'folder', tone, label/value/sub/unit/icon ή name/desc/icon }]
  // activeId: ποια κάρτα είναι ανοιχτή · onTap(item, isExpanded): χειρισμός αγγίγματος
  const renderWallet = (items, activeId, onTap) => {
    const expandedIdx = items.findIndex(i => i.view === activeId);
    const hasExpanded = expandedIdx >= 0;
    return items.map((item, idx) => {
      const p = PALETTE[item.tone];
      const isExpanded = activeId === item.view;
      const isBefore = hasExpanded && idx < expandedIdx;
      const isAfter = hasExpanded && idx > expandedIdx;

      let mt = idx === 0 ? 0 : -30;
      let ty = 0;
      if (isExpanded)     { mt = idx===0 ? 0 : 16; ty = -8; }
      else if (isBefore)  { mt = idx===0 ? 0 : -38; ty = -4; }
      else if (isAfter)   { mt = -38; ty = 40; }

      return (
        <div key={item.view} className="wallet-card" onClick={() => onTap(item, isExpanded)}
          style={{
            position:'relative',
            zIndex: isExpanded ? 50 : (isBefore ? idx : hasExpanded ? idx : idx+1),
            marginTop: mt,
            borderRadius:22, cursor:'pointer',
            padding:'20px 22px',
            minHeight:115,
            background:`linear-gradient(135deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.12) 45%, transparent 65%), ${p.bg}`,
            boxShadow: isExpanded
              ? '0 14px 44px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.12)'
              : hasExpanded && !isExpanded
                ? '0 1px 4px rgba(0,0,0,0.06)'
                : '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.4s cubic-bezier(0.34,1.4,0.64,1)',
            transform: `translateY(${ty}px) scale(${isExpanded ? 1.03 : hasExpanded ? 0.96 : 1})`,
            opacity: hasExpanded && !isExpanded ? 0.65 : 1,
            display:'flex', flexDirection:'column',
          }}>
          {item.type === 'stat' ? (
            <>
              <div style={S.statInner}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:p.text, opacity:0.75, marginBottom:12 }}>{item.label}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:36, fontWeight:700, lineHeight:1, color:p.text }}>{item.value}</span>
                    <span style={{ fontSize:14, color:p.text, opacity:0.6 }}>{item.unit || 'αρχεία'}</span>
                  </div>
                  <div style={{ fontSize:12, color:p.text, opacity:0.55 }}>{item.sub}</div>
                </div>
                <div style={{ ...S.statIcon, background:p.accent, color:p.deep }}>{item.icon}</div>
              </div>
              {isExpanded && (
                <div style={{ textAlign:'right', marginTop:6 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:p.deep }}>{item.cta || 'Προβολή →'}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ ...S.statIcon, background:p.accent, color:p.deep }}>{item.icon || Icon.folder}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:item.fw||700, color:p.text, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                <div style={{ fontSize:12, color:p.text, opacity:0.6 }}>{item.desc}</div>
              </div>
              {/* Μικρά εικονίδια ενεργειών πάνω στην κάρτα (π.χ. Κοινοποίηση/QR εφαρμογής) — πάντα ορατά */}
              {item.actions && (
                <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={(e)=>e.stopPropagation()}>
                  {item.actions.map((a, ai) => (
                    <button key={ai} onClick={a.onClick} title={a.label}
                      style={{ background:'rgba(255,255,255,0.55)', border:`1px solid ${p.accent}`, borderRadius:9, padding:'6px 8px', color: a.active ? '#16a34a' : p.deep, cursor:'pointer', lineHeight:0 }}>
                      {a.icon}
                    </button>
                  ))}
                </div>
              )}
              {item.badge>0 && <span style={{ background:'#dc2626', color:'#fff', borderRadius:999, padding:'2px 9px', fontSize:12, fontWeight:700, flexShrink:0 }}>{item.badge}</span>}
              {isExpanded && <span style={{ fontSize:13, fontWeight:600, color:p.deep, flexShrink:0 }}>{item.cta || 'Άνοιγμα →'}</span>}
            </div>
          )}
        </div>
      );
    });
  };

  if (status === 'loading' || status === 'unauthenticated' || !minLoadDone) {
    return (
      <div style={S.loading}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <img src="/logo-white.png" alt="Leviathan" style={{ height:'120px', marginBottom:'56px', objectFit:'contain' }} />
        <div style={S.spinner} />
        <div style={{ fontSize:'14px', color:'#8e8ea0' }}>Φόρτωση ΛΕΒΙΑΘΑΝ Cloud...</div>
      </div>
    );
  }

  const userName = session.user?.email?.split('@')[0] || '';
  const countFor = (fid) => files.filter((f) => f.folderId === fid).length;

  // Αρχεία εκτός του φακέλου «Εφαρμογές» (για τις κανονικές λίστες) — εξαιρούνται και όσα βρίσκονται σε υποφακέλους εφαρμογών
  const appSubfolderIds = new Set(files.filter((f) => appsFolderId && f.folderId === appsFolderId && isDriveFolder(f)).map((f) => f.id));
  const normalFiles = files.filter((f) => (!appsFolderId || f.folderId !== appsFolderId) && !appSubfolderIds.has(f.folderId));
  // Φάκελος «Πρότυπα» (με βάση το όνομα) + τα Google Docs μέσα του
  const templatesFolder = folders.find(f => f.name === 'Πρότυπα');
  const templateFiles = templatesFolder
    ? files.filter(f => f.folderId === templatesFolder.id && f.mimeType === 'application/vnd.google-apps.document')
    : [];

  // Παράγωγες λίστες
  const favoriteFiles = normalFiles.filter((f) => f.favorite);
  const newFiles = [...normalFiles].sort((a,b)=>(b.addedAt||0)-(a.addedAt||0)).slice(0,10);
  const recentFiles = normalFiles.filter((f)=>f.openedAt).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0)).slice(0,8);
  const popularFiles = normalFiles.filter((f)=>(f.openCount||0)>0).sort((a,b)=>(b.openCount||0)-(a.openCount||0)).slice(0,8);
  const allTags = [...new Set(normalFiles.flatMap((f)=>f.tags||[]))].sort();

  // Αναζήτηση κατά κατηγορία: Κείμενα / Δίκτυα / Εφαρμογές
  // Αναγνώριση δικτύων: pdfFileId + driveFileId + pdfFilename (δίχτυ για ξεπερασμένα ids) + flag _isNetwork
  const networkFileIds = new Set([
    ...networks.map(n => n.pdfFileId),
    ...networks.map(n => n.driveFileId),
    ...networks.map(n => n.pdfFilename),
  ].filter(Boolean));
  const appFiles = appsFolderId ? files.filter(f => f.folderId === appsFolderId) : [];
  const isNetworkFile = (f) => networkFileIds.has(f.id) || networkFileIds.has(f.name) || f._isNetwork;

  // ── Παράγωγες λίστες «Εφαρμογών» (μόνο πραγματικές εφαρμογές, όχι δίκτυα-PDF, όχι υποφάκελοι) ──
  const appSubfolders = appFiles.filter(isDriveFolder);
  // Ανήκει το αρχείο στον χώρο «Εφαρμογές» (ρίζα ή υποφάκελος); — για απόκρυψη ετικετών/ερωτήσεων
  const appScopeFolderIds = new Set([appsFolderId, ...appSubfolderIds].filter(Boolean));
  const isAppFile = (f) => !!f && appScopeFolderIds.has(f.folderId);
  const appScopeFiles = appsSubfolder ? files.filter(f => f.folderId === appsSubfolder.id) : appFiles;
  const pureAppFiles = appScopeFiles.filter(f => !isNetworkFile(f) && !isDriveFolder(f));
  // ΟΛΕΣ οι εφαρμογές (ρίζα «Εφαρμογών» + υποφάκελοι) για το Live picker —
  // χωρίς τους ίδιους τους υποφακέλους, που εμφανίζονταν λανθασμένα ως «αρχεία».
  const allAppFiles = files.filter(f => appScopeFolderIds.has(f.folderId) && !isDriveFolder(f) && !isNetworkFile(f));
  // ── Εφαρμογές GitHub: επίπεδη λίστα + ψευδο-αρχεία για τα pickers (Συνδέσεις) ──
  const ghAppList = ghApps ? [
    ...(ghApps.root || []).map((a) => ({ ...a, folder: '' })),
    ...(ghApps.folders || []).flatMap((fl) => (fl.apps || []).map((a) => ({ ...a, folder: fl.name }))),
  ] : [];
  const ghAppFiles = ghAppList.map((a) => ({ id: 'gh:' + a.path, name: a.name, mimeType: 'text/html', _ghUrl: ghUrl(a) }));
  const appFavorites = pureAppFiles.filter(f => f.favorite);
  const appRecent = pureAppFiles.filter(f => f.openedAt).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0)).slice(0,8);
  const appPopular = pureAppFiles.filter(f => (f.openCount||0)>0).sort((a,b)=>(b.openCount||0)-(a.openCount||0)).slice(0,8);
  const appTags = [...new Set(pureAppFiles.flatMap(f => f.tags||[]))].sort();

  const textOnlyFiles = normalFiles.filter(f => !isNetworkFile(f));
  const networkOnlyFiles = [...normalFiles.filter(f => isNetworkFile(f)), ...appFiles.filter(f => isNetworkFile(f))];

  const searchPool = searchCategory === 'apps' ? files.filter(f => (f.folderId === appsFolderId || appSubfolderIds.has(f.folderId)) && !isNetworkFile(f) && !isDriveFolder(f))
    : searchCategory === 'networks' ? networkOnlyFiles
    : textOnlyFiles;
  const searchPoolTags = [...new Set(searchPool.flatMap(f => f.tags || []))].sort();

  // Αναζήτηση
  const searchResults = searchPool.filter((f) => {
    if (searchTags.length === 0 && !searchText) return false;
    const tags = f.tags || [];
    const okTags = searchTags.length === 0 || searchTags.every((t)=>tags.includes(t));
    const okText = !searchText || f.name.toLowerCase().includes(searchText.toLowerCase()) || tags.some((t)=>t.toLowerCase().includes(searchText.toLowerCase()));
    return okTags && okText;
  });

  const statConfig = [
    { label:'Αγαπημένα', value:favoriteFiles.length, sub:'Επιλεγμένα αρχεία', view:'favorites', tone:'cream', icon:Icon.star },
    { label:'Νέα', value:newFiles.length, sub:'Πιο πρόσφατα προστέθηκαν', view:'newFiles', tone:'peach', icon:Icon.newDoc },
    { label:'Αναζήτηση', value:allTags.length, sub:'Αναζήτηση με ετικέτες', view:'tagSearch', tone:'mustard', icon:Icon.search },
  ];

  // Λίστα αρχείων προς εμφάνιση σε views
  let viewFiles = [];
  if (activeView === 'favorites') viewFiles = favoriteFiles;
  else if (activeView === 'newFiles') viewFiles = newFiles;
  else if (activeView === 'apps' && openFolder) {
    viewFiles = files.filter((f) => f.folderId === openFolder.id).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); // νεότερο πρώτα
    if (activeTagFilter) viewFiles = viewFiles.filter((f)=>(f.tags||[]).includes(activeTagFilter));
  }
  else if (activeView === 'folder' && openFolder) {
    viewFiles = files.filter((f) => f.folderId === openFolder.id).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); // νεότερο πρώτα
    if (activeTagFilter) viewFiles = viewFiles.filter((f)=>(f.tags||[]).includes(activeTagFilter));
    if (folderSearch.trim()) {
      const q = folderSearch.toLowerCase();
      viewFiles = viewFiles.filter((f) => f.name.toLowerCase().includes(q) || (f.tags||[]).some((t)=>t.toLowerCase().includes(q)));
    }
  }
  const tagsInFolder = openFolder ? [...new Set(files.filter((f)=>f.folderId===openFolder.id).flatMap((f)=>f.tags||[]))].sort() : [];

  const vTags = viewing ? fileTags(viewing.id) : [];
  const vLinks = viewing ? fileLinks(viewing.id) : [];
  const suggested = SUGGESTED_TAGS.filter((t) => !vTags.includes(t));

  // Disabled sidebar item
  const NavItem = ({ icon, label, active, disabled, onClick, badge }) => (
    <button onClick={disabled ? undefined : onClick} className={disabled ? '' : 'nav-h'}
      style={{ ...S.navItem, ...(active ? S.navActive : {}), ...(disabled ? { opacity:0.32, cursor:'default' } : {}), position:'relative' }}
      title={disabled ? 'Σύντομα' : label}>
      <span style={S.navIcon}>{icon}</span>
      {!sidebarCollapsed && <span style={{ flex:1, textAlign:'left' }}>{label}</span>}
      {!sidebarCollapsed && disabled && <span style={{ fontSize:9, opacity:0.7 }}>σύντομα</span>}
      {badge > 0 && <span style={{ position:'absolute', top:4, right:sidebarCollapsed?4:8, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{badge}</span>}
    </button>
  );

  return (
    <div style={S.app}>
      <style>{`
        *{box-sizing:border-box;}
        html,body{margin:0;padding:0;}
        .ch:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.04)!important;}
        @media(hover:hover) and (min-width:768px){ .folder-ch{transition:filter 0.15s, transform 0.2s, box-shadow 0.2s;} .folder-ch:hover{filter:brightness(0.94);} }
        .nav-h:hover{background:rgba(255,255,255,0.06)!important;color:#ececec!important;}
        .ri-h:hover{background:#fcf0e5!important;}
        .del-h:hover{background:#fde8e8!important;color:#dc2626!important;border-color:#f5c6c6!important;}
        .tag-chip:hover .tag-x{opacity:1!important;}
        input:focus,textarea:focus{border-color:#c97b5a!important;outline:none;box-shadow:0 0 0 3px rgba(201,123,90,0.12)!important;}
        .wallet-card{transition:all 0.35s cubic-bezier(.4,0,.2,1);}
        .wallet-card:active{transform:scale(0.97)!important;}
        .btm-item{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;cursor:pointer;padding:4px 0;min-width:0;flex:1;}
        .btm-item svg{width:20px;height:20px;}
        @keyframes pulse-live{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.7);}}
      `}</style>

      {/* ── Sidebar (desktop only) ── */}
      {!isMobile && (
      <aside style={{ ...S.sidebar, width: sidebarCollapsed ? 70 : 260 }}>
        <div style={S.sidebarHeader}>
          {!sidebarCollapsed && <img src="/logo-white.png" alt="Leviathan" style={{ height:'86px', objectFit:'contain' }} />}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={S.collapseBtn}>
            {sidebarCollapsed ? Icon.collapseR : Icon.collapseL}
          </button>
        </div>
        <nav style={S.nav}>
          <NavItem icon={Icon.book} label="Βιβλιοθήκη" active={activeView==='home'} onClick={goHome} />
          <NavItem icon={Icon.filePdf} label="Δημιουργία αρχείου" active={activeView==='netBuilder'}
            onClick={() => { setCreateMenuFolder(''); setCreateMenu(true); }} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.net} label="Δίκτυο" active={activeView==='network'} onClick={openNetwork}
            badge={(networkData.received?.length||0) + unseenTotal} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.apps} label="Εφαρμογές" active={activeView==='apps'} onClick={openApps} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.send} label="Εισερχ./Απεστ." active={activeView==='messages'} onClick={openMessages}
            badge={unseenTotal} />
          <NavItem icon={Icon.live} label="Live" active={activeView==='liveCenter'} onClick={() => { setActiveView('liveCenter'); setOpenFolder(null); }} />
          <NavItem icon={Icon.globe} label="Ανοιχτή πρόσβαση" onClick={() => window.open('/s/' + (session.user?.email?.split('@')[0] || ''), '_blank')} />
          {liveFile && (
            <>
              <div style={S.navDiv} />
              <button className="nav-h" style={{ ...S.navItem, color:'#16a34a', position:'relative' }} title="Live ενεργό" onClick={() => {}}>
                <span style={S.navIcon}>{Icon.live}</span>
                {!sidebarCollapsed && <span style={{ flex:1, textAlign:'left' }}>Live</span>}
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', animation:'pulse-live 1.5s infinite', position:'absolute', top:6, right: sidebarCollapsed ? 4 : 8 }} />
              </button>
            </>
          )}
        </nav>
        <div style={S.sidebarFooter}>
          <div style={S.userCard}>
            <div style={S.userAvatar}>{session.user?.email?.charAt(0).toUpperCase()}</div>
            {!sidebarCollapsed && <div style={S.userInfo}><div style={S.userName}>{userName}</div></div>}
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', marginTop:8, paddingLeft:10, ...(!sidebarCollapsed ? { gap:10 } : {}) }}>
            <button onClick={() => signOut({ callbackUrl:'/login' })} className="nav-h" title="Αποσύνδεση"
              style={{ width:30, height:30, borderRadius:'50%', background:'rgba(220,38,38,0.12)', border:'1.5px solid rgba(220,38,38,0.3)', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, padding:0 }}>
              {Icon.logout}
            </button>
            {!sidebarCollapsed && <span style={{ fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:500 }} onClick={() => signOut({ callbackUrl:'/login' })}>Αποσύνδεση</span>}
          </div>
        </div>
      </aside>
      )}

      {/* ── Bottom Bar (mobile only) ── */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:58, background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:150, borderTop:'1px solid rgba(255,255,255,0.08)', paddingBottom:'env(safe-area-inset-bottom,0)' }}>
          <button className="btm-item" onClick={goHome} style={{ color: activeView==='home'?'#ececec':'#8e8ea0' }}>
            {Icon.book}<span style={{ fontSize:10 }}>Βιβλιοθήκη</span>
          </button>
          <button className="btm-item" onClick={() => { setActiveView('liveCenter'); setOpenFolder(null); }} style={{ color: activeView==='liveCenter'?'#ececec':'#8e8ea0' }}>
            {Icon.live}<span style={{ fontSize:10 }}>Live</span>
          </button>
          <button className="btm-item" onClick={openNetwork} style={{ color: activeView==='network'?'#ececec':'#8e8ea0', position:'relative' }}>
            {Icon.net}<span style={{ fontSize:10 }}>Δίκτυο</span>
            {((networkData.received?.length||0)+unseenTotal) > 0 && (
              <span style={{ position:'absolute', top:0, right:4, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:14, height:14, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {(networkData.received?.length||0)+unseenTotal}
              </span>
            )}
          </button>
          <button className="btm-item" onClick={openApps} style={{ color: activeView==='apps'?'#ececec':'#8e8ea0' }}>
            {Icon.apps}<span style={{ fontSize:10 }}>Εφαρμογές</span>
          </button>
          <button className="btm-item" onClick={openMessages} style={{ color: activeView==='messages'?'#ececec':'#8e8ea0', position:'relative' }}>
            {Icon.send}<span style={{ fontSize:10 }}>Εισερχ./Απεστ.</span>
            {unseenTotal > 0 && (
              <span style={{ position:'absolute', top:0, right:4, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:14, height:14, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{unseenTotal}</span>
            )}
          </button>
          <button className="btm-item" onClick={()=>signOut({callbackUrl:'/login'})} style={{ color:'#dc2626' }}>
            {Icon.logout}<span style={{ fontSize:10 }}>Έξοδος</span>
          </button>
        </nav>
      )}

      {/* ── Main ── */}
      <main style={{ ...S.main, marginLeft: isMobile ? 0 : (sidebarCollapsed ? 70 : 260), paddingBottom: isMobile ? 68 : 0 }}>
        <div style={{ ...S.container, padding: isMobile ? '16px 12px' : '24px 16px' }}>

          {/* HOME */}
          {activeView === 'home' && (
            <>
              <div style={{ marginBottom: isMobile ? 20 : 32 }}>
                <h1 style={{ ...S.welcomeTitle, fontSize: isMobile ? 20 : 26 }}>Γεια σου, {userName}! 👋</h1>
                <p style={{ ...S.welcomeSub, fontSize: isMobile ? 13 : 14 }}>Ας συνεχίσουμε από εκεί που σταματήσαμε</p>
              </div>

              {/* Stat cards */}
              {isMobile ? (()=>{
                const statsItems = statConfig.map(s => ({ type:'stat', ...s }));
                const folderItems = folders.map((fld, i) => ({
                  type:'folder', view: fld.id, id: fld.id, name: fld.name,
                  desc: fld.description || (countFor(fld.id) + ' αρχεία'),
                  tone: TONES[i % TONES.length],
                  // pass folder object for openFolderView
                  ...fld,
                }));

                return (
                  <>
                    <div style={{ position:'relative', marginBottom:28, paddingBottom:8 }}>
                      {renderWallet(statsItems, statActive, (item, isExpanded) => {
                        if (isExpanded) { setStatActive(null); setActiveView(item.view); }
                        else setStatActive(item.view);
                      })}
                    </div>
                    <section style={{ marginBottom:24 }}>
                      <h2 style={{ ...S.secTitle, marginBottom:12, fontSize:15 }}>Οι φάκελοί μου</h2>
                      <div style={{ position:'relative', marginBottom:8, paddingBottom:8 }}>
                        {renderWallet(folderItems, walletActive, (item, isExpanded) => {
                          if (isExpanded) { setWalletActive(null); openFolderView(item); }
                          else setWalletActive(item.view);
                        })}
                      </div>
                      <div style={{ textAlign:'center', padding:'6px 0' }}>
                        <button onClick={addFolder} disabled={busy==='folder'}
                          style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:9, border:`1.5px solid ${PALETTE.cream.accent}`, background:'transparent', color:PALETTE.cream.deep, fontSize:11, fontWeight:600, cursor:'pointer', opacity:0.7 }}>
                          <span style={{ fontSize:13, lineHeight:1 }}>＋</span> {busy==='folder' ? '…' : 'Νέος'}
                        </button>
                      </div>
                    </section>
                  </>
                );
              })()
              : (
                /* ═══ DESKTOP: Stats + Folders grid ═══ */
                <>
                  <div style={{ ...S.statsGrid, gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14, marginBottom:40 }}>
                    {statConfig.map((s) => {
                      const p = PALETTE[s.tone];
                      return (
                        <div key={s.view} className="ch" onClick={() => setActiveView(s.view)}
                          style={{ ...S.statCard, cursor:'pointer', background:`linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 45%, transparent 65%), ${p.bg}` }}>
                          <div style={S.statInner}>
                            <div>
                              <div style={{ ...S.statLabel, color:p.text }}>{s.label}</div>
                              <div style={{ ...S.statVal, color:p.text }}>{s.value}</div>
                              <div style={{ ...S.statSub, color:p.text, opacity:0.7 }}>{s.sub}</div>
                            </div>
                            <div style={{ ...S.statIcon, background:p.accent, color:p.deep }}>{s.icon}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <section style={{ marginBottom:44 }}>
                    <h2 style={S.secTitle}>Οι φάκελοί μου</h2>
                    <div style={S.cardsGrid}>
                      {folders.map((fld, i) => {
                        const p = PALETTE[TONES[i % TONES.length]];
                        return (
                          <div key={fld.id} className="ch folder-ch" onClick={() => openFolderView(fld)}
                            style={{ ...S.folderCard, background:`linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 45%, transparent 65%), ${p.bg}` }}>
                            <div style={S.folderTop}>
                              <div style={{ ...S.folderIcon, background:p.accent, color:p.deep }}>{Icon.folder}</div>
                            </div>
                            <h3 style={{ ...S.folderTitle, color:p.text }}>{fld.name}</h3>
                            <p style={{ ...S.folderDesc, color:p.text, opacity:0.65 }}>{countFor(fld.id)} αρχεία</p>
                            <div style={{ ...S.folderFoot, borderTopColor:p.accent }}>
                              <button style={{ ...S.linkBtn, color:p.deep }}>Άνοιγμα →</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop:10, textAlign:'left' }}>
                      <button onClick={addFolder} disabled={busy==='folder'}
                        style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:10, border:`1.5px solid ${PALETTE.cream.accent}`, background:'transparent', color:PALETTE.cream.deep, fontSize:12, fontWeight:600, cursor:'pointer', opacity:0.75 }}>
                        <span style={{ fontSize:14, lineHeight:1 }}>＋</span> {busy==='folder' ? 'Δημιουργία…' : 'Νέος φάκελος'}
                      </button>
                    </div>
                  </section>
                </>
              )}

              {/* Πρόσφατα / Δημοφιλή */}
              {(recentFiles.length > 0 || popularFiles.length > 0) && (
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 20, marginBottom: isMobile ? 24 : 44 }}>
                  <section>
                    <h2 style={{ ...S.secTitle, display:'flex', alignItems:'center', gap:8 }}>{Icon.clock} Πρόσφατα</h2>
                    <div style={S.recentList}>
                      {recentFiles.length === 0
                        ? <div style={S.empty}>Δεν έχεις ανοίξει αρχεία ακόμα</div>
                        : recentFiles.map((f, idx) => (
                          <div key={f.id} className="ri-h" style={{ ...S.recentItem, borderBottom: idx<recentFiles.length-1?'1px solid #f0f0f0':'none' }} onClick={() => openViewer(f)}>
                            <span style={{ fontSize:16, flexShrink:0 }}>📄</span>
                            <div style={S.recentInfo}><div style={S.recentTitle}>{trunc(f.name, isMobile ? 15 : 30)}</div></div>
                            <button onClick={(e)=>{e.stopPropagation();setQrFile(f);}} style={{ ...btn('mini'), padding:'3px 5px', flexShrink:0 }} title="QR">{QrIcon}</button>
                          </div>
                        ))}
                    </div>
                  </section>
                  <section>
                    <h2 style={{ ...S.secTitle, display:'flex', alignItems:'center', gap:8 }}>{Icon.bolt} Δημοφιλή</h2>
                    <div style={S.recentList}>
                      {popularFiles.length === 0
                        ? <div style={S.empty}>Άνοιξε μερικά αρχεία για να εμφανιστούν εδώ</div>
                        : popularFiles.map((f, idx) => (
                          <div key={f.id} className="ri-h" style={{ ...S.recentItem, borderBottom: idx<popularFiles.length-1?'1px solid #f0f0f0':'none' }} onClick={() => openViewer(f)}>
                            <div style={{ width:24, height:24, borderRadius:8, background:PALETTE.mustard.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:PALETTE.mustard.deep }}>{f.openCount}</div>
                            <div style={S.recentInfo}><div style={S.recentTitle}>{trunc(f.name, isMobile ? 15 : 30)}</div></div>
                            <button onClick={(e)=>{e.stopPropagation();setQrFile(f);}} style={{ ...btn('mini'), padding:'3px 5px', flexShrink:0 }} title="QR">{QrIcon}</button>
                          </div>
                        ))}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

          {/* FOLDER VIEW */}
          {activeView === 'folder' && openFolder && (
            <>
              <div style={{ ...S.pageHeader, gap: isMobile ? 8 : 14 }}>
                <button onClick={goHome} style={{ ...S.backBtn, padding: isMobile ? '6px 10px' : '8px 16px', fontSize: isMobile ? 12 : 13 }}>← Πίσω</button>
                <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 17 : 22 }}>{openFolder.name}</h1>
                <div style={{ flex:1 }} />
                {/* Κανονικός φάκελος */}
                {isMobile ? (
                  <>
                    {/* Κινητό: 3 μικρά εικονίδια — Merge · Drive · Ανέβασμα */}
                    <button onClick={() => { setNewNetFolder(openFolder.id); setNewNetName(openFolder.name + ' — συγχώνευση'); setActiveView('netBuilder'); setShowNewNetForm(true); }} disabled={!!busy} style={{ ...btn('mini'), padding:'7px 11px', fontSize:15 }} title="Συγχώνευση σε PDF">🔗</button>
                    <button onClick={openPicker} disabled={!!busy} style={{ ...btn('mini'), padding:'7px 11px', fontSize:15 }} title="Από Google Drive">{busy==='picker'?'…':'📁'}</button>
                    <button onClick={() => uploadRef.current?.click()} disabled={!!busy} style={{ ...btn('mini'), padding:'7px 11px', fontSize:15 }} title="Ανέβασμα αρχείου">{busy==='upload'?'…':'⬆️'}</button>
                  </>
                ) : (
                  <>
                    {/* Desktop: +Νέο · +Drive · +Ανέβασμα */}
                    <button onClick={() => { setCreateMenuFolder(openFolder.id); setCreateMenu(true); }} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', opacity:0.85 }} title="Νέο έγγραφο ή συγχώνευση σε αυτόν τον φάκελο">＋ Νέο</button>
                    <button onClick={openPicker} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', opacity:0.7 }} title="Επιλογή από Google Drive">{busy==='picker'?'…':'＋ Drive'}</button>
                    <button onClick={() => uploadRef.current?.click()} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', opacity:0.7 }} title="Ανέβασμα αρχείου">{busy==='upload'?'…':'＋ Ανέβασμα'}</button>
                  </>
                )}
                <input ref={uploadRef} type="file" multiple onChange={onUpload} style={{ display:'none' }} />
              </div>
              <input type="search" placeholder="Αναζήτηση με όνομα ή ετικέτα στον φάκελο…" value={folderSearch} onChange={(e)=>setFolderSearch(e.target.value)}
                style={{ width:'100%', padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:12, fontSize: isMobile ? 16 : 13, background:'#fff', marginBottom:12 }} />
              {/* Διαχείριση φακέλου (μόνο desktop) — μέσα στον φάκελο για αποφυγή κατά λάθος πατήματος */}
              {!isMobile && !openFolder.isApps && (
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <button onClick={() => renameFolder(openFolder)} disabled={!!busy}
                    style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', color:PALETTE.cream.deep, borderColor:PALETTE.cream.accent }} title="Μετονομασία φακέλου">✎ Μετονομασία</button>
                  <button onClick={() => removeFolder(openFolder)} disabled={!!busy}
                    style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', color:'#dc2626', borderColor:'#fca5a5' }} title="Διαγραφή φακέλου">✕ Διαγραφή φακέλου</button>
                </div>
              )}
              <FileList files={viewFiles} loading={loading} empty="Κανένα αρχείο σε αυτόν τον φάκελο." onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onInfo={updateInfo} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} appFiles={ghAppFiles} folders={folders} compact={isMobile} userRole={userRole} onQr={setQrFile} suggestedUrls={allSuggestedUrls} onPrint={printWithQuestions} networkFileIds={networkFileIds} onNetRefresh={netRefreshByFile} />
            </>
          )}

          {/* APPS VIEW — εφαρμογές από το GitHub (public/apps) μέσω apps-manifest.json */}
          {activeView === 'apps' && (() => {
            const ghFolders = ghApps ? (ghApps.folders || []) : [];
            const inFolder = ghOpenFolder ? ghFolders.find(fl => fl.name === ghOpenFolder) : null;
            const q = ghSearch.trim().toLowerCase();
            const scope = q
              ? ghAppList.filter(a => (a.name || '').toLowerCase().includes(q) || (a.folder || '').toLowerCase().includes(q) || (a.path || '').toLowerCase().includes(q))
              : inFolder ? (inFolder.apps || []).map(a => ({ ...a, folder: inFolder.name }))
              : (ghApps ? (ghApps.root || []) : []).map(a => ({ ...a, folder: '' }));
            const showFolders = !q && !ghOpenFolder;
            const copyGh = (a) => { try { navigator.clipboard.writeText(ghUrl(a)); setGhCopied(a.path); setTimeout(() => setGhCopied(null), 1600); } catch {} };
            return (
            <>
              <div style={{ ...S.pageHeader, gap: isMobile ? 8 : 14 }}>
                <button onClick={ghOpenFolder ? () => { setGhOpenFolder(null); setGhSearch(''); } : goHome} style={{ ...S.backBtn, padding: isMobile ? '6px 10px' : '8px 16px', fontSize: isMobile ? 12 : 13 }}>← Πίσω</button>
                <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 17 : 22 }}>{ghOpenFolder ? <>📂 {trunc(ghOpenFolder, isMobile ? 14 : 30)}</> : 'Εφαρμογές'}</h1>
                <div style={{ flex:1 }} />
                <span style={{ fontSize:11, fontWeight:700, color:'#8a7d4a', background:'#efe9d5', padding:'4px 10px', borderRadius:999, whiteSpace:'nowrap' }}>⚡ GitHub</span>
              </div>
              <p style={{ fontSize:13, color:'#6b6b80', marginTop:-8, marginBottom:14 }}>
                Οι εφαρμογές φορτώνονται αυτόματα από το GitHub (φάκελος public/apps). Ανέβασε ένα .html σε υποφάκελο και, μετά το deploy, εμφανίζεται εδώ.
              </p>
              <input type="search" placeholder="Αναζήτηση εφαρμογής…" value={ghSearch} onChange={(e) => setGhSearch(e.target.value)}
                style={{ width:'100%', padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:12, fontSize: isMobile ? 16 : 13, background:'#fff', marginBottom:20 }} />
              {ghApps === null ? <div style={S.empty}>Φόρτωση…</div> : (
                <>
                  {ghAppsError && (
                    <div style={{ padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', borderRadius:12, fontSize:12, marginBottom:16 }}>
                      Δεν βρέθηκε το apps-manifest.json. Βεβαιώσου ότι υπάρχει το scripts/generate-apps-manifest.js και το «prebuild» στο package.json.
                    </div>
                  )}
                  {showFolders && ghFolders.length > 0 && (
                    <div style={{ ...S.cardsGrid, marginBottom: scope.length ? 22 : 0 }}>
                      {ghFolders.map((fl) => (
                        <div key={fl.name} className="ch" onClick={() => setGhOpenFolder(fl.name)}
                          style={{ ...S.folderCard, background:'#fbfaf4', border:'1.5px dashed #c9bd93' }}>
                          <div style={S.folderTop}>
                            <div style={{ ...S.folderIcon, background:'#efe9d5', color:'#8a7d4a' }}>{Icon.folder}</div>
                          </div>
                          <h3 style={{ ...S.folderTitle, color:'#3d3a2e' }}>📂 {trunc(fl.name, 24)}</h3>
                          <p style={{ ...S.folderDesc, color:'#3d3a2e', opacity:0.6 }}>Υποφάκελος GitHub · {(fl.apps || []).length} εφαρμογές</p>
                          <div style={{ ...S.folderFoot, borderTopColor:'#e5ddc2' }}>
                            <button style={{ ...S.linkBtn, color:'#8a7d4a' }}>Άνοιγμα φακέλου →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {scope.length === 0 && !(showFolders && ghFolders.length > 0)
                    ? <div style={S.empty}>{q ? 'Καμία εφαρμογή δεν ταιριάζει στην αναζήτηση.' : 'Καμία εφαρμογή ακόμα — ανέβασε .html αρχεία στο public/apps του GitHub.'}</div>
                    : scope.length > 0 && (
                      <div style={S.cardsGrid}>
                        {scope.map((a) => (
                          <div key={a.path} className="ch" style={{ ...S.folderCard, background:'#fff' }}>
                            <div style={S.folderTop}>
                              <div style={{ ...S.folderIcon, background:PALETTE.mustard.bg, color:PALETTE.mustard.deep, fontSize:18 }}>⚡</div>
                              <button onClick={(e) => { e.stopPropagation(); setQrFile({ id:'gh:' + a.path, name:a.name, _ghUrl:ghUrl(a) }); }} title="QR"
                                style={{ background:'transparent', border:'none', cursor:'pointer', color:'#8a7d4a', padding:2 }}>{QrIcon}</button>
                            </div>
                            <h3 style={S.folderTitle}>{trunc(a.name, 42)}</h3>
                            <p style={{ ...S.folderDesc, opacity:0.55, fontSize:11, wordBreak:'break-all' }}>{(a.folder ? a.folder + ' / ' : '') + a.path.split('/').slice(-1)[0]}</p>
                            <div style={{ ...S.folderFoot, borderTopColor:'#f0f0f0', display:'flex', gap:6, flexWrap:'wrap' }}>
                              <button onClick={() => window.open(ghUrl(a), '_blank')} style={{ ...btn('mini'), color:PALETTE.mustard.deep }}>Άνοιγμα ↗</button>
                              <button onClick={() => copyGh(a)} style={{ ...btn('mini'), color: ghCopied === a.path ? '#16a34a' : '#555' }}>{ghCopied === a.path ? '✓ Αντιγράφηκε' : '🔗 Λινκ'}</button>
                              <button onClick={() => addLiveItem({ kind:'url', url:ghUrl(a), name:a.name })} style={{ ...btn('mini'), color:'#5c7a3a' }}>➕ Live</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}
            </>
            );
          })()}

          {/* ΔΗΜΙΟΥΡΓΙΑ ΔΙΚΤΥΟΥ ΚΕΙΜΕΝΩΝ */}
          {activeView === 'netBuilder' && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <div style={{ flex:1 }}>
                  <h1 style={S.pageTitle}>Δίκτυα Κειμένων</h1>
                  <p style={{ fontSize:13, color:'#6b6b80', margin:0 }}>Δημιουργία δικτύου κειμένων · κριτηρίου · ενοποίηση αρχείων</p>
                </div>
                <button onClick={() => setShowNewNetForm(true)} style={{ ...btn('solid'), whiteSpace:'nowrap' }}>+ Νέο Δίκτυο</button>
              </div>

              {/* Φόρμα δημιουργίας */}
              {showNewNetForm && (
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:24, padding:18, background:PALETTE.mustard.bgSoft, borderRadius:16, flexWrap:'wrap' }}>
                  <input autoFocus type="text" placeholder="Όνομα δικτύου…" value={newNetName} onChange={e => setNewNetName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createNetworkItem(); if (e.key === 'Escape') setShowNewNetForm(false); }}
                    style={{ flex:1, minWidth:180, padding:'10px 16px', border:'1px solid ' + PALETTE.mustard.accent, borderRadius:10, fontSize:isMobile ? 16 : 14, background:'#fff' }} />
                  <select value={newNetFolder} onChange={e => setNewNetFolder(e.target.value)}
                    style={{ padding:'10px 14px', border:'1px solid ' + PALETTE.mustard.accent, borderRadius:10, fontSize:isMobile ? 16 : 13, background:'#fff', color:newNetFolder ? '#1a1a1a' : '#aeaeb8', minWidth:160 }}>
                    <option value="" disabled>Φάκελος αποθήκευσης…</option>
                    {folders.map(fld => <option key={fld.id} value={fld.id}>{fld.name}</option>)}
                  </select>
                  <button onClick={createNetworkItem} disabled={!newNetName.trim() || !newNetFolder} style={{ ...btn('solid'), background:PALETTE.mustard.deep, opacity:(!newNetName.trim() || !newNetFolder) ? 0.5 : 1 }}>Δημιουργία</button>
                  <button onClick={() => setShowNewNetForm(false)} style={{ ...btn('outline'), color:'#6b6b80', borderColor:'#e0e0e0' }}>Ακύρωση</button>
                </div>
              )}

              {/* Λίστα δικτύων */}
              {!currentNetwork && (
                networks.length === 0
                  ? <div style={{ textAlign:'center', paddingTop:48 }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>🕸️</div>
                      <div style={{ color:'#aeaeb8', fontSize:13 }}>Δεν υπάρχουν δίκτυα ακόμα</div>
                    </div>
                  : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {networks.map(net => {
                        const fld = folders.find(f => f.id === net.folderId);
                        return (
                          <div key={net.id} className="ch" style={{ background:'#fff', borderRadius:16, padding:'16px 20px', border:'1px solid #ebebeb', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                              <div style={{ width:40, height:40, borderRadius:12, background:PALETTE.mustard.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {Icon.net}
                              </div>
                              <div>
                                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{net.name}</div>
                                <div style={{ fontSize:12, color:'#6b6b80' }}>
                                  {(net.items || []).length} κείμενα
                                  {fld && <span style={{ marginLeft:6, color:'#aeaeb8' }}>· {fld.name}</span>}
                                  {(net.tags || []).length > 0 && <span style={{ marginLeft:6, color:'#aeaeb8' }}>· 🏷️{(net.tags || []).length}</span>}
                                  {(net.comment || '').trim() && <span style={{ marginLeft:4, color:'#aeaeb8' }}>· 💬</span>}
                                  {(net.info || '').trim() && <span style={{ marginLeft:4, color:'#aeaeb8' }}>· ℹ️</span>}
                                  {net.pdfFileId && <span style={{ color:PALETTE.mustard.deep, marginLeft:8 }}>· PDF ✓</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <button onClick={() => setCurrentNetwork(net)} style={{ ...btn('outline'), color:PALETTE.mustard.deep, borderColor:PALETTE.mustard.deep }}>Επεξεργασία →</button>
                              {net.pdfFileId && <button onClick={() => window.open('https://drive.google.com/file/d/' + net.pdfFileId + '/view', '_blank')} style={{ ...btn('mini'), color:'#6b6b80' }}>📄 PDF</button>}
                              {net.pdfFileId && (
                                <button onClick={() => refreshNetworkPdf(net)} disabled={!!netRefreshing}
                                  title="Αναδημιουργία του συγχωνευμένου PDF με το τρέχον περιεχόμενο των κειμένων (οι ερωτήσεις διατηρούνται)"
                                  style={{ ...btn('mini'), color:'#15803d', borderColor:'#bbf7d0', opacity: netRefreshing && netRefreshing !== net.id ? 0.5 : 1 }}>
                                  {netRefreshing === net.id ? '⏳' : '🔄 Ανανέωση'}
                                </button>
                              )}
                              <button onClick={() => deleteNetworkItem(net)} style={{ ...btn('mini'), color:'#dc2626', borderColor:'#fca5a5' }}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
              )}

              {/* Επεξεργασία δικτύου */}
              {currentNetwork && (
                <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

                  {/* Αριστερά — file picker */}
                  <div style={{ width: isMobile ? '100%' : 320, flexShrink:0, background:PALETTE.cream.bgSoft, borderRadius:16, padding:14, border:'1px solid ' + PALETTE.cream.accent }}>
                    <div style={{ display:'flex', gap:0, marginBottom:10, borderRadius:10, overflow:'hidden', border:'1px solid #e0e0e0' }}>
                      <button onClick={() => { setPickerMode('texts'); setPickerSearch(''); }}
                        style={{ flex:1, padding:'6px 0', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', border:'none', cursor:'pointer',
                          background: pickerMode === 'texts' ? PALETTE.mustard.deep : '#fff', color: pickerMode === 'texts' ? '#fff' : '#888' }}>
                        Κείμενα
                      </button>
                      {appsFolderId && (
                        <button onClick={() => { setPickerMode('apps'); setPickerSearch(''); }}
                          style={{ flex:1, padding:'6px 0', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', border:'none', borderLeft:'1px solid #e0e0e0', cursor:'pointer',
                            background: pickerMode === 'apps' ? PALETTE.mustard.deep : '#fff', color: pickerMode === 'apps' ? '#fff' : '#888' }}>
                          Εφαρμογές
                        </button>
                      )}
                    </div>
                    <input type="search" placeholder={pickerMode === 'texts' ? 'Αναζήτηση τίτλου ή ετικέτας…' : 'Αναζήτηση εφαρμογής…'} value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                      style={{ width:'100%', padding:'8px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile ? 16 : 12, background:'#fff', marginBottom:10, boxSizing:'border-box' }} />
                    <div style={{ maxHeight: isMobile ? 240 : 'calc(100vh - 380px)', overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                      {(pickerMode === 'texts' ? normalFiles : files.filter(f => appsFolderId && f.folderId === appsFolderId)).filter(f => {
                        if (!pickerSearch) return true;
                        const q = pickerSearch.toLowerCase();
                        return (f.name || '').toLowerCase().includes(q) || (f.tags || []).some(t => t.toLowerCase().includes(q));
                      }).map(file => {
                        const already = currentNetwork.items.some(i => i.fileId === file.id);
                        return (
                          <div key={file.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:10, background: already ? PALETTE.mustard.bgSoft : '#fff', border:'1px solid ' + (already ? PALETTE.mustard.accent : '#ebebeb') }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{(file.name || '').length > 20 ? file.name.slice(0, 20) + '…' : file.name}</div>
                            </div>
                            {already
                              ? <span style={{ fontSize:11, color:PALETTE.mustard.deep, flexShrink:0, minWidth:16, textAlign:'center' }}>✓</span>
                              : <button onClick={() => addFileToNetwork(file)} style={{ background:PALETTE.mustard.deep, border:'none', color:'#fff', width:24, height:24, borderRadius:6, fontSize:14, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Δεξιά — δίκτυο + ερωτήσεις */}
                  <div style={{ flex:1, minWidth:0, width: isMobile ? '100%' : 'auto' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, flexWrap:'wrap' }}>
                      <button onClick={() => setCurrentNetwork(null)} style={S.backBtn}>← Λίστα</button>
                      <div style={{ flex:1 }}>
                        <h2 style={{ fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{currentNetwork.name}</h2>
                        <p style={{ fontSize:13, color:'#6b6b80', margin:0 }}>
                          {currentNetwork.items.length} κείμενα
                          {(() => { const sel = currentNetwork.items.flatMap(i => (i.questions || []).filter(q => q.selected)); return sel.length > 0 ? <span style={{ marginLeft:6, color:PALETTE.mustard.deep, fontWeight:600 }}>· {sel.length} ερωτ. ✓</span> : null; })()}
                          {netSaving && <span style={{ marginLeft:8, color:PALETTE.mustard.deep, fontSize:12 }}>· Αποθήκευση…</span>}
                          {netMsg && <span style={{ marginLeft:8, color: netMsg.startsWith('✓') ? PALETTE.mustard.deep : '#dc2626', fontSize:12 }}>{netMsg}</span>}
                        </p>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        {currentNetwork.pdfFileId && <button onClick={() => window.open('https://drive.google.com/file/d/' + currentNetwork.pdfFileId + '/view', '_blank')} style={{ ...btn('mini'), color:'#6b6b80' }}>📄 PDF</button>}
                        <button onClick={mergeAndSave} disabled={merging || !currentNetwork.items.length}
                          style={{ ...btn('solid'), background:'#1a1a1a', opacity: (merging || !currentNetwork.items.length) ? 0.6 : 1 }}>
                          {merging ? '⏳ Δημιουργία…' : `💾 ${currentNetwork.pdfFileId ? 'Ενημέρωση PDF' : 'Αποθήκευση PDF'}`}
                        </button>
                      </div>
                    </div>

                    {currentNetwork.items.length === 0
                      ? <div style={{ textAlign:'center', padding:48, color:'#aeaeb8', fontSize:13, background:PALETTE.cream.bgSoft, borderRadius:16, border:'2px dashed ' + PALETTE.cream.accent }}>
                          Πάτησε «+» δίπλα σε ένα κείμενο {isMobile ? 'πάνω' : 'αριστερά'} για να ξεκινήσεις
                        </div>
                      : <>
                          {/* Κείμενα — compact λίστα */}
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'10px 14px', marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Κείμενα ({currentNetwork.items.length})</div>
                            {currentNetwork.items.map((item, idx) => (
                              <div key={item.fileId} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderTop: idx > 0 ? '1px solid #f0f0f0' : 'none' }}>
                                <span style={{ width:22, height:22, borderRadius:'50%', background:'#1a1a1a', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx + 1}</span>
                                <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{item.name}</span>
                                {fileTags(item.fileId).length > 0 && <span style={{ fontSize:9, color:'#aeaeb8' }}>🏷️</span>}
                                {fileComment(item.fileId).trim() && <span style={{ fontSize:9, color:'#aeaeb8' }}>💬</span>}
                                {fileInfo(item.fileId).trim() && <span style={{ fontSize:9, color:'#aeaeb8' }}>ℹ️</span>}
                                <button onClick={() => moveNetItem(idx, -1)} disabled={idx === 0} style={{ ...S.iconBtn, width:24, height:24, fontSize:11, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                                <button onClick={() => moveNetItem(idx, 1)} disabled={idx === currentNetwork.items.length - 1} style={{ ...S.iconBtn, width:24, height:24, fontSize:11, opacity: idx === currentNetwork.items.length - 1 ? 0.3 : 1 }}>↓</button>
                                <button onClick={() => removeFromNetwork(item.fileId)} style={{ ...S.iconBtn, width:24, height:24, fontSize:11, color:'#dc2626', borderColor:'#fca5a5' }}>✕</button>
                              </div>
                            ))}
                          </div>

                          {/* Ετικέτες δικτύου */}
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'10px 14px', marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Ετικέτες</div>
                            {(currentNetwork.tags || []).length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                                {(currentNetwork.tags || []).map(t => {
                                  const c = tagColor(t);
                                  return <span key={t} style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:c.bg, color:c.text, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer' }}
                                    onClick={() => removeNetTag(t)}>#{t} <span style={{ fontSize:9, opacity:0.6 }}>✕</span></span>;
                                })}
                              </div>
                            )}
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <input type="text" placeholder="Νέα ετικέτα…" value={netTagInput} onChange={e => setNetTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && netTagInput.trim()) { addNetTag(netTagInput); setNetTagInput(''); } }}
                                style={{ flex:1, padding:'6px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize: isMobile ? 16 : 12, background:'#fafafa' }} />
                              <button onClick={() => { if (netTagInput.trim()) { addNetTag(netTagInput); setNetTagInput(''); } }}
                                style={{ background:PALETTE.mustard.deep, color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', opacity: netTagInput.trim() ? 1 : 0.4 }}>+</button>
                            </div>
                            {SUGGESTED_TAGS.filter(t => !(currentNetwork.tags || []).includes(t)).length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
                                {SUGGESTED_TAGS.filter(t => !(currentNetwork.tags || []).includes(t)).slice(0, 8).map(t => (
                                  <button key={t} onClick={() => addNetTag(t)}
                                    style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:'#f3f4f6', color:'#6b6b80', border:'1px solid #e8e8e8', cursor:'pointer' }}>+{t}</button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Πληροφορίες δικτύου */}
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'10px 14px', marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Πληροφορίες</div>
                            <textarea placeholder="Πηγή, τίτλος, συγγραφέας… (αυτόματη συγκέντρωση από τα κείμενα)" value={currentNetwork.info || ''}
                              onChange={e => updateNetInfo(e.target.value)}
                              style={{ width:'100%', padding:'8px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: isMobile ? 16 : 13, lineHeight:1.6, color:'#3d3a2e',
                                background:PALETTE.cream.bgSoft, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', minHeight:60 }} />
                          </div>

                          {/* Σχόλια δικτύου */}
                          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'10px 14px', marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Σχόλια</div>
                            <textarea placeholder="Σημειώσεις, σχόλια… (αυτόματη συγκέντρωση από τα κείμενα)" value={currentNetwork.comment || ''}
                              onChange={e => updateNetComment(e.target.value)}
                              style={{ width:'100%', padding:'8px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: isMobile ? 16 : 13, lineHeight:1.6, color:'#5c3826',
                                background:PALETTE.peach.bgSoft, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', minHeight:60 }} />
                          </div>

                          {/* Ερωτήσεις — ομαδοποίηση κατά κωδικό, με checkbox επιλογής */}
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {Q_CODES.map(code => {
                              const grouped = currentNetwork.items.flatMap(item =>
                                (item.questions || []).filter(q => q.code === code).map(q => ({ ...q, fileId: item.fileId, fileName: item.name }))
                              );
                              const selectedCount = grouped.filter(q => q.selected).length;
                              const isOpen = !!openAccordions['code_' + code];
                              return (
                                <div key={code} style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', overflow:'hidden' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', background: isOpen ? PALETTE.mustard.bgSoft : '#fafaf9' }}
                                    onClick={() => setOpenAccordions(prev => ({ ...prev, ['code_' + code]: !prev['code_' + code] }))}>
                                    <span style={{ fontSize:15, fontWeight:700, color:PALETTE.mustard.deep, minWidth:28 }}>{code}</span>
                                    <span style={{ flex:1, fontSize:12, color:'#6b6b80' }}>
                                      {grouped.length} {grouped.length === 1 ? 'ερώτηση' : 'ερωτήσεις'}
                                      {selectedCount > 0 && <span style={{ color:PALETTE.mustard.deep, fontWeight:600 }}> · {selectedCount} επιλεγμ.</span>}
                                    </span>
                                    <span style={{ fontSize:11, color:'#6b6b80' }}>{isOpen ? '▲' : '▼'}</span>
                                  </div>
                                  {isOpen && (
                                    <div style={{ padding:'10px 14px 14px', borderTop:'1px solid #f0f0f0' }}>
                                      {grouped.length === 0 && <div style={{ fontSize:12, color:'#aeaeb8', marginBottom:8 }}>Καμία ερώτηση {code}.</div>}
                                      {grouped.map(q => (
                                        <div key={q.id} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8,
                                          padding:8, borderRadius:10, border: q.selected ? '2px solid ' + PALETTE.mustard.deep : '1px solid #f0f0f0',
                                          background: q.selected ? PALETTE.mustard.bgSoft : '#fff', transition:'all 0.15s ease' }}>
                                          <input type="checkbox" checked={!!q.selected}
                                            onChange={() => toggleNetQuestionSelected(q.fileId, q.id)}
                                            style={{ width:18, height:18, marginTop:3, flexShrink:0, accentColor:PALETTE.mustard.deep, cursor:'pointer' }} />
                                          <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ fontSize:10, color:'#aeaeb8', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                              📄 {q.fileName?.length > 25 ? q.fileName.slice(0, 25) + '…' : q.fileName}
                                            </div>
                                            <textarea rows={2} placeholder={`Ερώτηση ${code}…`} value={q.text}
                                              onChange={e => updateNetQuestion(q.fileId, q.id, 'text', e.target.value)} onBlur={saveNetQuestionsNow}
                                              style={{ width:'100%', padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:isMobile ? 16 : 13, lineHeight:1.5,
                                                color:'#1a1a1a', background: q.selected ? '#fff' : PALETTE.cream.bgSoft, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
                                          </div>
                                          <button onClick={() => removeNetQuestion(q.fileId, q.id)} style={{ ...S.delBtn, width:26, height:26, marginTop:2 }}>✕</button>
                                        </div>
                                      ))}
                                      <button onClick={() => addNetQuestion(null, code)}
                                        style={{ background:'transparent', color:PALETTE.mustard.deep, border:'1px dashed ' + PALETTE.mustard.accent, padding:'5px 12px', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                                        + Ερώτηση {code}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                    }
                  </div>

                </div>
              )}
            </>
          )}

          {/* ΔΙΚΤΥΑ */}
          {activeView === 'network' && (
            <div style={{ maxWidth:640 }}>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>Τάξη</h1>
              </div>

              {/* Εκκρεμείς προσκλήσεις */}
              {networkData.received?.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#dc2626', marginBottom:10 }}>🔔 Εκκρεμείς προσκλήσεις ({networkData.received.length})</div>
                  {networkData.received.map(inv => (
                    <div key={inv.email} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', borderRadius:14, border:'1px solid #fecaca', marginBottom:8 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👤</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{inv.name||inv.email}</div>
                        <div style={{ fontSize:11, color:'#6b6b80' }}>{inv.email}</div>
                      </div>
                      <button onClick={()=>respondInvite(inv.email,'accept')} style={{ padding:'6px 14px', borderRadius:10, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>✓</button>
                      <button onClick={()=>respondInvite(inv.email,'reject')} style={{ padding:'6px 12px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fff', color:'#6b6b80', fontSize:12, cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Νέα πρόσκληση */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>Πρόσκληση συναδέλφου</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={networkInviteEmail} onChange={e=>setNetworkInviteEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendInvite();}} placeholder="email@gmail.com" type="email"
                    style={{ flex:1, padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:12, fontSize:isMobile?16:13, background:'#fff' }} />
                  <button onClick={sendInvite} disabled={networkLoading||!networkInviteEmail.trim()} style={{ ...btn('solid'), padding:'10px 18px', opacity:networkInviteEmail.trim()?1:0.4 }}>{networkLoading?'…':'Αποστολή'}</button>
                </div>
                {(networkData.sent||[]).length > 0 && <div style={{ marginTop:8, fontSize:11, color:'#aeaeb8' }}>Αναμένει: {networkData.sent.join(', ')}</div>}
              </div>

              {/* Ομάδες */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>👥 Ομάδες</div>
                  {groupMsg && <span style={{ fontSize:11, color: groupMsg.startsWith('✓')?'#15803d':groupMsg.startsWith('✗')?'#dc2626':'#8a8a9a' }}>{groupMsg}</span>}
                  <button onClick={()=>{ setShowNewGroup(v=>!v); setNewGroupName(''); setNewGroupMembers([]); }} disabled={(networkData.connections||[]).length===0}
                    style={{ marginLeft:'auto', ...btn('mini'), fontSize:12, opacity:(networkData.connections||[]).length===0?0.5:1 }}>+ Νέα ομάδα</button>
                </div>
                {showNewGroup && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid '+PALETTE.peach.accent, padding:'14px 16px', marginBottom:12 }}>
                    <input autoFocus value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Όνομα ομάδας…"
                      style={{ width:'100%', padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, background:'#fff', boxSizing:'border-box', marginBottom:10 }} />
                    <div style={{ fontSize:11, fontWeight:700, color:'#aeaeb8', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Μέλη {newGroupMembers.length>0&&`(${newGroupMembers.length})`}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                      {(networkData.connections||[]).map(c=>{ const sel=newGroupMembers.includes(c.email); const ci=contactInfo[c.email]; const nm=ci&&(ci.firstName||ci.lastName)?`${ci.firstName||''} ${ci.lastName||''}`.trim():(c.name||c.email);
                        return <button key={c.email} onClick={()=>toggleGroupMember(c.email)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', borderRadius:10, border:sel?'2px solid #16a34a':'1px solid #ebebeb', background:sel?'#f0fdf4':'#fafafa', cursor:'pointer', textAlign:'left' }}>
                          <span style={{ flex:1, fontSize:13, color:'#1a1a1a' }}>{nm}</span>{sel&&<span style={{ color:'#16a34a', fontSize:15 }}>✓</span>}</button>;
                      })}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button onClick={()=>setShowNewGroup(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer', color:'#6b6b80' }}>Ακύρωση</button>
                      <button onClick={createGroup} disabled={!newGroupName.trim()||newGroupMembers.length===0} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:(newGroupName.trim()&&newGroupMembers.length>0)?PALETTE.peach.deep:'#ccc', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Δημιουργία</button>
                    </div>
                  </div>
                )}
                {groups.length>0 && (
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
                    {groups.map(g=>(
                      <div key={g.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'14px 16px', display:'flex', flexDirection:'column', gap:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:PALETTE.peach.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>👥</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.name}</div>
                            <div style={{ fontSize:11, color:'#8a8a9a' }}>{(g.members||[]).length} μέλη</div>
                          </div>
                          <button onClick={()=>deleteGroup(g.id)} title="Διαγραφή" style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:14, padding:'2px 6px' }}>✕</button>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {(g.members||[]).map(m=>{ const tc=tagColor(m); const c=(networkData.connections||[]).find(x=>x.email===m); const nm=(c?.name||m).split('@')[0]; return <span key={m} style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:tc.bg, color:tc.text }}>{nm}</span>; })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>Συνδέσεις {(networkData.connections||[]).length > 0 && `(${networkData.connections.length})`}</div>
                {networkLoading && <div style={{ color:'#aeaeb8', fontSize:13 }}>Φόρτωση…</div>}
                {!networkLoading && (networkData.connections||[]).length === 0 && <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic' }}>Καμία σύνδεση ακόμα.</div>}
                {(networkData.connections||[]).map(conn => {
                  const cInfo = contactInfo[conn.email];
                  const displayName = cInfo && (cInfo.firstName || cInfo.lastName)
                    ? `${cInfo.firstName||''} ${cInfo.lastName||''}`.trim()
                    : (conn.name||conn.email);
                  return (
                  <div key={conn.email} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', borderRadius:14, border:'1px solid #ebebeb', marginBottom:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{displayName}</div>
                      <div style={{ fontSize:11, color:'#6b6b80' }}>{cInfo?.school ? cInfo.school : conn.email}</div>
                    </div>
                    <button onClick={()=>openContactPicker(conn.email)} title="Στοιχεία επικοινωνίας" style={{ padding:'6px 14px', borderRadius:10, border: cInfo && (cInfo.firstName||cInfo.lastName||cInfo.school) ? '1.5px solid #8a7d4a' : '1px solid #e0e0e0', background: cInfo && (cInfo.firstName||cInfo.lastName||cInfo.school) ? PALETTE.cream.bgSoft : '#fff', color:'#5c4a1e', fontSize:12, fontWeight:600, cursor:'pointer' }}>ℹ️ Πληροφορίες</button>
                    <button onClick={()=>disconnect(conn.email)} style={{ background:'none', border:'none', color:'#aeaeb8', cursor:'pointer', fontSize:12, padding:'4px' }}>✕</button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ΕΙΣΕΡΧ./ΑΠΕΣΤ. — πίνακας με κάρτες-φακέλους (όπως ο μαθητής) */}
          {activeView === 'messages' && (() => {
            const conns = networkData.connections || [];
            const inboxAll = networkData.inbox || [];
            const sentAll = allSentFiles();
            const cName = (c) => { const ci = contactInfo[c.email]; return ci && (ci.firstName || ci.lastName) ? `${ci.firstName||''} ${ci.lastName||''}`.trim() : (c.name || c.email.split('@')[0]); };
            const nameOfEmail = (email) => { const ci = contactInfo[email]; if (ci && (ci.firstName || ci.lastName)) return `${ci.firstName||''} ${ci.lastName||''}`.trim(); const c = (networkData.connections||[]).find(x=>x.email===email); return (c?.name && !c.name.includes('@')) ? c.name : email.split('@')[0]; };
            // Ετικέτα παραλήπτη/ων για κάρτα απεσταλμένου — δείχνει σε ποιον/ποια ομάδα στάλθηκε
            const sentLabel = (f) => {
              const v = f.visibility;
              if (v === 'public') return '🌍 Δημόσιο';
              if (v === 'connections') return '👥 Όλες οι συνδέσεις';
              if (v && v.startsWith('user:')) return '👤 ' + nameOfEmail(v.slice(5));
              if (v && v.startsWith('users:')) { try { const arr = JSON.parse(v.slice(6)); const names = arr.map(nameOfEmail);
                // αν ταιριάζει ακριβώς με κάποια ομάδα, δείξε το όνομα της ομάδας
                const grp = groups.find(g => (g.members||[]).length===arr.length && arr.every(e=>g.members.includes(e)));
                return '👥 ' + (grp ? grp.name : names.join(', '));
              } catch { return '👥 Πολλοί'; } }
              return '';
            };

            const renderInbox = (item, key) => {
              const isExp = expandedInbox === key;
              return (
                <div key={key} style={{ background: !item.seen ? '#fff9ed' : '#fff', border:`1px solid ${!item.seen?'#fecaca':'#ebebeb'}`, borderRadius:14, marginBottom:8, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer' }} onClick={()=>setExpandedInbox(isExp?null:key)}>
                    <div style={{ fontSize:18, flexShrink:0 }}>📄</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(item.fileName||'',22)}</div>
                      <div style={{ fontSize:10, color:'#aeaeb8', marginTop:2 }}>{(()=>{const tc=tagColor(item.fromEmail||''); const raw=(item.fromName||item.fromEmail||'').split('@')[0]; return <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:999, background:tc.bg, color:tc.text }}>{trunc(raw,18)}</span>;})()} <span style={{ marginLeft:4 }}>{new Date(item.sentAt).toLocaleDateString('el-GR')}</span></div>
                    </div>
                    {!item.seen && <span style={{ width:8, height:8, borderRadius:'50%', background:'#dc2626', flexShrink:0 }} />}
                    <span style={{ fontSize:11, color:'#aeaeb8', transition:'transform 0.15s', transform:isExp?'rotate(180deg)':'none' }}>▼</span>
                  </div>
                  {isExp && (
                    <div style={{ padding:'0 14px 12px', borderTop:'1px solid rgba(0,0,0,0.04)' }}>
                      {item.message && <div style={{ fontSize:12, color:'#1a7f37', background:'#f0fdf4', padding:'8px 10px', borderRadius:8, marginTop:8, lineHeight:1.5 }}>💬 {item.message}</div>}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                        <button onClick={()=>{ markInboxSeen(item.fileId); const isHtml=/\.html?$/i.test(item.fileName||''); const isBin=/\.(pdf|jpe?g|png|gif|webp|svg|mp4|mp3|zip)$/i.test(item.fileName||''); const pUrl=isHtml?`/api/student-file?id=${item.fileId}`:!isBin?`/api/inbox-pdf?id=${item.fileId}&name=${encodeURIComponent(item.fileName||'')}`:`https://drive.google.com/file/d/${item.fileId}/preview`; if(isMobile){openExternal(pUrl);return;} setViewing({ id:item.fileId, name:item.fileName||'Αρχείο', previewUrl:pUrl, isInbox:true }); setShowMetaPanel(false); }}
                          style={{ ...btn('mini'), fontSize:12 }}>Άνοιγμα →</button>
                        <button onClick={()=>{ markInboxSeen(item.fileId); window.open(`https://drive.google.com/uc?id=${item.fileId}&export=download`,'_blank'); }} style={{ ...btn('mini'), fontSize:12 }}>⬇ Λήψη</button>
                        <button onClick={()=> setInboxSaveTarget(inboxSaveTarget===key?null:key)} disabled={busy==='inbox-save'} style={{ ...btn('mini'), fontSize:12, color:'#15803d' }}>{busy==='inbox-save'?'…':'📁 Αποθήκευση'}</button>
                      </div>
                      {inboxSaveTarget===key && (
                        <div style={{ marginTop:10, padding:10, background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Επιλογή φακέλου</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {(folders||[]).map(fld => (
                              <button key={fld.id} onClick={()=>saveInboxToDrive(item.fileId, item.fileName, fld.id)} disabled={busy==='inbox-save'}
                                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, cursor:'pointer', background:'#fff', border:'1px solid #e0e0e0', textAlign:'left', fontSize:12, fontWeight:500, color:'#1a1a1a' }}>
                                <span>📁</span><span style={{ flex:1 }}>{fld.name}</span><span style={{ fontSize:11, color:'#16a34a' }}>→</span></button>
                            ))}
                            {(!folders||!folders.length) && <div style={{ fontSize:12, color:'#aeaeb8' }}>Δεν υπάρχουν φάκελοι.</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };
            const renderSent = (f, key) => (
              <div key={key} className="ch" onClick={()=>openViewer(f)} style={{ background:'#fff', border:'1px solid #ebebeb', borderRadius:14, marginBottom:8, padding:'11px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <div style={{ fontSize:18, flexShrink:0 }}>📄</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name,22)}</div>
                  <div style={{ fontSize:10, color:'#8a7d4a', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>→ {sentLabel(f)}</div>
                </div>
                <button onClick={(e)=>{e.stopPropagation();setQrFile(f);}} style={{ ...btn('mini'), padding:'3px 5px', flexShrink:0 }} title="QR">{QrIcon}</button>
              </div>
            );

            // ── Λεπτομέρεια φακέλου (διπλή στήλη) ──
            if (msgFolder) {
              const f = msgFolder;
              const isUG = f.type==='user'||f.type==='group';
              let leftList=[], rightList=[];
              if (f.type==='inbox') leftList=inboxAll;
              else if (f.type==='sent') rightList=sentAll;
              else if (f.type==='user'){ leftList=inboxFromUser(f.email); rightList=sentToUser(f.email); }
              else if (f.type==='group'){ leftList=inboxFromGroup(f.group); rightList=sentToGroup(f.group); }
              else if (f.type==='search'){ const q=msgSearch.trim().toLowerCase(); leftList=q?inboxAll.filter(i=>(i.fileName||'').toLowerCase().includes(q)):[]; rightList=q?sentAll.filter(x=>(x.name||'').toLowerCase().includes(q)):[]; }
              const showLeft=f.type==='inbox'||f.type==='search'||isUG;
              const showRight=f.type==='sent'||f.type==='search'||isUG;
              return (
                <>
                  <div style={S.pageHeader}>
                    <button onClick={()=>{setMsgFolder(null);setMsgSearch('');setExpandedInbox(null);}} style={S.backBtn}>← Πίσω</button>
                    <h1 style={{ ...S.pageTitle, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.type==='group'?'👥 ':f.type==='user'?'👤 ':f.type==='sent'?'📤 ':f.type==='search'?'🔍 ':'📥 '}{trunc(f.name, isMobile?16:40)}</h1>
                  </div>
                  {f.type==='search' && (
                    <input autoFocus type="search" placeholder="Αναζήτηση σε εισερχόμενα & απεσταλμένα…" value={msgSearch} onChange={e=>setMsgSearch(e.target.value)}
                      style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize:isMobile?16:14, background:'#fff', marginBottom:16, boxSizing:'border-box' }} />
                  )}

                  {/* Πλαίσιο αποστολής: αρχείο ή Φωτογραφίες → PDF */}
                  {isUG && (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid '+PALETTE.peach.accent, padding:'14px 16px', marginBottom:18, textAlign:'center' }}>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#1a1a1a' }}>📤 Αποστολή σε «{f.name}»</div>
                      <div style={{ fontSize:11, color:'#aeaeb8', marginBottom:10 }}>
                        {f.type==='group' ? `Στέλνεται αυτόματα σε ${(f.group?.members||[]).length} μέλη` : 'Στέλνεται αυτόματα στον χρήστη του φακέλου'}
                      </div>
                      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:12, background:PALETTE.peach.bg, color:PALETTE.peach.deep, fontSize:13, fontWeight:600, cursor:msgSending?'wait':'pointer', opacity:msgSending?0.5:1, border:'1.5px solid '+PALETTE.peach.accent }}>
                          {msgSending ? 'Αποστολή…' : 'Επιλογή αρχείου'}
                          <input type="file" multiple style={{ display:'none' }} onChange={handleMsgFileSelect} disabled={msgSending} />
                        </label>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:12, background:PALETTE.cream.bgSoft, color:PALETTE.cream.deep, fontSize:13, fontWeight:600, cursor:msgSending?'wait':'pointer', opacity:msgSending?0.5:1, border:'1.5px solid '+PALETTE.cream.accent }}>
                          📷 Φωτογραφία → PDF
                          <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e=>{ setMsgPhotoMode(true); addMsgPhoto(e); }} disabled={msgSending} />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Φωτογραφίες → PDF modal */}
                  {msgPhotoMode && (
                    <div onClick={msgPhotoBusy?undefined:closeMsgPhotos} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
                      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'24px 20px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'85vh', overflowY:'auto' }}>
                        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>📷 Φωτογραφίες → PDF</div>
                        <div style={{ fontSize:12, color:'#6b6b80', marginBottom:14 }}>Τράβηξε όσες φωτογραφίες θέλεις — ενώνονται σε ένα PDF (μία σελίδα η καθεμία) και στέλνονται σε «{f.name}».</div>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14, justifyContent:'center' }}>
                          {msgPhotos.map((p,i)=>(
                            <div key={p.url} style={{ position:'relative', width:110, height:140, borderRadius:12, overflow:'hidden', border:'1px solid #ebebeb' }}>
                              <img src={p.url} alt={'Φωτογραφία '+(i+1)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              <button onClick={()=>removeMsgPhoto(i)} disabled={msgPhotoBusy} style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:12, cursor:'pointer', lineHeight:'22px', padding:0 }}>✕</button>
                              <span style={{ position:'absolute', bottom:4, left:4, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, padding:'1px 7px', borderRadius:999 }}>Σελίδα {i+1}</span>
                            </div>
                          ))}
                          {!msgPhotoBusy && (
                            <label style={{ width:110, height:140, borderRadius:12, border:'2px dashed '+PALETTE.peach.accent, background:PALETTE.peach.bgSoft, color:PALETTE.peach.deep, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', fontSize:12, fontWeight:600, boxSizing:'border-box', textAlign:'center' }}>
                              <span style={{ fontSize:22 }}>📷</span>{msgPhotos.length===0?'Λήψη φωτογραφίας':'+ φωτογραφία'}
                              <input type="file" accept="image/*" capture="environment" multiple style={{ display:'none' }} onChange={addMsgPhoto} />
                            </label>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={closeMsgPhotos} disabled={msgPhotoBusy} style={{ flex:1, padding:'10px', borderRadius:12, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer', color:'#6b6b80', opacity:msgPhotoBusy?0.5:1 }}>Ακύρωση</button>
                          <button onClick={sendMsgPhotosPdf} disabled={msgPhotos.length===0||msgPhotoBusy}
                            style={{ flex:1, padding:'10px', borderRadius:12, border:'none', background:msgPhotos.length>0?PALETTE.peach.deep:'#ccc', color:'#fff', fontSize:13, fontWeight:600, cursor:msgPhotos.length>0&&!msgPhotoBusy?'pointer':'not-allowed', opacity:msgPhotoBusy?0.6:1 }}>
                            {msgPhotoBusy?'Δημιουργία PDF…':`Αποστολή ως PDF${msgPhotos.length>0?` (${msgPhotos.length} σελ.)`:''}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start' }}>
                    {showLeft && (
                      <div style={{ flex:'1 1 320px', minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>📥 Εισερχόμενα {unseenInbox(leftList)>0 && <span style={{ background:'#dc2626', color:'#fff', borderRadius:999, padding:'1px 8px', fontSize:11 }}>{unseenInbox(leftList)}</span>}</div>
                        {leftList.length===0 ? <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic', padding:16 }}>{f.type==='search'?'Πληκτρολόγησε για αναζήτηση.':'Κανένα εισερχόμενο.'}</div>
                          : leftList.map((x,i)=>renderInbox(x,'min_'+(x.fileId||'')+'_'+(x.fromEmail||'')+'_'+i))}
                      </div>
                    )}
                    {showRight && (
                      <div style={{ flex:'1 1 320px', minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>📤 Απεσταλμένα</div>
                        {rightList.length===0 ? <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic', padding:16 }}>{f.type==='search'?'Πληκτρολόγησε για αναζήτηση.':'Κανένα απεσταλμένο.'}</div>
                          : rightList.map((x,i)=>renderSent(x,'mout_'+x.id+'_'+i))}
                      </div>
                    )}
                  </div>
                </>
              );
            }

            // ── Κάρτες ──
            const fixed=[
              {key:'inbox', type:'inbox', name:'Εισερχόμενα', icon:'📥', tone:'cream', sub:`${inboxAll.length} αρχεία`, badge:unseenTotal},
              {key:'sent', type:'sent', name:'Απεσταλμένα', icon:'📤', tone:'peach', sub:`${sentAll.length} αρχεία`, badge:0},
              {key:'search', type:'search', name:'Αναζήτηση', icon:'🔍', tone:'mustard', sub:'εισερχόμενα & απεσταλμένα', badge:0},
            ];
            const openFixed=(o)=>{ setMsgSearch(''); setExpandedInbox(null); setMsgFolder({type:o.type,name:o.name}); };
            const folderItems=[
              ...groups.map(g=>{ const ic=inboxFromGroup(g), st=sentToGroup(g); return { type:'folder', view:'g_'+g.id, name:g.name, icon:'👥', tone:'peach', desc:`📥 ${ic.length} · 📤 ${st.length}`, badge:unseenInbox(ic), open:()=>{setExpandedInbox(null);setMsgFolder({type:'group',group:g,name:g.name});} }; }),
              ...conns.map(c=>{ const nm=cName(c); const ic=inboxFromUser(c.email), st=sentToUser(c.email); return { type:'folder', view:'u_'+c.email, name:nm, icon:(nm.charAt(0)||'?').toUpperCase(), tone:'cream', desc:`📥 ${ic.length} · 📤 ${st.length}`, badge:unseenInbox(ic), open:()=>{setExpandedInbox(null);setMsgFolder({type:'user',email:c.email,name:nm});} }; }),
            ];

            return (
              <>
                <div style={S.pageHeader}><h1 style={S.pageTitle}>Εισερχ./Απεστ.</h1></div>
                {isMobile ? (
                  <>
                    <div style={{ position:'relative', marginBottom:24, paddingBottom:8 }}>
                      {renderWallet(fixed.map(o=>({type:'folder',view:o.key,name:o.name,icon:o.icon,tone:o.tone,desc:o.sub,fw:500,badge:o.badge,open:()=>openFixed(o)})), msgStatActive, (item,isExp)=>{ if(isExp){setMsgStatActive(null);item.open();} else setMsgStatActive(item.view); })}
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>Χρήστες & ομάδες</div>
                    {folderItems.length===0 ? <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic' }}>Καμία σύνδεση/ομάδα. Πρόσθεσε από το «Δίκτυο».</div>
                      : <div style={{ position:'relative', paddingBottom:8 }}>{renderWallet(folderItems.map(it=>({ ...it, name:trunc(it.name,18), fw:500 })), msgWalletActive, (item,isExp)=>{ if(isExp){setMsgWalletActive(null);item.open();} else setMsgWalletActive(item.view); })}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ ...S.statsGrid, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14, marginBottom:32 }}>
                      {fixed.map(o=>{ const p=PALETTE[o.tone]; return (
                        <div key={o.key} className="ch" onClick={()=>openFixed(o)} style={{ ...S.statCard, minHeight:120, cursor:'pointer', background:`linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 45%, transparent 65%), ${p.bg}` }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div style={{ fontSize:30, marginBottom:8 }}>{o.icon}</div>
                            {o.badge>0 && <span style={{ background:'#dc2626', color:'#fff', borderRadius:999, padding:'2px 9px', fontSize:12, fontWeight:700 }}>{o.badge}</span>}
                          </div>
                          <div style={{ fontSize:18, fontWeight:500, color:p.text, marginBottom:4 }}>{o.name}</div>
                          <div style={{ fontSize:13, color:p.text, opacity:0.65 }}>{o.sub}</div>
                        </div>
                      ); })}
                    </div>
                    <div style={{ fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:18 }}>Χρήστες & ομάδες</div>
                    {folderItems.length===0 ? <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic' }}>Καμία σύνδεση/ομάδα. Πρόσθεσε από το «Δίκτυο».</div>
                      : <div style={S.cardsGrid}>
                          {folderItems.map((it,i)=>{ const p=PALETTE[TONES[i%TONES.length]]; return (
                            <div key={it.view} className="ch" onClick={it.open} style={{ ...S.folderCard, background:`linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 45%, transparent 65%), ${p.bg}` }}>
                              <div style={S.folderTop}>
                                <div style={{ ...S.folderIcon, background:p.accent, color:p.deep, fontSize:20 }}>{it.icon}</div>
                                {it.badge>0 && <span style={{ background:'#dc2626', color:'#fff', borderRadius:999, padding:'2px 9px', fontSize:12, fontWeight:700 }}>{it.badge}</span>}
                              </div>
                              <h3 style={{ ...S.folderTitle, color:p.text }}>{trunc(it.name,24)}</h3>
                              <p style={{ ...S.folderDesc, color:p.text, opacity:0.65 }}>{it.desc}</p>
                              <div style={{ ...S.folderFoot, borderTopColor:p.accent }}>
                                <button style={{ ...S.linkBtn, color:p.deep }}>Άνοιγμα →</button>
                              </div>
                            </div>
                          ); })}
                        </div>}
                  </>
                )}
              </>
            );
          })()}

          {/* FAVORITES / NEW */}
          {(activeView === 'favorites' || activeView === 'newFiles') && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>{activeView==='favorites'?'Αγαπημένα':'Νέα'}</h1>
              </div>
              <FileList files={viewFiles} loading={loading}
                empty={activeView==='favorites'?'Δεν έχεις αγαπημένα ακόμη. Πάτησε το ☆ σε ένα αρχείο.':'Δεν υπάρχουν αρχεία ακόμη.'}
                onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onInfo={updateInfo} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} appFiles={ghAppFiles} showFolder folders={folders} compact={isMobile} userRole={userRole} onQr={setQrFile} suggestedUrls={allSuggestedUrls} onPrint={printWithQuestions} networkFileIds={networkFileIds} onNetRefresh={netRefreshByFile} />
            </>
          )}

          {/* TAG SEARCH */}
          {activeView === 'tagSearch' && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>Αναζήτηση με ετικέτες</h1>
              </div>
              {/* Κατηγορία: Κείμενα / Δίκτυα / Εφαρμογές */}
              <div style={{ display:'flex', gap:0, marginBottom:14, borderRadius:12, overflow:'hidden', border:'1.5px solid #e0dcc8' }}>
                {[
                  { key:'texts',    label:'📄 Κείμενα',   count:textOnlyFiles.length },
                  { key:'networks', label:'🔗 Δίκτυα',    count:networkOnlyFiles.length },
                  { key:'apps',     label:'⚡ Εφαρμογές', count:appFiles.length },
                ].map((cat, ci) => {
                  const on = searchCategory === cat.key;
                  return (
                    <button key={cat.key}
                      onClick={() => { setSearchCategory(cat.key); setSearchTags([]); setSearchText(''); }}
                      style={{
                        flex:1, padding:'9px 6px', border:'none', cursor:'pointer',
                        fontSize:12, fontWeight: on ? 700 : 500,
                        background: on ? PALETTE.cream.deep : 'transparent',
                        color: on ? '#fff' : PALETTE.cream.text,
                        borderRight: ci < 2 ? '1.5px solid #e0dcc8' : 'none',
                      }}>
                      {cat.label} <span style={{ opacity:0.6, fontSize:11 }}>({cat.count})</span>
                    </button>
                  );
                })}
              </div>
              <input type="search" placeholder="Αναζήτηση σε τίτλο ή ετικέτα…" value={searchText} onChange={(e)=>setSearchText(e.target.value)}
                style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize: isMobile ? 16 : 14, background:'#fff', marginBottom:14 }} />
              {searchPoolTags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18 }}>
                  {searchPoolTags.map((t) => { const c=tagColor(t); const on=searchTags.includes(t);
                    return <button key={t} onClick={()=>setSearchTags((p)=>p.includes(t)?p.filter(x=>x!==t):[...p,t])}
                      style={{ border:'none', cursor:'pointer', borderRadius:999, padding:'4px 12px', fontSize:12, fontWeight:on?700:500, background:on?c.text:c.bg, color:on?'#fff':c.text }}>#{t}</button>;
                  })}
                </div>
              )}
              {(searchTags.length===0 && !searchText)
                ? <div style={S.empty}>Διάλεξε ετικέτες ή πληκτρολόγησε για αναζήτηση.</div>
                : <FileList files={searchResults} loading={false} empty="Κανένα αρχείο δεν ταιριάζει." onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onInfo={updateInfo} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} appFiles={ghAppFiles} showFolder folders={folders} compact={isMobile} userRole={userRole} onQr={setQrFile} suggestedUrls={allSuggestedUrls} onPrint={printWithQuestions} networkFileIds={networkFileIds} onNetRefresh={netRefreshByFile} />}
            </>
          )}

          {activeView === 'liveCenter' && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: isMobile?20:24, fontWeight:600, color:'#1a1a1a', margin:'0 0 6px' }}>📡 Δημιουργία Live</h1>
                <p style={{ fontSize:13, color:'#6b6b80', margin:0 }}>Διάλεξε ένα ή περισσότερα στοιχεία (αρχεία, εφαρμογές, συνδέσμους) — θα παρουσιαστούν μαζί με έναν κωδικό PIN.</p>
              </div>

              {/* Επιλεγμένα στοιχεία */}
              {liveItems.length > 0 && (
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Στην παρουσίαση ({liveItems.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {liveItems.map((it, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#fff', border:'1px solid #ebebeb', borderRadius:12, minWidth:0, maxWidth:'100%' }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>{it.kind==='url'?'🌐':it.kind==='app'?'🧩':'📄'}</span>
                        <span style={{ flex:1, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{it.name}</span>
                        {i===0 && <span style={{ fontSize:10, color:PALETTE.cream.deep, fontWeight:700, flexShrink:0 }}>ΚΥΡΙΟ</span>}
                        {liveCenterCode && (isInLive(it)
                          ? <span style={{ fontSize:10, color:'#15803d', background:'#dcfce7', fontWeight:700, flexShrink:0, padding:'2px 8px', borderRadius:999 }}>● ΣΕ LIVE</span>
                          : <span style={{ fontSize:10, color:'#b45309', background:'#fef3c7', fontWeight:700, flexShrink:0, padding:'2px 8px', borderRadius:999 }}>ΝΕΟ</span>)}
                        <button onClick={()=>removeLiveItem(i)} style={{ background:'none', border:'none', color:'#aeaeb8', cursor:'pointer', fontSize:13, flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Προτεινόμενοι ιστότοποι (chips) */}
              <div style={{ marginBottom:16, padding:'14px 16px', background:'#fff', border:'1px solid #ebebeb', borderRadius:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>🌐 Ιστότοποι</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                  {allSuggestedUrls.filter(s => !liveItems.some(it=>it.url===s.url)).map((s) => (
                    <button key={s.url} onClick={() => addLiveItem({ kind:'url', url:s.url, name:s.name })}
                      style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fafafa', cursor:'pointer', fontSize:11, fontWeight:500, color:'#333' }}>
                      + {s.name}
                    </button>
                  ))}
                </div>
                {/* Χειροκίνητο URL */}
                <input value={liveUrlInput} onChange={e=>setLiveUrlInput(e.target.value)} placeholder="…ή επικόλλησε διεύθυνση (YouTube, σετ εφαρμογής, ιστοσελίδα)"
                  style={{ width:'100%', padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, marginBottom:8, boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <input value={liveUrlName} onChange={e=>setLiveUrlName(e.target.value)} placeholder="Όνομα (προαιρετικό)"
                    style={{ flex:1, padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, boxSizing:'border-box' }} />
                  <button onClick={addLiveUrl} disabled={!liveUrlInput.trim()} style={{ padding:'10px 18px', borderRadius:10, border:'none', background: liveUrlInput.trim()?PALETTE.cream.deep:'#e0e0e0', color:'#fff', fontSize:13, fontWeight:600, cursor: liveUrlInput.trim()?'pointer':'default' }}>+ Προσθήκη</button>
                </div>
              </div>

              {/* Αρχεία & Εφαρμογές — φάκελοι (όπως στο picker της κάρτας) */}
              <div style={{ marginBottom:16, padding:'14px 16px', background:'#fff', border:'1px solid #ebebeb', borderRadius:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>📁 Αρχεία & Εφαρμογές</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {folders.map((fld) => {
                    const cnt = normalFiles.filter(x => x.folderId===fld.id && !liveItems.some(it=>it.id===x.id)).length;
                    if (!cnt) return null;
                    const isOpen = liveCenterSection === fld.id;
                    return (
                      <button key={fld.id} onClick={() => setLiveCenterSection(isOpen ? null : fld.id)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                          border:'2px solid '+(isOpen ? PALETTE.cream.deep : '#e0e0e0'),
                          background: isOpen ? PALETTE.cream.bgSoft : '#fafafa',
                          cursor:'pointer', fontSize:13, fontWeight:600,
                          color: isOpen ? PALETTE.cream.deep : '#555' }}>
                        📁 {fld.name} <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                      </button>
                    );
                  })}
                  {ghAppList.length > 0 && (() => {
                    const af = ghAppList.filter(x => !liveItems.some(it => it.url === ghUrl(x)));
                    if (!af.length) return null;
                    const isOpen = liveCenterSection === 'apps';
                    return (
                      <button key="apps" onClick={() => setLiveCenterSection(isOpen ? null : 'apps')}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                          border:'2px solid '+(isOpen ? '#5c7a3a' : '#e0e0e0'),
                          background: isOpen ? '#f0f5eb' : '#fafafa',
                          cursor:'pointer', fontSize:13, fontWeight:600,
                          color: isOpen ? '#5c7a3a' : '#555' }}>
                        ⚡ Εφαρμογές <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                      </button>
                    );
                  })()}
                </div>
                {liveCenterSection && (()=> {
                  const list = liveCenterSection === 'apps'
                    ? ghAppList.filter(x => !liveItems.some(it => it.url === ghUrl(x)))
                    : normalFiles.filter(x => x.folderId===liveCenterSection && !liveItems.some(it=>it.id===x.id));
                  if (!list.length) return <div style={{ padding:10, color:'#aeaeb8', fontSize:12, textAlign:'center' }}>Κανένα αρχείο</div>;
                  const kind = liveCenterSection === 'apps' ? 'app' : 'file';
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {list.map((af) => (
                        <div key={af.id || af.path} onClick={() => addLiveItem(kind === 'app' ? { kind:'url', url:ghUrl(af), name:af.name } : { kind, id:af.id, name:af.name })}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', background:'#fff', border:'1px solid #e8e0c8' }}>
                          <span style={{ fontSize:14 }}>{kind==='app'?'⚡':'📄'}</span>
                          <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{af.name}</span>
                          <span style={{ fontSize:11, color:PALETTE.cream.deep, flexShrink:0 }}>+ Προσθήκη</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* 📷 Φωτογραφίες → ενιαίο PDF για την παρουσίαση */}
              <div style={{ marginBottom:16, padding:'14px 16px', background:'#fff', border:'1px solid #ebebeb', borderRadius:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>📷 Φωτογραφίες</div>
                <div style={{ fontSize:12, color:'#6b6b80', marginBottom:10 }}>Τράβηξε ή διάλεξε φωτογραφίες (π.χ. σελίδες βιβλίου, πίνακας) — συγχωνεύονται σε ένα PDF και μπαίνουν στην παρουσίαση.</div>
                {livePhotos.length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))', gap:8, marginBottom:10 }}>
                    {livePhotos.map((p, i) => (
                      <div key={p.url} style={{ position:'relative', border:'1px solid #e8e0c8', borderRadius:10, overflow:'hidden', background:'#fff' }}>
                        <img src={p.url} alt={'Σελίδα ' + (i + 1)} style={{ width:'100%', height:90, objectFit:'cover', display:'block' }} />
                        <span style={{ position:'absolute', top:4, left:4, background:'rgba(26,26,26,0.75)', color:'#fff', fontSize:10, fontWeight:700, borderRadius:6, padding:'1px 5px' }}>{i + 1}</span>
                        <button onClick={() => removeLivePhoto(i)} title="Αφαίρεση"
                          style={{ position:'absolute', top:4, right:4, background:'rgba(26,26,26,0.75)', color:'#fff', border:'none', borderRadius:6, width:18, height:18, fontSize:10, cursor:'pointer', lineHeight:'18px', padding:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:10, border:'2px dashed #e8e0c8', background:PALETTE.cream.bgSoft, color:PALETTE.cream.deep, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    📷 {livePhotos.length ? '+ φωτογραφία' : 'Λήψη / επιλογή φωτογραφιών'}
                    <input type="file" accept="image/*" multiple onChange={addLivePhoto} style={{ display:'none' }} />
                  </label>
                  {livePhotos.length > 0 && (
                    <button onClick={finishLivePhotos} disabled={livePhotoBusy}
                      style={{ padding:'10px 16px', borderRadius:10, border:'none', background: livePhotoBusy ? '#e0e0e0' : '#1a1a1a', color:'#fff', fontSize:13, fontWeight:600, cursor: livePhotoBusy ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                      {livePhotoBusy ? '⏳ PDF…' : `Συγχώνευση → PDF (${livePhotos.length} σελ.)`}
                    </button>
                  )}
                </div>
                {livePhotos.length > 0 && (
                  <button onClick={clearLivePhotos} style={{ background:'none', border:'none', color:'#aeaeb8', fontSize:12, cursor:'pointer', marginTop:8, padding:0 }}>Καθαρισμός όλων</button>
                )}
              </div>

              {/* Προσθήκη ΝΕΩΝ στοιχείων στο ενεργό Live */}
              {liveCenterCode && (() => {
                const fresh = liveItems.filter(it => !isInLive(it));
                if (!fresh.length) return null;
                return (
                  <button onClick={addNewItemsToLive} disabled={liveAddBusy}
                    style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background: liveAddBusy?'#e0e0e0':'#15803d', color:'#fff', fontSize:15, fontWeight:600, cursor: liveAddBusy?'default':'pointer', marginBottom:10 }}>
                    {liveAddBusy ? '⏳ Προσθήκη…' : `➕ Προσθήκη ${fresh.length} ${fresh.length===1?'στοιχείου':'στοιχείων'} στο ενεργό Live ${liveCenterCode}`}
                  </button>
                );
              })()}

              {/* Δημιουργία */}
              <button onClick={createLiveFromItems} disabled={!liveItems.length || liveCenterBusy}
                style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background: liveItems.length&&!liveCenterBusy?'#1a1a1a':'#e0e0e0', color:'#fff', fontSize:15, fontWeight:600, cursor: liveItems.length&&!liveCenterBusy?'pointer':'default', marginBottom:16 }}>
                {liveCenterBusy ? '⏳ Δημιουργία…' : (liveCenterCode ? '📡 Νέο Live (νέος κωδικός)' : '📡 Έναρξη Live')}
              </button>

              {/* Αποτέλεσμα: PIN — πίνακας ελέγχου ενεργού Live */}
              {liveCenterCode && (
                <div style={{ padding:'24px', background:'linear-gradient(135deg,#1a1a1a,#2d2a1e)', borderRadius:18, textAlign:'center' }}>
                  <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2, color:'#e8c96a', marginBottom:10 }}>
                    <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#4ade80', marginRight:6, verticalAlign:'middle' }} />Ενεργό Live
                  </div>
                  <div style={{ fontSize:52, fontWeight:700, color:'#fff', letterSpacing:'0.15em', fontFamily:'monospace', marginBottom:10 }}>{liveCenterCode}</div>
                  <div style={{ fontSize:12, color:'#8e8ea0', marginBottom:16 }}>
                    {liveSentItems.length} {liveSentItems.length===1?'στοιχείο':'στοιχεία'} στην παρουσίαση · οι θεατές βλέπουν κάθε προσθήκη αυτόματα (~5″)
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                    <button onClick={()=>{ navigator.clipboard?.writeText(`${window.location.origin}/live?code=${liveCenterCode}`).catch(()=>{}); }}
                      style={{ padding:'10px 18px', borderRadius:10, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'#e8c96a', fontSize:13, cursor:'pointer' }}>📋 Αντιγραφή συνδέσμου</button>
                    <button onClick={()=>window.open(`/live?code=${liveCenterCode}`,'_blank')}
                      style={{ padding:'10px 18px', borderRadius:10, border:'none', background:'#e8c96a', color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer' }}>Άνοιγμα →</button>
                    <button onClick={stopLive}
                      style={{ padding:'10px 18px', borderRadius:10, border:'1px solid rgba(239,68,68,0.5)', background:'transparent', color:'#f87171', fontSize:13, cursor:'pointer' }}>⏹ Τερματισμός</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
      {/* Μενού Δημιουργίας: Νέο / Συγχώνευση */}
      {createMenu && (
        <div onClick={()=>setCreateMenu(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:'24px 22px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize:18, fontWeight:600, margin:'0 0 4px', color:'#1a1a1a' }}>Δημιουργία αρχείου</h2>
            <p style={{ fontSize:13, color:'#6b6b80', margin:'0 0 20px' }}>Διάλεξε τι θέλεις να δημιουργήσεις.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={()=>{ setCreateMenu(false); setNewDocFolder(createMenuFolder || folders[0]?.id||''); setNewDocTemplate(''); setNewDocForm(true); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', borderRadius:14, border:'2px solid #e0e0e0', background:'#fafafa', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:24 }}>📝</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block', fontSize:15, fontWeight:600, color:'#1a1a1a' }}>Νέο έγγραφο</span>
                  <span style={{ display:'block', fontSize:12, color:'#6b6b80', marginTop:2 }}>Γράψε ένα νέο κείμενο στο Google Docs</span>
                </span>
              </button>
              <button onClick={()=>{ const fid=createMenuFolder; setCreateMenu(false); if(fid){ const fl=folders.find(f=>f.id===fid); setNewNetFolder(fid); setNewNetName((fl?.name||'')+' — συγχώνευση'); setShowNewNetForm(true); } else { setCurrentNetwork(null); } setActiveView('netBuilder'); setOpenFolder(null); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', borderRadius:14, border:'2px solid #e0e0e0', background:'#fafafa', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:24 }}>🔗</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block', fontSize:15, fontWeight:600, color:'#1a1a1a' }}>Συγχώνευση</span>
                  <span style={{ display:'block', fontSize:12, color:'#6b6b80', marginTop:2 }}>Ένωσε αρχεία/κείμενα σε ένα PDF, με ερωτήσεις</span>
                </span>
              </button>
            </div>
            <button onClick={()=>setCreateMenu(false)} style={{ marginTop:16, width:'100%', padding:'10px', borderRadius:10, border:'1px solid #ebebeb', background:'#fff', color:'#6b6b80', fontSize:13, cursor:'pointer' }}>Άκυρο</button>
          </div>
        </div>
      )}

      {/* Φόρμα Νέου εγγράφου */}
      {newDocForm && (
        <div onClick={()=>setNewDocForm(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:'24px 22px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontSize:18, fontWeight:600, margin:'0 0 16px', color:'#1a1a1a' }}>📝 Νέο έγγραφο</h2>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b6b80', marginBottom:6 }}>Τίτλος</label>
            <input value={newDocName} onChange={e=>setNewDocName(e.target.value)} placeholder="π.χ. Κριτήριο αξιολόγησης" autoFocus
              onKeyDown={e=>{ if(e.key==='Enter' && newDocName.trim() && newDocFolder) createNewDoc(); }}
              style={{ width:'100%', padding:'11px 13px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:14, marginBottom:16, boxSizing:'border-box' }} />
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b6b80', marginBottom:6 }}>Φάκελος αποθήκευσης</label>
            <select value={newDocFolder} onChange={e=>setNewDocFolder(e.target.value)}
              style={{ width:'100%', padding:'11px 13px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:14, marginBottom:16, background:'#fff', boxSizing:'border-box', cursor:'pointer' }}>
              {folders.length===0 && <option value="">(Δεν υπάρχουν φάκελοι)</option>}
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {templateFiles.length > 0 && (
              <>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b6b80', marginBottom:6 }}>Πρότυπο</label>
                <select value={newDocTemplate} onChange={e=>setNewDocTemplate(e.target.value)}
                  style={{ width:'100%', padding:'11px 13px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:14, marginBottom:20, background:'#fff', boxSizing:'border-box', cursor:'pointer' }}>
                  <option value="">Κενό έγγραφο</option>
                  {templateFiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>
            )}
            {templateFiles.length === 0 && <div style={{ height:4 }} />}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setNewDocForm(false)} style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #ebebeb', background:'#fff', color:'#6b6b80', fontSize:14, cursor:'pointer' }}>Άκυρο</button>
              <button onClick={createNewDoc} disabled={!newDocName.trim() || !newDocFolder || newDocBusy}
                style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background:(newDocName.trim()&&newDocFolder&&!newDocBusy)?'#1a1a1a':'#e0e0e0', color:'#fff', fontSize:14, fontWeight:600, cursor:(newDocName.trim()&&newDocFolder&&!newDocBusy)?'pointer':'default' }}>
                {newDocBusy ? '⏳ Δημιουργία…' : 'Δημιουργία & άνοιγμα →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contactPicker && (
        <div onClick={()=>setContactPicker(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:'24px 22px', maxWidth:440, width:'100%', maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Στοιχεία επικοινωνίας</div>
            <div style={{ fontSize:12, color:'#6b6b80', marginBottom:18 }}>{contactPicker}</div>
            {[
              { key:'firstName', label:'Όνομα', ph:'Όνομα' },
              { key:'lastName',  label:'Επώνυμο', ph:'Επώνυμο' },
              { key:'school',    label:'Σχολείο', ph:'π.χ. 2ο ΓΕΛ Ηγουμενίτσας' },
              { key:'roleTitle', label:'Ιδιότητα', ph:'π.χ. Φιλόλογος' },
              { key:'phone',     label:'Τηλέφωνο', ph:'π.χ. 26650…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>{f.label}</label>
                <input value={contactDraft[f.key]||''} onChange={e=>setContactDraft(d=>({ ...d, [f.key]: e.target.value }))} placeholder={f.ph}
                  style={{ width:'100%', padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, background:'#fff', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:PALETTE.cream.deep, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>Άλλη πληροφορία</label>
              <textarea value={contactDraft.note||''} onChange={e=>setContactDraft(d=>({ ...d, note: e.target.value }))} placeholder="Σημειώσεις…" rows={3}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, background:'#fff', boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setContactPicker(null)} style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer', color:'#6b6b80' }}>Ακύρωση</button>
              <button onClick={saveContact} style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:PALETTE.cream.deep, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Αποθήκευση</button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer modal */}
      {viewing && (
        isMobile ? (
          /* ── Mobile: fullscreen viewer with action bar ── */
          <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:200, display:'flex', flexDirection:'column' }}>
            {/* Top bar: filename + zoom */}
            <div style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderBottom:'1px solid #ebebeb', gap:8, flexShrink:0 }}>
              <button onClick={()=>setViewing(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#444', padding:'4px' }}>←</button>
              <strong style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color:'#1a1a1a' }}>{viewing.name}</strong>
              <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                <button onClick={()=>setMobileZoom(z=>Math.max(0.3,z-0.1))} style={S.zoomBtn}>−</button>
                <span style={{ fontSize:11, color:'#6b6b80', minWidth:32, textAlign:'center', cursor:'pointer' }} onClick={()=>setMobileZoom(1)}>{Math.round(mobileZoom*100)}%</span>
                <button onClick={()=>setMobileZoom(z=>Math.min(2,z+0.1))} style={S.zoomBtn}>+</button>
              </div>
              {netOfFile(viewing.id, viewing.name, viewing.networkId) && (
                <button onClick={refreshViewingNetwork} disabled={!!netRefreshing} style={{ ...S.iconBtn, color:'#15803d' }}
                  title="Ανανέωση του συγχωνευμένου PDF με το τρέχον περιεχόμενο των κειμένων">
                  {netRefreshing ? '⏳' : '🔄'}
                </button>
              )}
              <button onClick={()=>window.open(viewing.previewUrl||'/api/file/'+viewing.id,'_blank')} style={S.iconBtn} title="Νέα καρτέλα">↗</button>
            </div>
            {/* Action toolbar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'6px 8px', borderBottom:'1px solid #f0f0f0', background:PALETTE.cream.bgSoft, flexShrink:0 }}>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Πληροφορίες">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Πληροφ.</span>
              </button>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Μοίρασμα">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span>Μοίρασμα</span>
              </button>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Live">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>
                <span>Live</span>
              </button>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Σχόλια">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>Σχόλια</span>
              </button>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Σύνδεση">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <span>Σύνδεση</span>
              </button>
            </div>
            {/* File content — fit-to-width via transform scale */}
            <div style={{ flex:1, overflow:'auto', WebkitOverflowScrolling:'touch', position:'relative' }}>
              <iframe src={viewing.previewUrl||'/api/file/'+viewing.id}
                style={{
                  border:'none', display:'block',
                  width: (100/mobileZoom)+'%',
                  height: (100/mobileZoom)+'%',
                  transform: 'scale('+mobileZoom+')',
                  transformOrigin:'0 0',
                }}
                title={viewing.name} />
            </div>
          </div>
        ) : viewing.isInbox ? (
          /* ── Desktop: full-page inline viewer for inbox items ── */
          <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:200, display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #ebebeb', gap:12, flexShrink:0 }}>
              <button onClick={()=>setViewing(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#444', padding:'4px 8px' }}>← Πίσω</button>
              <strong style={{ fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color:'#1a1a1a' }}>{viewing.name}</strong>
              <button onClick={()=>window.open(viewing.previewUrl,'_blank')} style={S.iconBtn} title="Νέα καρτέλα">↗</button>
              <button onClick={()=>window.open(`https://drive.google.com/uc?id=${viewing.id}&export=download`,'_blank')} style={S.iconBtn} title="Λήψη">⬇</button>
            </div>
            <iframe src={viewing.previewUrl} style={{ flex:1, border:'none', width:'100%' }} title={viewing.name} />
          </div>
        ) : (
          /* ── Desktop: modal viewer ── */
          <div onClick={() => setViewing(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'3vh 0' }}>
            <div onClick={(e)=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width: showMetaPanel?'90vw':'80vw', height:'94vh', display:'flex', flexDirection:'column', overflow:'hidden', transition:'width 0.18s ease' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #ebebeb', gap:10 }}>
                <strong style={{ fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{viewing.name}</strong>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {netOfFile(viewing.id, viewing.name, viewing.networkId) && (
                    <button onClick={refreshViewingNetwork} disabled={!!netRefreshing}
                      style={{ ...S.iconBtn, color:'#15803d', width:'auto', padding:'0 10px', fontSize:12, fontWeight:600 }}
                      title="Ανανέωση του συγχωνευμένου PDF με το τρέχον περιεχόμενο των κειμένων">
                      {netRefreshing ? '⏳' : '🔄 Ανανέωση'}
                    </button>
                  )}
                  <button onClick={()=>window.open(viewing.previewUrl||'/api/file/'+viewing.id,'_blank')} style={S.iconBtn} title="Άνοιγμα σε νέα καρτέλα">↗</button>
                  {!viewing.isInbox && getEditUrl(viewing) && <button onClick={()=>window.open(getEditUrl(viewing),'_blank')} style={{ ...S.iconBtn, color:'#1a73e8' }} title="Επεξεργασία στο Google">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>}
                  {!viewing.isInbox && <button onClick={()=>setShowMetaPanel((p)=>!p)} style={{ ...S.iconBtn, background:showMetaPanel?PALETTE.peach.bgSoft:'#f4f4f4', borderColor:showMetaPanel?PALETTE.peach.deep:'#e0e0e0', color:showMetaPanel?PALETTE.peach.deep:'#444' }} title="Επεξεργασία">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>}
                  <button onClick={()=>setViewing(null)} style={S.closeBtn} title="Κλείσιμο">✕</button>
                </div>
              </div>
              <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
                <iframe src={viewing.previewUrl||'/api/file/'+viewing.id} style={{ flex:1, border:'none', minWidth:0 }} title={viewing.name} />
                {showMetaPanel && (
                  <div style={{ flex:'0 0 50%', borderLeft:'1px solid #ebebeb', display:'flex', flexDirection:'column', background:PALETTE.cream.bgSoft }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #ebebeb' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>{isAppFile(viewing) ? 'Πληροφορίες · Σχόλια · Συνδέσεις' : (isTeacher ? 'Ετικέτες · Πληροφορίες · Σχόλια · Ερωτήσεις · Συνδέσεις' : 'Ετικέτες · Πληροφορίες · Σχόλια · Σύνδεση')}</span>
                      {metaSaving && <span style={{ fontSize:11, color:PALETTE.peach.deep }}>Αποθήκευση…</span>}
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
                      {!isAppFile(viewing) && <>
                      <div style={S.cpLabel}>Ετικέτες</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                        {vTags.map((t) => { const c=tagColor(t); return (
                          <span key={t} className="tag-chip" style={{ display:'inline-flex', alignItems:'center', gap:4, background:c.bg, color:c.text, borderRadius:999, padding:'3px 9px', fontSize:12 }}>#{t}<span className="tag-x" style={{ cursor:'pointer', opacity:0.45, fontSize:10 }} onClick={()=>removeTag(viewing.id,t)}>✕</span></span>
                        ); })}
                      </div>
                      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                        <input type="text" placeholder="Νέα ετικέτα…" value={tagInput} onChange={(e)=>setTagInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') addTag(viewing.id,tagInput); }}
                          style={{ flex:1, padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, background:'#fff' }} />
                        {tagInput.trim() && <button onClick={()=>addTag(viewing.id,tagInput)} style={{ ...btn('solid'), padding:'7px 12px' }}>+</button>}
                      </div>
                      <div style={{ fontSize:11, color:'#aeaeb8', marginBottom:6 }}>Προτεινόμενες:</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:18 }}>
                        {suggested.map((t) => { const c=tagColor(t); return <span key={t} onClick={()=>addTag(viewing.id,t)} style={{ cursor:'pointer', background:c.bg, color:c.text, borderRadius:999, padding:'3px 9px', fontSize:12 }}>+{t}</span>; })}
                      </div>
                      </>}
                      <div style={S.cpLabel}>Πληροφορίες</div>
                      <textarea placeholder="Πηγή, τίτλος, συγγραφέας…" value={fileInfo(viewing.id)} onChange={(e)=>updateInfo(viewing.id,e.target.value)}
                        style={{ width:'100%', minHeight:60, padding:'8px 12px', border:'1px solid '+PALETTE.cream.accent, borderRadius:8, fontSize:13, lineHeight:1.5, background:'#fff', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
                      <div style={{ ...S.cpLabel, marginTop:18 }}>Σχόλια</div>
                      <textarea placeholder="Σημειώσεις για το αρχείο…" value={fileComment(viewing.id)} onChange={(e)=>updateComment(viewing.id,e.target.value)}
                        style={{ width:'100%', minHeight:200, padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:14, lineHeight:1.6, background:'#fff', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
                      {isTeacher && !isAppFile(viewing) && <><div style={{ ...S.cpLabel, marginTop:18 }}>Ερωτήσεις/Απαντήσεις</div>
                      <QuestionsFields fileId={viewing.id} raw={fileQuestions(viewing.id)} onChange={updateQuestions} compact={false} readOnly={false} /></>}

                      <div style={{ ...S.cpLabel, marginTop:18 }}>Συνδέσεις</div>
                      {vLinks.map((lnk, li) => (
                        <div key={li} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 10px', background:'#fff', borderRadius:8, border:'1px solid #e8e0c8', minWidth:0 }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{lnk.type==='url'?'🌐':'📄'}</span>
                          <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{lnk.name}</span>
                          <button onClick={() => removeLink(viewing.id, li)} style={S.delBtnSm}>✕</button>
                        </div>
                      ))}

                      <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, margin:'10px 0 6px' }}>Διεύθυνση URL</div>
                      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                        <input placeholder="https://…" value={linkUrlInput} onChange={(e)=>setLinkUrlInput(e.target.value)}
                          style={{ flex:2, padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, background:'#fff' }} />
                        <input placeholder="Τίτλος…" value={linkNameInput} onChange={(e)=>setLinkNameInput(e.target.value)}
                          style={{ flex:1, padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, background:'#fff' }} />
                        <button onClick={() => { const u=linkUrlInput.trim(); if (u) { addLink(viewing.id, { type:'url', url:toPublicLink(u), name:linkNameInput.trim()||u }); setLinkUrlInput(''); setLinkNameInput(''); } }}
                          style={{ ...btn('solid'), padding:'7px 12px' }}>+</button>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5 }}>Ιστότοποι</span>
                        <button onClick={() => { const n=prompt('Τίτλος ιστοτόπου:'); if(!n) return; const u=prompt('Διεύθυνση (URL):'); if(!u) return; addCustomUrl(n, u.startsWith('http')?u:'https://'+u); }}
                          title="Προσθήκη σταθερού ιστοτόπου"
                          style={{ width:20, height:20, borderRadius:6, border:'1px solid #d0d0d0', background:'#f4f4f4', cursor:'pointer', fontSize:13, lineHeight:1, color:'#888', display:'flex', alignItems:'center', justifyContent:'center' }}>＋</button>
                        <button onClick={() => { if(confirm('Επαναφορά στους αρχικούς ιστοτόπους;')) resetCustomUrls(); }}
                          title="Επαναφορά προεπιλογών"
                          style={{ width:20, height:20, borderRadius:6, border:'1px solid #d0d0d0', background:'#f4f4f4', cursor:'pointer', fontSize:11, lineHeight:1, color:'#888', display:'flex', alignItems:'center', justifyContent:'center' }}>↺</button>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                        {allSuggestedUrls.filter(s => !vLinks.some(l=>l.url===s.url)).map((s) => (
                          <span key={s.url} style={{ display:'inline-flex', alignItems:'center', gap:0 }}>
                            <button onClick={() => addLink(viewing.id, { type:'url', url:s.url, name:s.name })}
                              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:'10px 0 0 10px', border:'1px solid #e0e0e0', background:'#fafafa', cursor:'pointer', fontSize:11, fontWeight:500, color:'#333' }}>
                              + {s.name}
                            </button>
                            <button onClick={() => removeCustomUrl(s.url)} title="Αφαίρεση από τη λίστα"
                              style={{ padding:'5px 6px', borderRadius:'0 10px 10px 0', border:'1px solid #e0d0d0', borderLeft:'none', background:'#fef2f2', cursor:'pointer', fontSize:10, color:'#b91c1c', lineHeight:1 }}>✕</button>
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Αρχεία & Εφαρμογές</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                        {folders.map((fld) => {
                          const cnt = normalFiles.filter(x => x.folderId===fld.id && x.id!==viewing.id && !vLinks.some(l=>l.targetId===x.id)).length;
                          if (!cnt) return null;
                          const isOpen = modalPickerSection === fld.id;
                          return (
                            <button key={fld.id} onClick={() => setModalPickerSection(isOpen ? null : fld.id)}
                              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                                border:'2px solid '+(isOpen ? PALETTE.cream.deep : '#e0e0e0'),
                                background: isOpen ? PALETTE.cream.bgSoft : '#fafafa',
                                cursor:'pointer', fontSize:13, fontWeight:600,
                                color: isOpen ? PALETTE.cream.deep : '#555' }}>
                              📁 {fld.name} <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                            </button>
                          );
                        })}
                        {ghAppFiles.length > 0 && (() => {
                          const appFiles = ghAppFiles.filter(x => !vLinks.some(l => l.targetId===x.id || l.url===x._ghUrl));
                          if (!appFiles.length) return null;
                          const isOpen = modalPickerSection === 'apps';
                          return (
                            <button key="apps" onClick={() => setModalPickerSection(isOpen ? null : 'apps')}
                              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                                border:'2px solid '+(isOpen ? '#5c7a3a' : '#e0e0e0'),
                                background: isOpen ? '#f0f5eb' : '#fafafa',
                                cursor:'pointer', fontSize:13, fontWeight:600,
                                color: isOpen ? '#5c7a3a' : '#555' }}>
                              ⚡ Εφαρμογές <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                            </button>
                          );
                        })()}
                      </div>
                      {modalPickerSection && (()=> {
                        const fldFiles = modalPickerSection === 'apps'
                          ? ghAppFiles.filter(x => !vLinks.some(l => l.targetId===x.id || l.url===x._ghUrl))
                          : normalFiles.filter(x => x.folderId===modalPickerSection && x.id!==viewing.id && !vLinks.some(l=>l.targetId===x.id));
                        if (!fldFiles.length) return <div style={{ padding:10, color:'#aeaeb8', fontSize:12, textAlign:'center' }}>Κανένα αρχείο</div>;
                        return (
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {fldFiles.map((af) => (
                              <div key={af.id} onClick={() => addLink(viewing.id, af._ghUrl ? { type:'url', url:af._ghUrl, name:af.name } : { type:'file', targetId:af.id, name:af.name })}
                                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', background:'#fff', border:'1px solid #e8e0c8' }}>
                                <span style={{ fontSize:14 }}>📄</span>
                                <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{af.name}</span>
                                <span style={{ fontSize:11, color:PALETTE.cream.deep, flexShrink:0 }}>+ Σύνδεση</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Live modal ── */}
      {liveFile && (() => {
        const lLinks = fileLinks(liveFile.id);
        const curLink = lLinks[activeLiveTab] || null;
        const curSrc = curLink ? (curLink.type === 'url' ? toEmbedUrl(curLink.url) : '/api/file/'+curLink.targetId) : null;

        if (isMobile) return (
          <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:210, display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderBottom:'1px solid #ebebeb', gap:8, flexShrink:0 }}>
              <button onClick={()=>setLiveFile(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#444', padding:'4px' }}>←</button>
              <strong style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color:'#1a1a1a' }}>{liveFile.name}</strong>
            </div>
            <div style={{ display:'flex', gap:4, padding:'6px 10px', overflowX:'auto', borderBottom:'1px solid #f0f0f0', flexShrink:0, background:PALETTE.cream.bgSoft }}>
              <button onClick={()=>setActiveLiveTab(-1)} style={{ ...btn('mini'), padding:'4px 10px', fontSize:11, background: activeLiveTab===-1?PALETTE.cream.deep:'transparent', color: activeLiveTab===-1?'#fff':PALETTE.cream.deep, whiteSpace:'nowrap', flexShrink:0 }}>📄 Αρχείο</button>
              {lLinks.map((lnk, i) => (
                <button key={i} onClick={()=>setActiveLiveTab(i)} style={{ ...btn('mini'), padding:'4px 10px', fontSize:11, background: activeLiveTab===i?PALETTE.cream.deep:'transparent', color: activeLiveTab===i?'#fff':PALETTE.cream.deep, whiteSpace:'nowrap', flexShrink:0 }}>
                  {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>20?lnk.name.slice(0,20)+'…':lnk.name}
                </button>
              ))}
            </div>
            <div style={{ flex:1, overflow:'auto', WebkitOverflowScrolling:'touch', display:'flex' }}>
              {(()=>{
                const liveSrc = activeLiveTab===-1 ? '/api/file/'+liveFile.id : curSrc;
                const liveTitle = activeLiveTab===-1 ? liveFile.name : (curLink?.name||'');
                const isUrl = curLink?.type === 'url' && activeLiveTab !== -1;
                return isUrl
                  ? <EmbedFrame src={liveSrc} style={{ border:'none', display:'block' }} title={liveTitle} />
                  : <iframe src={liveSrc} style={{ flex:1, border:'none', minWidth:0 }} title={liveTitle} />;
              })()}
            </div>
          </div>
        );

        return (
          <div onClick={()=>setLiveFile(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:210, padding:'2vh 0' }}>
            <div onClick={(e)=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:'96vw', height:'94vh', display:'flex', overflow:'hidden' }}>
              {/* Αριστερά: κύριο αρχείο */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'1px solid #ebebeb', minWidth:0 }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #ebebeb', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <strong style={{ fontSize:14, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📄 {liveFile.name}</strong>
                </div>
                <iframe src={'/api/file/'+liveFile.id} style={{ flex:1, border:'none', minWidth:0 }} title={liveFile.name} />
              </div>
              {/* Δεξιά: συνδεδεμένα */}
              <div style={{ width:'42%', flexShrink:0, display:'flex', flexDirection:'column', background:PALETTE.cream.bgSoft }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #ebebeb', flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>Συνδεδεμένα</span>
                  <button onClick={()=>setLiveFile(null)} style={S.closeBtn}>✕</button>
                </div>
                <div style={{ display:'flex', gap:4, padding:'8px 10px', flexWrap:'wrap', borderBottom:'1px solid #ebebeb', flexShrink:0 }}>
                  {lLinks.map((lnk, i) => (
                    <button key={i} onClick={()=>setActiveLiveTab(i)}
                      style={{ ...btn('mini'), padding:'4px 10px', fontSize:11, background: activeLiveTab===i?PALETTE.cream.deep:'transparent', color: activeLiveTab===i?'#fff':PALETTE.cream.deep }}>
                      {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>25?lnk.name.slice(0,25)+'…':lnk.name}
                    </button>
                  ))}
                </div>
                <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
                  {curSrc ? (
                    curLink?.type === 'url'
                      ? <EmbedFrame src={curSrc} style={{ border:'none' }} title={curLink?.name||''} />
                      : <iframe src={curSrc} style={{ flex:1, border:'none', minWidth:0 }} title={curLink?.name||''} />
                  ) : (
                    <div style={{ padding:20, textAlign:'center', color:'#aeaeb8', fontSize:13 }}>Επίλεξε μια σύνδεση</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live toast */}
      {liveToast && (
        <div style={{ position:'fixed', bottom:isMobile?70:20, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', borderRadius:16, padding:'14px 24px', zIndex:500, boxShadow:'0 8px 30px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:280, maxWidth:'90vw' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#e8c96a', fontWeight:700, fontSize:12 }}>● LIVE</span>
            <span style={{ fontSize:14 }}>Κωδικός:</span>
            <span style={{ fontSize:22, fontWeight:700, letterSpacing:4, fontFamily:'monospace', color:'#e8c96a' }}>{liveToast.code}</span>
          </div>
          <div style={{ fontSize:11, color:'#aeaeb8', textAlign:'center' }}>Ο σύνδεσμος αντιγράφηκε · Λήγει σε 2 ώρες</div>
          <button onClick={()=>setLiveToast(null)} style={{ position:'absolute', top:6, right:10, background:'none', border:'none', color:'#666', fontSize:14, cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* Visibility Picker */}
      {visibilityPicker && (() => {
        const curFile = fileOf(visibilityPicker);
        const savedV = curFile?.visibility || 'none';
        const curV = visibilityDraft; // οι επιλογές γίνονται τοπικά (draft) — αποστολή μόνο με «Αποθήκευση»
        const isDirty = curV !== savedV;
        // Parse τρέχουσα λίστα χρηστών (από το draft)
        const curUsers = curV.startsWith('users:') ? (() => { try { return JSON.parse(curV.slice(6)); } catch(e) { return []; } })()
          : curV.startsWith('user:') ? [curV.slice(5)] : [];

        const toggleUser = (email) => {
          const next = curUsers.includes(email)
            ? curUsers.filter(e => e !== email)
            : [...curUsers, email];
          if (next.length === 0) setVisibilityDraft('none');
          else if (next.length === 1) setVisibilityDraft(`user:${next[0]}`);
          else setVisibilityDraft(`users:${JSON.stringify(next)}`);
        };
        const closePicker = () => { setVisibilityPicker(null); setShareMessage(''); setCustomRecipient(''); };
        // Ψευδομέιλ: ομαλοποίηση όπως στη Light — πεζά, χωρίς κενά, @gmail.com αν λείπει το @
        const addCustomRecipient = () => {
          let v = (customRecipient || '').trim().toLowerCase().replace(/\s+/g, '');
          if (!v) return;
          if (!v.includes('@')) v += '@gmail.com';
          if (!curUsers.includes(v)) toggleUser(v);
          setCustomRecipient('');
        };
        const connEmails = new Set((networkData.connections || []).map((c) => c.email));
        const customSelected = curUsers.filter((e) => !connEmails.has(e));

        return (
          <div onClick={closePicker} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <style>{`.vp-opt{transition:transform 0.08s ease, background 0.12s ease, border-color 0.12s ease;} .vp-opt:active{transform:scale(0.97);background:#e8f7ee !important;}`}</style>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'24px 20px', maxWidth:360, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Ορατό σε…</div>
              <div style={{ fontSize:12, color:'#6b6b80', marginBottom:16 }}>Επίλεξε ποιος θα βλέπει αυτό το αρχείο — μπορείς πολλούς χρήστες μαζί — και πάτησε «Αποθήκευση».</div>

              {/* Όλοι / Συνδέσεις */}
              {[
                { value:'public',      icon:'🌍', label:'Δημόσιο', desc:'Μόνο στη δημόσια σελίδα (χωρίς login)' },
                { value:'connections', icon:'👥', label:'Συνδέσεις μου', desc:'Μόνο όσοι είναι στο δίκτυό μου' },
              ].map(opt => {
                const isActive = curV === opt.value;
                return (
                  <button key={opt.value} className="vp-opt" onClick={()=>setVisibilityDraft(isActive ? 'none' : opt.value)}
                    style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 14px', borderRadius:12,
                      border: isActive ? '2px solid #16a34a' : '1px solid #ebebeb',
                      background: isActive ? '#f0fdf4' : '#fafafa', cursor:'pointer', marginBottom:8, textAlign:'left' }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{opt.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:'#6b6b80' }}>{opt.desc}</div>
                    </div>
                    {isActive && <span style={{ fontSize:16, color:'#16a34a', flexShrink:0 }}>✓</span>}
                  </button>
                );
              })}

              {/* Συγκεκριμένοι χρήστες — additive, πολλαπλή επιλογή χωρίς κλείσιμο */}
              {(networkData.connections||[]).length > 0 && <>
                <div style={{ fontSize:11, color:'#aeaeb8', margin:'10px 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>
                  Συγκεκριμένοι χρήστες {curUsers.length > 0 && <span style={{ background:'#1a1a1a', color:'#fff', borderRadius:999, padding:'1px 7px', fontSize:10 }}>{curUsers.length}</span>}
                </div>
                {networkData.connections.map(conn => {
                  const isSelected = curUsers.includes(conn.email);
                  return (
                    <button key={conn.email} className="vp-opt" onClick={()=>toggleUser(conn.email)}
                      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:12,
                        border: isSelected ? '2px solid #16a34a' : '1px solid #ebebeb',
                        background: isSelected ? '#f0fdf4' : '#fafafa', cursor:'pointer', marginBottom:6, textAlign:'left' }}>
                      <span style={{ fontSize:18 }}>👤</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{conn.name||conn.email}</div>
                        <div style={{ fontSize:11, color:'#6b6b80' }}>{conn.email}</div>
                      </div>
                      {isSelected && <span style={{ fontSize:16, color:'#16a34a', flexShrink:0 }}>✓</span>}
                    </button>
                  );
                })}
              </>}
              {(networkData.connections||[]).length === 0 && <div style={{ fontSize:12, color:'#aeaeb8', fontStyle:'italic', padding:'4px 0 8px' }}>Δεν έχεις συνδέσεις — πήγαινε στα Δίκτυα.</div>}

              {/* Ψευδομέιλ — αποστολή σε παραλήπτη ΕΚΤΟΣ συνδέσεων (θα το δει στη σελίδα μαθητή/class) */}
              <div style={{ fontSize:11, color:'#aeaeb8', margin:'10px 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>✉️ Άλλος παραλήπτης (ψευδομέιλ)</div>
              {customSelected.map((e) => (
                <button key={e} className="vp-opt" onClick={()=>toggleUser(e)} title="Πάτησε για αφαίρεση"
                  style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:12,
                    border:'2px solid #16a34a', background:'#f0fdf4', cursor:'pointer', marginBottom:6, textAlign:'left' }}>
                  <span style={{ fontSize:18 }}>✉️</span>
                  <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e}</div>
                  <span style={{ fontSize:16, color:'#16a34a', flexShrink:0 }}>✓</span>
                </button>
              ))}
              <div style={{ display:'flex', gap:6, marginBottom:4 }}>
                <input value={customRecipient} onChange={(e)=>setCustomRecipient(e.target.value)}
                  onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); addCustomRecipient(); } }}
                  placeholder="π.χ. mathitis1 ή email@gmail.com"
                  style={{ flex:1, padding:'9px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:isMobile?16:13, boxSizing:'border-box' }} />
                <button onClick={addCustomRecipient} disabled={!customRecipient.trim()}
                  style={{ padding:'9px 14px', borderRadius:10, border:'none', background: customRecipient.trim() ? '#16a34a' : '#e0e0e0', color:'#fff', fontSize:13, fontWeight:600, cursor: customRecipient.trim() ? 'pointer' : 'default', flexShrink:0 }}>+</button>
              </div>
              <div style={{ fontSize:10.5, color:'#aeaeb8', marginBottom:4 }}>Χωρίς @ συμπληρώνεται @gmail.com. Ο μαθητής το βλέπει βάζοντας το ψευδομέιλ του στη σελίδα της τάξης.</div>

              {/* Μήνυμα προς παραλήπτες */}
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, color:'#6b6b80', fontWeight:600, marginBottom:4 }}>💬 Μήνυμα (προαιρετικό)</div>
                <textarea value={shareMessage} onChange={e => setShareMessage(e.target.value)}
                  placeholder="π.χ. Δείτε το κείμενο και ετοιμάστε σχόλια…"
                  rows={2} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:10, fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>

              <div style={{ height:1, background:'#f0f0f0', margin:'12px 0 8px' }} />
              {(curV !== 'none' || savedV !== 'none') && (
                <button className="vp-opt" onClick={()=>setVisibilityDraft('none')}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'10px 14px', borderRadius:12, border: curV === 'none' ? '2px solid #dc2626' : '1px solid #fee2e2', background:'#fff', cursor:'pointer', marginBottom:8, textAlign:'left' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>🔒</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#dc2626' }}>Απόσυρση</div>
                    <div style={{ fontSize:11, color:'#6b6b80' }}>Αφαίρεση από τη σελίδα Student</div>
                  </div>
                  {curV === 'none' && savedV !== 'none' && <span style={{ fontSize:16, color:'#dc2626', flexShrink:0 }}>✓</span>}
                </button>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={closePicker} disabled={publishing}
                  style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer', color:'#6b6b80', opacity:publishing?0.5:1 }}>Άκυρο</button>
                <button onClick={()=>setVisibility(visibilityPicker, curV)} disabled={publishing || !isDirty}
                  style={{ flex:2, padding:'11px', borderRadius:12, border:'none', background: (!isDirty||publishing) ? '#a7d7b9' : '#16a34a', color:'#fff', fontSize:13, fontWeight:700, cursor:(publishing||!isDirty)?'default':'pointer' }}>
                  {publishing ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QR popup — για HTML εφαρμογές το QR/link ανοίγει τη ΖΩΝΤΑΝΗ εφαρμογή (μέσω /api/student-file) */}
      {qrFile && (
        <div onClick={() => setQrFile(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'28px 24px', maxWidth:320, width:'100%', textAlign:'center', boxShadow:'0 12px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>QR Code</div>
            <div style={{ fontSize:12, color:'#6b6b80', marginBottom:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{qrFile.name}</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getShareUrl(qrFile))}`}
              alt="QR" width={200} height={200} style={{ borderRadius:8, border:'1px solid #eee', margin:'0 auto', display:'block' }} />
            <p style={{ fontSize:11, color:'#aeaeb8', marginTop:12 }}>{isHtmlApp(qrFile) ? 'Σκανάρετε με κινητό — ανοίγει τη ζωντανή εφαρμογή' : 'Σκανάρετε με κινητό'}</p>
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={() => { try { navigator.clipboard.writeText(getShareUrl(qrFile)); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); } catch(e) {} }}
                style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #e0e0e0', background: qrCopied ? '#f0fdf4' : '#fff', color: qrCopied ? '#16a34a' : '#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {qrCopied ? '✓ Αντιγράφηκε' : 'Αντιγραφή συνδέσμου'}
              </button>
              <button onClick={() => setQrFile(null)} style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'none', background:'#1a1a1a', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Κλείσιμο</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ερωτήσεις (8 πεδία: Α1, Β1, Β2α, Β2β, Β3α, Β3β, Γ1, Δ1) ──
function QuestionsFields({ fileId, raw, onChange, compact, readOnly }) {
  const items = parseQuestions(raw);
  const update = (code, text) => {
    const updated = items.map(q => q.code === code ? { ...q, text } : q);
    if (onChange) onChange(fileId, serializeQuestions(updated));
  };
  if (readOnly) {
    const hasAny = items.some(q => q.text?.trim());
    if (!hasAny) return <div style={{ fontSize:12, color:'#aeaeb8', fontStyle:'italic', padding:'4px 0' }}>Χωρίς ερωτήσεις — {compact ? 'πάτα ✏️ για επεξεργασία' : 'επεξεργασία από το modal (✏️)'}</div>;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {items.filter(q => q.text?.trim()).map(q => (
          <div key={q.code} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <span style={{ fontSize:12, fontWeight:700, color:PALETTE.mustard.deep, minWidth:34, textAlign:'right', flexShrink:0 }}>{q.code}</span>
            <div style={{ flex:1, fontSize: compact?12:13, color:'#3d3a2e', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{q.text}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {items.map(q => (
        <div key={q.code} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
          <span style={{ fontSize:12, fontWeight:700, color:PALETTE.mustard.deep, minWidth:34, paddingTop:7, textAlign:'right', flexShrink:0 }}>{q.code}</span>
          <textarea value={q.text} onChange={e => { e.stopPropagation(); update(q.code, e.target.value); }}
            onClick={e => e.stopPropagation()} placeholder={`Ερώτηση ${q.code}…`}
            ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }}
            style={{ flex:1, padding:'6px 10px', border:'1px solid '+(q.text ? PALETTE.mustard.accent : '#e0e0e0'), borderRadius:8,
              fontSize: compact ? 16 : 13, lineHeight:1.5, background: q.text ? 'rgba(255,255,255,0.9)' : '#fafafa',
              resize:'none', fontFamily:'inherit', boxSizing:'border-box', minHeight:30, overflow:'hidden' }} />
        </div>
      ))}
    </div>
  );
}

// ── Λίστα αρχείων (κοινό component) ──
function FileList({ files, loading, empty, onOpen, onRemove, onFav, onComment, onInfo, onQuestions, onAddLink, onRemoveLink, onLive, onPublish, liveSending, allFiles, appFiles, showFolder, folders, compact, userRole, onQr, suggestedUrls, onPrint, networkFileIds, onNetRefresh }) {
  const isTeacherRole = userRole === 'teacher';
  const [expanded, setExpanded] = useState(null);
  const [commentOpen, setCommentOpen] = useState(null);
  const [infoOpen, setInfoOpen] = useState(null);
  const [questionsOpen, setQuestionsOpen] = useState(null);
  const [linksOpen, setLinksOpen] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [printOpen, setPrintOpen] = useState(null); // fileId αν ενεργή η επεξεργασία (μόνο mobile)
  const [mLinkUrl, setMLinkUrl] = useState('');
  const [mLinkName, setMLinkName] = useState('');
  const [pickerSection, setPickerSection] = useState(null);
  if (loading) return <div style={S.empty}>Φόρτωση…</div>;
  if (!files || files.length === 0) return <div style={{ ...S.empty, background:PALETTE.cream.bgSoft, borderRadius:14, border:`1px dashed ${PALETTE.cream.accent}` }}>{empty}</div>;
  const folderName = (id) => folders?.find((f)=>f.id===id)?.name;
  const actionBtn = { display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', padding:'10px 8px', color:PALETTE.peach.deep, fontSize:10, fontWeight:500, minWidth:52, borderRadius:10, cursor:'pointer' };
  const actionBtnOff = { ...actionBtn, opacity:0.30 };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: compact ? 6 : 8, maxWidth:'100%', overflow:'hidden' }}>
      {files.map((f) => {
        const tags = f.tags || []; const hasComment = !!(f.comment||'').trim(); const hasQuestions = hasAnyQuestions(f.questions); const hasInfo = !!(f.info||'').trim();
        const isApp = (appFiles||[]).some(a => a.id === f.id); // εφαρμογή; → χωρίς εκτύπωση/ερωτήσεις
        const isNet = !!(f._isNetwork || networkFileIds?.has(f.id) || networkFileIds?.has(f.name) || (f.tags||[]).includes('Δίκτυο')); // συγχωνευμένο (δίκτυο) → μία μόνο εκτύπωση
        const fLinks = f.links || []; const hasLinks = fLinks.length > 0;
        const isPublished = !!(f.published || (f.visibility && f.visibility !== 'none'));
        const visIcon = f.visibility === 'public' ? '🌍' : f.visibility === 'connections' ? '👥' : (f.visibility?.startsWith('user:') || f.visibility?.startsWith('users:')) ? '👤' : null;
        const isExp = expanded === f.id;
        const isEditing = compact && editMode === f.id; // Mobile: edit only after toggle
        const canEdit = isEditing; // Desktop: never editable in card
        const isCommentOpen = isExp && commentOpen === f.id;
        const isInfoOpen = isExp && infoOpen === f.id;
        const isQuestionsOpen = isExp && questionsOpen === f.id;
        const isLinksOpen = isExp && linksOpen === f.id;
        return (
          <div key={f.id} style={{
            background: isExp ? PALETTE.peach.bgSoft : '#fff',
            border: isExp ? `1.5px solid ${PALETTE.peach.accent}` : '1px solid #ebebeb',
            borderRadius: isExp ? 18 : (compact ? 10 : 12),
            overflow: printOpen === f.id ? 'visible' : 'hidden', transition:'all 0.3s ease',
            position: printOpen === f.id ? 'relative' : undefined,
            zIndex: printOpen === f.id ? 60 : undefined,
            boxShadow: isExp ? '0 8px 28px rgba(0,0,0,0.10)' : 'none',
            maxWidth:'100%', minWidth:0,
          }}>
            <div onClick={() => { setExpanded(isExp ? null : f.id); setCommentOpen(null); setInfoOpen(null); setQuestionsOpen(null); setLinksOpen(null); setEditMode(null); setPrintOpen(null); }}
              style={{ display:'flex', alignItems:'center', gap: compact ? 8 : 12, padding: compact ? '10px 10px' : '12px 14px', cursor:'pointer', minWidth:0 }}>
              <button onClick={(e)=>{e.stopPropagation();onFav(f.id,e);}} title={f.favorite?'Αφαίρεση':'Αγαπημένο'}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize: compact ? 15 : 17, color:f.favorite?'#eab308':'#d0d0d0', flexShrink:0, padding:0 }}>{f.favorite?'★':'☆'}</button>
              {!compact && <span style={{ fontSize:18 }}>📄</span>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize: compact ? 13 : 14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name, compact ? 15 : 25)}</div>
                {!compact && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4, flexWrap:'wrap' }}>
                    {showFolder && folderName(f.folderId) && <span style={{ fontSize:10, color:'#aeaeb8' }}>📁 {folderName(f.folderId)}</span>}
                    {!isApp && tags.slice(0,3).map((t)=>{ const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                    {!isApp && tags.length > 3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{tags.length-3}</span>}
                    {hasInfo && <span style={{ fontSize:10, color:'#aeaeb8' }}>ℹ️</span>}
                    {!isApp && isTeacherRole && hasQuestions && <span style={{ fontSize:10, color:'#aeaeb8' }}>📝</span>}
                    {hasLinks && <span style={{ fontSize:10, color:'#aeaeb8' }}>🔗{fLinks.length}</span>}
                    {visIcon && <span style={{ fontSize:10 }}>{visIcon}</span>}
                  </div>
                )}
                {compact && showFolder && folderName(f.folderId) && (
                  <div style={{ fontSize:10, color:'#aeaeb8', marginTop:2 }}>📁 {folderName(f.folderId)}</div>
                )}
                {compact && (isPublished || hasLinks) && (
                  <div style={{ display:'flex', gap:4, marginTop:2 }}>
                    {visIcon && <span style={{ fontSize:10 }}>{visIcon}</span>}
                    {hasLinks && <span style={{ fontSize:10, color:'#aeaeb8' }}>🔗{fLinks.length}</span>}
                  </div>
                )}
              </div>
              <button onClick={(e)=>{e.stopPropagation();onOpen(f);}} style={{ ...btn('mini'), padding: compact ? '4px 8px' : '5px 10px', fontSize: compact ? 11 : 12 }}>{compact ? 'Άνοιγμα' : 'Άνοιγμα / Επεξεργασία'}</button>
              {isNet && onNetRefresh && (
                <button onClick={(e)=>{e.stopPropagation(); onNetRefresh(f);}}
                  style={{ ...btn('mini'), padding: compact ? '4px 7px' : '5px 9px', fontSize: compact ? 11 : 12, color:'#15803d' }}
                  title="Ανανέωση του συγχωνευμένου PDF με το τρέχον περιεχόμενο των κειμένων">🔄</button>
              )}
              {!isApp && (hasQuestions && onPrint && !isNet ? (
                <span style={{ position:'relative', display:'inline-block' }}>
                  <button onClick={(e)=>{e.stopPropagation(); setPrintOpen(printOpen===f.id ? null : f.id);}}
                    style={{ ...btn('mini'), padding: compact ? '4px 7px' : '5px 9px', fontSize: compact ? 11 : 12, background: printOpen===f.id ? PALETTE.cream.bgSoft : undefined }} title="Εκτύπωση">🖨️</button>
                  {printOpen === f.id && (
                    <div onClick={e => e.stopPropagation()}
                      style={{ position:'absolute', top:'100%', right:0, marginTop:4, zIndex:50, background:'#fff', borderRadius:12, boxShadow:'0 6px 20px rgba(0,0,0,0.15)', border:'1px solid #e0e0e0', padding:6, display:'flex', flexDirection:'column', gap:4, minWidth:180 }}>
                      <button onClick={() => { setPrintOpen(null); printFileById(f); }}
                        style={{ padding:'8px 12px', borderRadius:8, border:'none', background:'#fafafa', cursor:'pointer', fontSize:12, fontWeight:500, color:'#3d3a2e', textAlign:'left', display:'flex', alignItems:'center', gap:6 }}>
                        📄 Μόνο κείμενο
                      </button>
                      <button onClick={() => { setPrintOpen(null); onPrint(f); }}
                        style={{ padding:'8px 12px', borderRadius:8, border:'none', background:PALETTE.cream.bgSoft, cursor:'pointer', fontSize:12, fontWeight:600, color:PALETTE.mustard?.deep||'#8a7d4a', textAlign:'left', display:'flex', alignItems:'center', gap:6 }}>
                        📝 Με ερωτ./απαντ.
                      </button>
                    </div>
                  )}
                </span>
              ) : (
                <button onClick={(e)=>{e.stopPropagation(); printFileById(f);}}
                  style={{ ...btn('mini'), padding: compact ? '4px 7px' : '5px 9px', fontSize: compact ? 11 : 12 }} title="Εκτύπωση">🖨️</button>
              ))}
              {onQr && <button onClick={(e)=>{e.stopPropagation();onQr(f);}} style={{ ...btn('mini'), padding: compact ? '4px 6px' : '5px 8px' }} title="QR Code">{QrIcon}</button>}
              {!compact && <button onClick={(e)=>{e.stopPropagation();onRemove(f.id);}} className="del-h" style={S.delBtn} title="Διαγραφή">✕</button>}
            </div>

            {isExp && (
              <div style={{ padding: compact ? '0 10px 14px' : '0 14px 14px', borderTop: compact ? 'none' : '1px solid #f0f0f0', background: compact ? 'transparent' : PALETTE.cream.bgSoft, maxWidth:'100%', overflow:'hidden', boxSizing:'border-box' }}>
                {compact && (
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:6, paddingTop:4 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditMode(isEditing ? null : f.id); }}
                      style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 12px', borderRadius:8,
                        border: isEditing ? '1.5px solid '+PALETTE.peach.deep : '1px solid #d0d0d0',
                        background: isEditing ? PALETTE.peach.bgSoft : '#f4f4f4',
                        color: isEditing ? PALETTE.peach.deep : '#888',
                        fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      ✏️ {isEditing ? 'Κλείδωμα' : 'Επεξεργασία'}
                    </button>
                  </div>
                )}
                {!isApp && tags.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10, paddingLeft:2, paddingTop: compact ? 0 : 8 }}>
                    {tags.map((t)=>{ const c=tagColor(t); return <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                  </div>
                )}
                {/* Πληροφορίες — σταθερό read-only πλαίσιο */}
                {hasInfo && (
                  <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.6)', borderRadius:10, marginBottom:8, fontSize: compact?11:12, color:'#3d3a2e', lineHeight:1.5, maxWidth:'100%', overflow:'hidden', wordBreak:'break-word', border: compact ? 'none' : '1px solid '+PALETTE.cream.accent }}>
                    ℹ️ {compact
                      ? (f.info.length > 80 ? f.info.slice(0,80)+'…' : f.info)
                      : f.info.split(/\s+/).slice(0,40).join(' ') + (f.info.split(/\s+/).length > 40 ? ' …' : '')
                    }
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', background:'rgba(255,255,255,0.5)', borderRadius:14, padding:'4px 0', flexWrap:'wrap', gap: compact ? 2 : 0 }}>
                  <button style={{ ...actionBtn, color: isPublished ? '#fff' : PALETTE.peach.deep, background: isPublished ? '#16a34a' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); if (onPublish) onPublish(f.id); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>{visIcon || 'Μοίρασμα'}</span>
                  </button>
                  <button style={{ ...actionBtn, color: PALETTE.peach.deep }}
                    onClick={(e) => { e.stopPropagation(); if (onLive) onLive(f); }}
                    title={hasLinks ? 'Live με συνδέσεις' : 'Live'}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Live</span>
                  </button>
                  <button style={{ ...actionBtn, color: isCommentOpen ? '#fff' : PALETTE.peach.deep, background: isCommentOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setCommentOpen(isCommentOpen ? null : f.id); setInfoOpen(null); setQuestionsOpen(null); setLinksOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Σχόλια</span>
                  </button>
                  <button style={{ ...actionBtn, color: isLinksOpen ? '#fff' : PALETTE.peach.deep, background: isLinksOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setLinksOpen(isLinksOpen ? null : f.id); setInfoOpen(null); setCommentOpen(null); setQuestionsOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Σύνδεση</span>
                  </button>
                  {isTeacherRole && !isApp && <button style={{ ...actionBtn, color: isQuestionsOpen ? '#fff' : PALETTE.peach.deep, background: isQuestionsOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setQuestionsOpen(isQuestionsOpen ? null : f.id); setInfoOpen(null); setCommentOpen(null); setLinksOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Ερωτ./Απαντ.</span>
                  </button>}
                </div>

                {/* Σχόλια */}
                {isCommentOpen && (
                  <div style={{ marginTop:10 }}>
                    {canEdit ? (
                      <textarea value={f.comment || ''} onChange={(e) => { e.stopPropagation(); if (onComment) onComment(f.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()} placeholder="Σημειώσεις για το αρχείο…"
                        style={{ width:'100%', padding:'10px 12px', border:'1px solid '+PALETTE.peach.accent, borderRadius:12, fontSize:16, lineHeight:1.6, color:'#3d3a2e', background:'rgba(255,255,255,0.7)', resize:'none', fontFamily:'inherit', boxSizing:'border-box', minHeight:60, overflow:'hidden' }}
                        ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }} />
                    ) : (
                      <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:12, fontSize:13, color:'#5c3826', lineHeight:1.6, whiteSpace:'pre-wrap', border:'1px solid '+PALETTE.peach.accent }}>
                        {(f.comment||'').trim() || <span style={{ color:'#aeaeb8', fontStyle:'italic' }}>{compact ? 'Χωρίς σχόλια — πάτα ✏️ για επεξεργασία' : 'Χωρίς σχόλια — επεξεργασία από το modal (✏️)'}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Ερωτήσεις */}
                {isQuestionsOpen && (
                  <div style={{ marginTop:10, ...(compact ? {} : { padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:12, border:'1px solid '+PALETTE.cream.accent }) }} onClick={e => e.stopPropagation()}>
                    <QuestionsFields fileId={f.id} raw={f.questions} onChange={onQuestions} compact={compact} readOnly={!canEdit} />
                  </div>
                )}

                {/* Συνδέσεις */}
                {isLinksOpen && (
                  <div style={{ marginTop:10, maxWidth:'100%', overflow:'hidden' }} onClick={(e)=>e.stopPropagation()}>
                    {/* Υπάρχουσες συνδέσεις */}
                    {fLinks.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                        {fLinks.map((lnk, li) => (
                          <div key={li} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', background:'rgba(255,255,255,0.7)', borderRadius:10, border:'1px solid #e8e0c8', minWidth:0 }}>
                            <span style={{ fontSize:13, flexShrink:0 }}>{lnk.type==='url'?'🌐':'📄'}</span>
                            <span onClick={() => { if (lnk.type==='url') window.open(lnk.url,'_blank'); else if (onOpen) onOpen({ id:lnk.targetId, name:lnk.name }); }}
                              style={{ flex:1, fontSize:12, color:PALETTE.cream.deep, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'underline dotted', minWidth:0 }}>
                              {lnk.name}
                            </span>
                            <button onClick={() => { if (onRemoveLink) onRemoveLink(f.id, li); }}
                              style={{ background:'none', border:'none', color:'#c0a0a0', cursor:'pointer', fontSize:11, fontWeight:700, padding:'2px 4px', flexShrink:0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* URL — πάντα ορατό */}
                    <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Διεύθυνση URL</div>
                    <div style={{ display:'flex', flexDirection: compact?'column':'row', gap:6, marginBottom:12 }}>
                      <input value={mLinkUrl} onChange={(e)=>setMLinkUrl(e.target.value)}
                        onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); const u=mLinkUrl.trim(); if(u && onAddLink){ onAddLink(f.id, {type:'url', url: toPublicLink(u), name:mLinkName.trim()||u}); setMLinkUrl(''); setMLinkName(''); }}}}
                        placeholder="https://…" onClick={e=>e.stopPropagation()}
                        style={{ flex:compact?undefined:2, width:compact?'100%':undefined, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: compact?16:13, background:'#fff', boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={mLinkName} onChange={(e)=>setMLinkName(e.target.value)}
                          onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); const u=mLinkUrl.trim(); if(u && onAddLink){ onAddLink(f.id, {type:'url', url: toPublicLink(u), name:mLinkName.trim()||u}); setMLinkUrl(''); setMLinkName(''); }}}}
                          placeholder="Τίτλος…" onClick={e=>e.stopPropagation()}
                          style={{ flex:1, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: compact?16:13, background:'#fff', boxSizing:'border-box', minWidth:0 }} />
                        <button onClick={(e) => { e.stopPropagation(); const u=mLinkUrl.trim(); if (u && onAddLink) { onAddLink(f.id, { type:'url', url: toPublicLink(u), name:mLinkName.trim()||u }); setMLinkUrl(''); setMLinkName(''); } }}
                          style={{ ...btn('solid'), padding:'8px 14px', flexShrink:0, fontSize:13 }}>+</button>
                      </div>
                    </div>

                    {/* Γρήγορες επιλογές */}
                    <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Ιστότοποι</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                      {(suggestedUrls||SUGGESTED_URLS).filter(s => !fLinks.some(l=>l.url===s.url)).map((s) => (
                        <button key={s.url} onClick={() => { if (onAddLink) onAddLink(f.id, { type:'url', url:s.url, name:s.name }); }}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fafafa', cursor:'pointer', fontSize:11, fontWeight:500, color:'#333' }}>
                          + {s.name}
                        </button>
                      ))}
                    </div>

                    {/* Accordion φακέλων */}
                    <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Αρχεία & Εφαρμογές</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {(folders||[]).map((fld) => {
                        const cnt = (allFiles||[]).filter(x => x.folderId===fld.id && x.id!==f.id && !fLinks.some(l=>l.targetId===x.id)).length;
                        if (!cnt) return null;
                        const isOpen = pickerSection === fld.id;
                        return (
                          <button key={fld.id} onClick={() => setPickerSection(isOpen ? null : fld.id)}
                            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                              border:'2px solid '+(isOpen ? PALETTE.cream.deep : '#e0e0e0'),
                              background: isOpen ? PALETTE.cream.bgSoft : '#fafafa',
                              cursor:'pointer', fontSize:compact?12:13, fontWeight:600,
                              color: isOpen ? PALETTE.cream.deep : '#555' }}>
                            📁 {fld.name} <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                          </button>
                        );
                      })}
                      {(appFiles||[]).length > 0 && (() => {
                        const availApps = (appFiles||[]).filter(x => x.id!==f.id && !fLinks.some(l=>l.targetId===x.id));
                        if (!availApps.length) return null;
                        const isOpen = pickerSection === 'apps';
                        return (
                          <button key="apps" onClick={() => setPickerSection(isOpen ? null : 'apps')}
                            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
                              border:'2px solid '+(isOpen ? '#5c7a3a' : '#e0e0e0'),
                              background: isOpen ? '#f0f5eb' : '#fafafa',
                              cursor:'pointer', fontSize:compact?12:13, fontWeight:600,
                              color: isOpen ? '#5c7a3a' : '#555' }}>
                            ⚡ Εφαρμογές <span style={{ fontSize:10 }}>{isOpen?'▾':'▸'}</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Αρχεία ανοιχτού φακέλου ή εφαρμογές */}
                    {pickerSection && (()=> {
                      const fldFiles = pickerSection === 'apps'
                        ? (appFiles||[]).filter(x => x.id!==f.id && !fLinks.some(l=>l.targetId===x.id))
                        : (allFiles||[]).filter(x => x.folderId===pickerSection && x.id!==f.id && !fLinks.some(l=>l.targetId===x.id));
                      if (!fldFiles.length) return <div style={{ padding:10, color:'#aeaeb8', fontSize:12, textAlign:'center' }}>Κανένα αρχείο</div>;
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:6 }}>
                          {fldFiles.map((af) => (
                            <div key={af.id} onClick={() => { if (onAddLink) onAddLink(f.id, af._ghUrl ? { type:'url', url:af._ghUrl, name:af.name } : { type:'file', targetId:af.id, name:af.name }); }}
                              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.6)', border:'1px solid #e8e0c8' }}>
                              <span style={{ fontSize:14 }}>{pickerSection === 'apps' ? '⚡' : '📄'}</span>
                              <span style={{ flex:1, fontSize:12, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{af.name}</span>
                              <span style={{ fontSize:11, color:PALETTE.cream.deep, flexShrink:0 }}>+ Σύνδεση</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function btn(kind) {
  const base = { borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', padding:'8px 14px', border:'1.5px solid transparent' };
  if (kind === 'solid') return { ...base, background:PALETTE.cream.deep, color:'#fff' };
  if (kind === 'outline') return { ...base, background:'transparent', color:PALETTE.cream.deep, borderColor:PALETTE.cream.deep };
  if (kind === 'mini') return { ...base, padding:'5px 10px', fontSize:12, background:'transparent', color:PALETTE.cream.deep, border:'1.5px solid #e8dfc4' };
  return base;
}

const S = {
  loading:{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#1a1a1a', color:'#ececec', fontFamily:'"Söhne",ui-sans-serif,system-ui,-apple-system,sans-serif' },
  spinner:{ width:'36px', height:'36px', border:'2px solid rgba(255,255,255,0.12)', borderTop:'2px solid #c5b4e3', borderRadius:'50%', animation:'spin 0.9s linear infinite', marginBottom:'16px' },
  app:{ display:'flex', minHeight:'100vh', maxWidth:'100vw', overflowX:'hidden', background:'#f9f9f8', fontFamily:'ui-sans-serif,system-ui,-apple-system,sans-serif', color:'#1a1a1a' },
  sidebar:{ position:'fixed', left:0, top:0, bottom:0, background:'#1a1a1a', display:'flex', flexDirection:'column', transition:'width 0.2s ease', zIndex:100, borderRight:'1px solid rgba(255,255,255,0.06)' },
  sidebarHeader:{ padding:'16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  collapseBtn:{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#8e8ea0', width:28, height:28, borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  nav:{ flex:1, padding:8, overflowY:'auto' },
  navItem:{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'transparent', border:'none', borderRadius:8, color:'#8e8ea0', fontSize:13, cursor:'pointer', marginBottom:1, textAlign:'left' },
  navActive:{ background:'rgba(255,255,255,0.08)', color:'#ececec' },
  navIcon:{ flexShrink:0, width:18, display:'flex', alignItems:'center', justifyContent:'center' },
  navDiv:{ height:1, background:'rgba(255,255,255,0.06)', margin:'8px 4px' },
  sidebarFooter:{ padding:10, borderTop:'1px solid rgba(255,255,255,0.06)' },
  userCard:{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8 },
  userAvatar:{ width:30, height:30, borderRadius:'50%', background:'#c5b4e3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'#1a1a1a', flexShrink:0 },
  userInfo:{ flex:1, minWidth:0 },
  userName:{ fontSize:12, color:'#ececec', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  main:{ flex:1, transition:'margin-left 0.2s ease' },
  container:{ maxWidth:1280, margin:'0 auto', padding:'24px 16px' },
  welcomeTitle:{ fontSize:26, fontWeight:600, color:'#1a1a1a', margin:'0 0 6px 0', letterSpacing:'-0.01em' },
  welcomeSub:{ fontSize:14, color:'#6b6b80', lineHeight:1.5 },
  statsGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14, marginBottom:40 },
  statCard:{ borderRadius:22, padding:'22px 24px', border:'none', minHeight:140, transition:'transform 0.2s,box-shadow 0.2s' },
  statInner:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, height:'100%' },
  statLabel:{ fontSize:13, fontWeight:500, marginBottom:12 },
  statVal:{ fontSize:42, fontWeight:700, lineHeight:1, marginBottom:8, letterSpacing:'-0.02em' },
  statSub:{ fontSize:12, fontWeight:400, lineHeight:1.4 },
  statIcon:{ width:44, height:44, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  section:{ marginBottom:44 },
  secTitle:{ fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:18, letterSpacing:'-0.01em' },
  cardsGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18 },
  folderCard:{ borderRadius:22, padding:'22px 24px', border:'none', cursor:'pointer', minHeight:170, display:'flex', flexDirection:'column', transition:'transform 0.2s,box-shadow 0.2s' },
  folderTop:{ marginBottom:14, display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  folderIcon:{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' },
  folderTitle:{ fontSize:18, fontWeight:700, marginBottom:6, letterSpacing:'-0.015em' },
  folderDesc:{ fontSize:13, lineHeight:1.55, marginBottom:16, flex:1 },
  folderFoot:{ display:'flex', justifyContent:'flex-end', paddingTop:14, borderTop:'1px solid' },
  linkBtn:{ background:'transparent', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' },
  recentList:{ background:'#fff', borderRadius:16, border:'1px solid #ebebeb', overflow:'hidden' },
  recentItem:{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', cursor:'pointer', transition:'background 0.1s' },
  recentInfo:{ flex:1, minWidth:0 },
  recentTitle:{ fontSize:12, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  empty:{ textAlign:'center', padding:'40px 20px', color:'#aeaeb8', fontSize:13 },
  pageHeader:{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' },
  backBtn:{ background:'#fff', border:'1px solid #ebebeb', color:'#6b6b80', padding:'8px 16px', borderRadius:12, fontSize:13, cursor:'pointer' },
  pageTitle:{ fontSize:22, fontWeight:700, color:'#1a1a1a', letterSpacing:'-0.015em' },
  iconBtn:{ width:34, height:34, borderRadius:9, border:'1.5px solid #e0e0e0', background:'#f4f4f4', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' },
  closeBtn:{ width:34, height:34, borderRadius:9, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' },
  delBtn:{ width:30, height:30, borderRadius:8, border:'1.5px solid #e0d0d0', background:'transparent', color:'#c0a0a0', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  delBtnSm:{ width:26, height:26, borderRadius:7, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  cpLabel:{ fontSize:11, fontWeight:700, color:PALETTE.cream.deep, marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 },
  mobileAction:{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'6px 10px', color:PALETTE.peach.deep, fontSize:10, fontWeight:500, minWidth:50 },
  zoomBtn:{ background:'#1a1a1a', color:'#fff', border:'none', width:26, height:26, borderRadius:8, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
};
