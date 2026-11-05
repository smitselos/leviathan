// pages/creator.js — ΛΕΒΙΑΘΑΝ · Δημιουργός εφαρμογών
// ─────────────────────────────────────────────────────────────────────────────
// Ο εκπαιδευτικός διαλέγει πρότυπο (public/protypa/*.html), γράφει ερωτήσεις,
// βλέπει ζωντανή προεπισκόπηση και αποθηκεύει την ΕΤΟΙΜΗ εφαρμογή (αυτόνομο .html)
// σε φάκελο του ΛΕΒΙΑΘΑΝ στο Google Drive (ίδιο upload + /api/registry με το index.js).
//
// Τα δεδομένα μπαίνουν στο πρότυπο ανάμεσα στους δείκτες
//   /*QUIZ_DATA_START*/ … /*QUIZ_DATA_END*/
// και ξαναδιαβάζονται από εκεί → κάθε εφαρμογή ανοίγει ξανά για επεξεργασία
// (π.χ. προσθήκη νέας ενότητας = νέα κάρτα στην αρχική οθόνη της εφαρμογής).
//
// Νέο πρότυπο: αρχείο στο public/protypa + εγγραφή στο TEMPLATES παρακάτω.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';

const TEMPLATES = [
  {
    id: 'quiz-deck',
    name: 'Κουίζ ενοτήτων',
    file: '/protypa/quiz-deck.html',
    desc: 'Κάρτες-ενότητες στην αρχική οθόνη· ερωτήσεις μία-μία με άμεση ανατροφοδότηση, βαθμολογία και επανάληψη λαθών. Δουλεύει και με τα ζωντανά αποτελέσματα του Live.',
    types: ['Πολλαπλής επιλογής', 'Σωστό / Λάθος', 'Αντιστοίχιση', 'Συμπλήρωση κενών', 'Επιλογή λέξεων', 'Αναδιάταξη', 'Ταξινόμηση', 'Μικρό σταυρόλεξο'],
  },
  {
    id: 'quiz-paper-deck',
    look: 'paper',
    name: 'Κουίζ ενοτήτων · Χάρτινο',
    file: '/protypa/quiz-paper-deck.html',
    desc: 'Το απλό κουίζ ενοτήτων με λιτή, «χάρτινη» αισθητική: κρεμ φόντο, κλασική serif γραμματοσειρά, τερακότα τόνοι. Ίδιοι τύποι ερωτήσεων, εκτύπωση και Live.',
    types: ['Λιτό · κρεμ · serif', 'Όλοι οι τύποι του κουίζ', 'Εκτύπωση / PDF', 'Live'],
  },
  {
    id: 'quiz-archaia-deck',
    look: 'archaia',
    name: 'Κουίζ ενοτήτων · Αρχαίο',
    file: '/protypa/quiz-archaia-deck.html',
    desc: 'Το απλό κουίζ ενοτήτων με αρχαιοελληνική αισθητική: πάπυρος, λιτές κλασικές γραμμές, επιγραφικοί τίτλοι (GFS Didot) και χρώματα αγγειογραφίας. Ίδιοι τύποι ερωτήσεων, εκτύπωση και Live.',
    types: ['Πάπυρος · κλασικές γραμμές', 'Όλοι οι τύποι του κουίζ', 'Εκτύπωση / PDF', 'Live'],
  },
  {
    id: 'quiz-xlsx-deck',
    badge: 'xlsx',
    name: 'Κουίζ ενοτήτων · xlsx',
    file: '/protypa/quiz-xlsx-deck.html',
    desc: 'Το κουίζ ενοτήτων με εισαγωγή / εξαγωγή Excel: ανεβάζετε ένα xlsx και οι ερωτήσεις μπαίνουν αυτόματα στις ενότητες (δέχεται και τη μορφή των εφαρμογών ΜΗΤΣΕΛΟΣ). Επιπλέον: βαθμός δυσκολίας με φίλτρο για τον μαθητή και στην εκτύπωση, σχόλιο για κάθε επιλογή.',
    types: ['Εισαγωγή / εξαγωγή xlsx', 'Βαθμός δυσκολίας', 'Σχόλιο ανά επιλογή', 'Όλοι οι τύποι του κουίζ'],
  },
  {
    id: 'crossword-deck',
    kind: 'cw',
    name: 'Σταυρόλεξα ενοτήτων',
    file: '/protypa/crossword-deck.html',
    desc: 'Κάρτες-ενότητες στην αρχική οθόνη· κάθε ενότητα ανοίγει ένα σταυρόλεξο που στήνεται αυτόματα από τις λέξεις και τους ορισμούς σου. Έλεγχος, βοήθεια, λύση και εκτύπωση / PDF.',
    types: ['Λέξεις & ορισμοί', 'Αυτόματο πλέγμα', 'Έλεγχος · Βοήθεια · Λύση', 'Εκτύπωση / PDF'],
  },
  {
    id: 'paragraph-deck',
    kind: 'para',
    name: 'Αναδιάταξη παραγράφων',
    file: '/protypa/paragraph-deck.html',
    desc: 'Κάρτες-ενότητες στην αρχική οθόνη· σε κάθε παράγραφο οι περίοδοι εμφανίζονται ανακατεμένες και ο μαθητής τις βάζει στη σωστή σειρά (σύρσιμο ή βελάκια). Έλεγχος, λύση, σχόλιο, βαθμολογία και φύλλο εργασίας / PDF.',
    types: ['Περίοδοι με τη σωστή σειρά', 'Σύρσιμο ή βελάκια', 'Σχόλιο λύσης', 'Εκτύπωση / PDF'],
  },
  {
    id: 'sort-deck',
    kind: 'sort',
    name: 'Ταξινόμηση σε κατηγορίες',
    file: '/protypa/sort-deck.html',
    desc: 'Κάρτες-ενότητες στην αρχική οθόνη· σε κάθε άσκηση τα στοιχεία εμφανίζονται ανακατεμένα και ο μαθητής τα βάζει στη σωστή κατηγορία (σύρσιμο ή πάτημα). Έλεγχος, λύση, σχόλιο, βαθμολογία και φύλλο εργασίας / PDF.',
    types: ['2–5 κατηγορίες', 'Σύρσιμο ή πάτημα', 'Σχόλιο λύσης', 'Εκτύπωση / PDF'],
  },
];
const tplOf = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
const isCwData = (d) => d && d.template === 'crossword-deck';
const isParaData = (d) => d && d.template === 'paragraph-deck';
const isSortData = (d) => d && d.template === 'sort-deck';
const QUIZ_LIKE = ['quiz-xlsx-deck', 'quiz-paper-deck', 'quiz-archaia-deck'];
const tplIdOfData = (d) => (isCwData(d) ? 'crossword-deck' : isParaData(d) ? 'paragraph-deck' : isSortData(d) ? 'sort-deck' : d && QUIZ_LIKE.includes(d.template) ? d.template : 'quiz-deck');

const C = {
  purple: '#6B3FA0', purpleDark: '#4A2D6F', purpleLight: '#8B6BB5', navy: '#1B2A4A', cyan: '#4AAFC7',
  coral: '#E8735A', gold: '#E8B84B', cream: '#FAFAF7', ink: '#1a1610', muted: '#7a7060',
  ok: '#2d8e4e', bad: '#c44a3d', line: 'rgba(107,63,160,.16)',
};
const TYPES = [
  { t: 'mcq', icon: '●', label: 'Πολλαπλής επιλογής' },
  { t: 'tf', icon: '◐', label: 'Σωστό / Λάθος' },
  { t: 'drag', icon: '⇄', label: 'Αντιστοίχιση' },
  { t: 'gap', icon: '▭', label: 'Συμπλήρωση κενών' },
  { t: 'click', icon: '☝', label: 'Επιλογή λέξεων' },
  { t: 'order', icon: '⇅', label: 'Αναδιάταξη παραγράφου' },
  { t: 'sort', icon: '▤', label: 'Ταξινόμηση σε κατηγορίες' },
  { t: 'cw', icon: '✎', label: 'Μικρό σταυρόλεξο' },
];
const typeOf = (t) => TYPES.find((x) => x.t === t) || TYPES[0];
const LABS = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ'];
const DRAFT_KEY = 'lev-creator-draft';
const MARK_RE = /\/\*QUIZ_DATA_START\*\/([\s\S]*?)\/\*QUIZ_DATA_END\*\//;

// ── Μοντέλο ─────────────────────────────────────────────────────
function newQuestion(t, keep = {}) {
  const base = { t, q: keep.q || '', ref: keep.ref || '', fbC: keep.fbC || '', fbW: keep.fbW || '' };
  if (t === 'mcq') return { ...base, opts: ['', '', '', ''], ans: 0 };
  if (t === 'tf') return { ...base, labels: ['Σωστό', 'Λάθος'], ans: 0 };
  if (t === 'drag') return { ...base, q: base.q || 'Αντιστοίχισε.', tgts: ['', '', ''], items: ['', '', ''], ans: [0, 1, 2] };
  if (t === 'gap') return { ...base, q: base.q || 'Συμπλήρωσε τα κενά.', text: '', mode: 'type', distractors: [], strict: false };
  if (t === 'order') return { ...base, q: base.q || 'Βάλε τις περιόδους στη σωστή σειρά, ώστε να σχηματιστεί συνεκτική παράγραφος.', lines: ['', '', ''], fixFirst: false };
  if (t === 'sort') return { ...base, q: base.q || 'Ταξινόμησε τα στοιχεία στις σωστές κατηγορίες.', cats: [{ name: '', items: [''] }, { name: '', items: [''] }] };
  if (t === 'cw') return { ...base, q: base.q || 'Λύσε το σταυρόλεξο.', words: [{ w: '', c: '' }, { w: '', c: '' }, { w: '', c: '' }], seed: 1 };
  return { ...base, q: base.q || 'Επίλεξε…', text: '' };
}
function newDeck(n) { return { label: 'Ενότητα ' + n, ktitle: '', author: '', sub: '', qs: [newQuestion('mcq')] }; }
function newQuiz(credits, tid) {
  return { v: 1, template: tid || 'quiz-deck', title: '', eyebrow: 'Κουίζ αυτοαξιολόγησης', heading: '', subtitle: 'Διάλεξε ενότητα και ξεκίνα. Κάθε ερώτηση εμφανίζεται ξεχωριστά.', credits: credits || '', year: new Date().getFullYear(), shuffleOpts: false, shuffleQs: false, decks: [newDeck(1)] };
}
// ── Σταυρόλεξο: ενότητα = { label, ktitle, author, sub, seed, words:[{w,c}] } ──
const newWord = () => ({ w: '', c: '' });
function newCwDeck(n) { return { label: 'Ενότητα ' + n, ktitle: '', author: '', sub: '', seed: 1, words: [newWord(), newWord(), newWord()] }; }
function newCw(credits) {
  return { v: 1, template: 'crossword-deck', title: '', eyebrow: 'Σταυρόλεξο', heading: '', subtitle: 'Διάλεξε ενότητα και λύσε το σταυρόλεξο. Πάτησε ένα τετράγωνο και γράψε.', credits: credits || '', year: new Date().getFullYear(), decks: [newCwDeck(1)] };
}
function normalizeCw(d) {
  const out = { ...newCw(''), ...d };
  out.decks = (d.decks || []).map((dk) => ({ label: '', ktitle: '', author: '', sub: '', seed: 1, ...dk, words: (dk.words || []).map((x) => ({ w: x.w || '', c: x.c || '' })) }));
  if (!out.decks.length) out.decks = [newCwDeck(1)];
  return out;
}
const cwNorm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z\u0391-\u03A90-9]/g, '');
function problemsOfCw(dk) {
  const p = [];
  const rows = (dk.words || []).filter((x) => String(x.w).trim() || String(x.c).trim());
  rows.forEach((x) => {
    if (String(x.w).trim() && !String(x.c).trim()) p.push(`Η λέξη «${x.w}» δεν έχει ορισμό.`);
    if (!String(x.w).trim() && String(x.c).trim()) p.push(`Ορισμός χωρίς λέξη: «${String(x.c).slice(0, 40)}».`);
    if (String(x.w).trim() && cwNorm(x.w).length < 2) p.push(`Η λέξη «${x.w}» είναι πολύ μικρή (τουλάχιστον 2 γράμματα).`);
  });
  const seen = new Set();
  rows.forEach((x) => { const a = cwNorm(x.w); if (a && seen.has(a)) p.push(`Η λέξη «${x.w}» υπάρχει δύο φορές.`); seen.add(a); });
  if (rows.filter((x) => cwNorm(x.w).length >= 2).length < 3) p.push('Χρειάζονται τουλάχιστον 3 λέξεις.');
  return p;
}
// ── Αναδιάταξη: ενότητα = { label, ktitle, author, sub, ps:[{ title, src, lines:[σωστή σειρά], fixFirst, fb }] } ──
const newParaItem = () => ({ title: '', src: '', lines: ['', '', ''], fixFirst: false, fb: '' });
function newParaDeck(n) { return { label: 'Ενότητα ' + n, ktitle: '', author: '', sub: '', ps: [newParaItem()] }; }
function newPara(credits) {
  return { v: 1, template: 'paragraph-deck', title: '', eyebrow: 'Αναδιάταξη παραγράφου', heading: '', subtitle: 'Διάλεξε ενότητα. Βάλε τις περιόδους κάθε παραγράφου στη σωστή σειρά και πάτησε «Έλεγχος».', credits: credits || '', year: new Date().getFullYear(), decks: [newParaDeck(1)] };
}
function normalizePara(d) {
  const out = { ...newPara(''), ...d };
  out.decks = (d.decks || []).map((dk) => ({ label: '', ktitle: '', author: '', sub: '', ...dk, ps: (dk.ps || []).map((x) => ({ ...newParaItem(), ...x, lines: Array.isArray(x.lines) && x.lines.length ? x.lines : ['', '', ''] })) }));
  out.decks.forEach((dk) => { if (!dk.ps.length) dk.ps = [newParaItem()]; });
  if (!out.decks.length) out.decks = [newParaDeck(1)];
  return out;
}
const paraLines = (x) => (x.lines || []).map((l) => String(l).trim()).filter(Boolean);
function problemsOfPara(x) {
  const p = [];
  const n = paraLines(x).length;
  if (n < 3) p.push(`Χρειάζονται τουλάχιστον 3 περίοδοι (τώρα ${n}).`);
  if (n > 15) p.push('Πάνω από 15 περίοδοι — χώρισέ τη σε δύο παραγράφους.');
  return p;
}
// Χωρισμός κειμένου σε περιόδους (τελεία, ερωτηματικό «;», θαυμαστικό, αποσιωπητικά)
function splitSentences(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
    .replace(/([.;!…])\s+(?=[«"(\[]?[Α-ΩΆ-ΏA-Z0-9])/g, '$1\u0001') // χωρίς lookbehind (συμβατό με παλαιότερο Safari)
    .split('\u0001').map((x) => x.trim()).filter(Boolean);
}
// ── Ταξινόμηση: ενότητα = { label, ktitle, author, sub, ps:[{ title, src, cats:[{ name, items:[] }], fb }] } ──
const newSortItem = () => ({ title: '', src: '', cats: [{ name: '', items: [''] }, { name: '', items: [''] }], fb: '' });
function newSortDeck(n) { return { label: 'Ενότητα ' + n, ktitle: '', author: '', sub: '', ps: [newSortItem()] }; }
function newSort(credits) {
  return { v: 1, template: 'sort-deck', title: '', eyebrow: 'Ταξινόμηση σε κατηγορίες', heading: '', subtitle: 'Διάλεξε ενότητα. Βάλε κάθε στοιχείο στη σωστή κατηγορία και πάτησε «Έλεγχος».', credits: credits || '', year: new Date().getFullYear(), decks: [newSortDeck(1)] };
}
function normalizeSort(d) {
  const out = { ...newSort(''), ...d };
  out.decks = (d.decks || []).map((dk) => ({ label: '', ktitle: '', author: '', sub: '', ...dk, ps: (dk.ps || []).map((x) => ({ ...newSortItem(), ...x, cats: Array.isArray(x.cats) && x.cats.length ? x.cats.map((c) => ({ name: c.name || '', items: Array.isArray(c.items) && c.items.length ? c.items : [''] })) : newSortItem().cats })) }));
  out.decks.forEach((dk) => { if (!dk.ps.length) dk.ps = [newSortItem()]; });
  if (!out.decks.length) out.decks = [newSortDeck(1)];
  return out;
}
const sortCats = (x) => (x.cats || []).map((c) => ({ name: String(c.name || '').trim(), items: (c.items || []).map((v) => String(v).trim()).filter(Boolean) })).filter((c) => c.name || c.items.length);
const sortCount = (x) => sortCats(x).reduce((s, c) => s + c.items.length, 0);
function problemsOfSort(x) {
  const p = [];
  const cs = sortCats(x);
  if (cs.length < 2) p.push('Χρειάζονται τουλάχιστον 2 κατηγορίες.');
  if (cs.some((c) => !c.name)) p.push('Υπάρχει κατηγορία χωρίς όνομα.');
  if (cs.some((c) => !c.items.length)) p.push('Υπάρχει κατηγορία χωρίς στοιχεία.');
  if (sortCount(x) > 30) p.push('Πάνω από 30 στοιχεία — χώρισέ τα σε δύο ασκήσεις.');
  return p;
}
// Χρονολογία δημιουργίας (για το «© ΛΕΒΙΑΘΑΝ 2026 · όνομα»): αποθηκευμένη ή από την παλιά υπογραφή
const yearOf = (d) => Number(d.year) || Number((String(d.credits || '').match(/\b(19|20)\d{2}\b/) || [])[0]) || new Date().getFullYear();
const normalizeData = (d) => ({ ...normalizeAny(d), year: yearOf(d) });
const normalizeAny = (d) => (isCwData(d) ? normalizeCw(d) : isParaData(d) ? normalizePara(d) : isSortData(d) ? normalizeSort(d) : normalizeQuiz(d));

// Αντιστοίχιση: στον Δημιουργό κρατάμε ζεύγη (tgts[i] ↔ items[i]) → ans = ταυτοτική
function normalizeQuiz(d) {
  const out = { ...newQuiz(''), ...d };
  out.decks = (d.decks || []).map((dk) => ({
    label: '', ktitle: '', author: '', sub: '', ...dk,
    qs: (dk.qs || []).map((q) => {
      if (q.t === 'drag' && Array.isArray(q.tgts)) {
        const ans = Array.isArray(q.ans) ? q.ans : q.tgts.map((_, i) => i);
        const items = q.tgts.map((_, i) => (q.items || [])[ans[i]] ?? '');
        return { ...newQuestion('drag'), ...q, items, ans: q.tgts.map((_, i) => i) };
      }
      return { ...newQuestion(q.t || 'mcq'), ...q };
    }),
  }));
  if (!out.decks.length) out.decks = [newDeck(1)];
  return out;
}
// Καθαρή μορφή για το αρχείο (χωρίς κενές επιλογές/παραπλανητικές)
function cleanForExport(d) {
  if (isCwData(d)) return { ...d, decks: d.decks.map((dk) => ({ ...dk, words: dk.words.map((x) => ({ w: String(x.w).trim(), c: String(x.c).trim() })).filter((x) => x.w || x.c) })) };
  if (isParaData(d)) return { ...d, decks: d.decks.map((dk) => ({ ...dk, ps: dk.ps.map((x) => ({ ...x, lines: paraLines(x) })) })) };
  if (isSortData(d)) return { ...d, decks: d.decks.map((dk) => ({ ...dk, ps: dk.ps.map((x) => ({ ...x, cats: sortCats(x) })) })) };
  return {
    ...d,
    decks: d.decks.map((dk) => ({
      ...dk,
      qs: dk.qs.map((q) => {
        if (q.t === 'drag') return { ...q, ans: q.tgts.map((_, i) => i) };
        if (q.t === 'mcq' && Array.isArray(q.fbs)) { const fbs = q.opts.map((_, k) => String(q.fbs[k] || '').trim()); const { fbs: _f, ...rest } = q; return fbs.some(Boolean) ? { ...rest, fbs } : rest; }
        if (q.t === 'gap') return { ...q, distractors: (q.distractors || []).map((s) => s.trim()).filter(Boolean) };
        if (q.t === 'order') return { ...q, lines: (q.lines || []).map((l) => String(l).trim()).filter(Boolean) };
        if (q.t === 'sort') return { ...q, cats: (q.cats || []).map((c) => ({ name: String(c.name || '').trim(), items: (c.items || []).map((x) => String(x).trim()).filter(Boolean) })).filter((c) => c.name || c.items.length) };
        if (q.t === 'cw') return { ...q, words: (q.words || []).map((x) => ({ w: String(x.w || '').trim(), c: String(x.c || '').trim() })).filter((x) => x.w || x.c) };
        return q;
      }),
    })),
  };
}
const marked = (text) => { const p = String(text || '').split(/\[([^\]]+)\]/); const r = []; for (let i = 1; i < p.length; i += 2) r.push(p[i]); return r; };

function problemsOf(q) {
  const p = [];
  if (!String(q.q || '').trim()) p.push('Λείπει η εκφώνηση.');
  if (q.t === 'mcq') {
    if ((q.opts || []).length < 2) p.push('Χρειάζονται τουλάχιστον 2 επιλογές.');
    if ((q.opts || []).some((o) => !String(o).trim())) p.push('Υπάρχει κενή επιλογή.');
  }
  if (q.t === 'drag') {
    if ((q.tgts || []).length < 2) p.push('Χρειάζονται τουλάχιστον 2 ζεύγη.');
    if ((q.tgts || []).some((x, i) => !String(x).trim() || !String(q.items[i] || '').trim())) p.push('Υπάρχει ζεύγος με κενό πεδίο.');
  }
  if (q.t === 'gap' && !marked(q.text).length) p.push('Δεν υπάρχει κενό: βάλτε τη σωστή λέξη σε [αγκύλες].');
  if (q.t === 'click') {
    if (!marked(q.text).length) p.push('Δεν υπάρχει σωστή λέξη: βάλτε τη σε [αγκύλες].');
  }
  if (q.t === 'order') {
    const n = (q.lines || []).filter((l) => String(l).trim()).length;
    if (n < 3) p.push(`Χρειάζονται τουλάχιστον 3 περίοδοι (τώρα ${n}).`);
    if (n > 10) p.push('Πάνω από 10 περίοδοι — μέσα στο κουίζ προτείνονται έως 8.');
  }
  if (q.t === 'sort') {
    const cs = (q.cats || []).filter((c) => String(c.name || '').trim() || (c.items || []).some((x) => String(x).trim()));
    if (cs.length < 2) p.push('Χρειάζονται τουλάχιστον 2 κατηγορίες.');
    if (cs.some((c) => !String(c.name || '').trim())) p.push('Υπάρχει κατηγορία χωρίς όνομα.');
    if (cs.some((c) => !(c.items || []).some((x) => String(x).trim()))) p.push('Υπάρχει κατηγορία χωρίς στοιχεία.');
  }
  if (q.t === 'cw') {
    const ws = (q.words || []).filter((x) => String(x.w || '').trim() || String(x.c || '').trim());
    if (ws.filter((x) => cwNorm(x.w).length >= 2).length < 3) p.push('Χρειάζονται τουλάχιστον 3 λέξεις.');
    if (ws.some((x) => String(x.w || '').trim() && !String(x.c || '').trim())) p.push('Υπάρχει λέξη χωρίς ορισμό.');
    if (ws.some((x) => !String(x.w || '').trim() && String(x.c || '').trim())) p.push('Υπάρχει ορισμός χωρίς λέξη.');
  }
  return p;
}

// ═════════════════════════════════════════════════════════════════
// Excel (xlsx) — εξαγωγή / εισαγωγή ερωτήσεων του προτύπου κουίζ
// Μία γραμμή ανά ερώτηση· οι τύποι με λίστα (αντιστοίχιση, αναδιάταξη,
// ταξινόμηση, σταυρόλεξο) πιάνουν διαδοχικές γραμμές με τον ίδιο Α/Α.
// ═════════════════════════════════════════════════════════════════
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxP = null;
const loadXlsx = () => xlsxP || (xlsxP = new Promise((res, rej) => {
  if (window.XLSX) return res(window.XLSX);
  const s = document.createElement('script'); s.src = XLSX_URL; s.async = true;
  s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error('no XLSX')));
  s.onerror = () => { xlsxP = null; rej(new Error('Δεν φορτώθηκε η βιβλιοθήκη Excel (ελέγξτε τη σύνδεση).')); };
  document.head.appendChild(s);
}));
const XL_COLS = ['Ενότητα', 'Α/Α', 'Τύπος', 'Εκφώνηση', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ', 'Σωστή', 'Κείμενο', 'Ρύθμιση', 'Σχόλιο σωστού', 'Σχόλιο λάθους', 'Παραπομπή', 'Δυσκολία', 'Σχόλιο Α', 'Σχόλιο Β', 'Σχόλιο Γ', 'Σχόλιο Δ', 'Σχόλιο Ε', 'Σχόλιο ΣΤ'];
const XL_OPT = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ'];
const XL_TYPE = { mcq: 'Πολλαπλής επιλογής', tf: 'Σωστό/Λάθος', drag: 'Αντιστοίχιση', gap: 'Συμπλήρωση κενών', click: 'Επιλογή λέξεων', order: 'Αναδιάταξη', sort: 'Ταξινόμηση', cw: 'Σταυρόλεξο' };
const XL_MULTI = ['drag', 'order', 'sort', 'cw'];
const xlN = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();
function xlType(s) {
  const x = xlN(s); if (!x) return '';
  if (XL_TYPE[x]) return x;
  const rules = [['mcq', /^πολλαπλ|^πολ\.|^mcq/], ['tf', /^σωστο|^σ\/λ|^tf/], ['drag', /^αντιστοιχ|^drag/], ['gap', /^συμπληρ|^κεν|^gap/], ['click', /^επιλογη λεξ|^υπογραμ|^click/], ['order', /^αναδιατ|^σειρα|^order/], ['sort', /^ταξινομ|^κατηγορ|^sort/], ['cw', /^σταυρολ|^cw/]];
  const r = rules.find(([, re]) => re.test(x)); return r ? r[0] : '?';
}
const xlSettings = (s) => xlN(s).split(/[,;·]/).map((x) => x.trim()).filter(Boolean);

function quizToSheets(data) {
  const rows = [XL_COLS];
  const base = (dk, n, q) => ({ 'Ενότητα': dk.label || '', 'Α/Α': n, 'Τύπος': XL_TYPE[q.t] || q.t, 'Εκφώνηση': q.q || '', 'Σχόλιο σωστού': q.fbC || '', 'Σχόλιο λάθους': q.fbW || '', 'Παραπομπή': q.ref || '', 'Δυσκολία': +q.diff || '' });
  const push = (o) => rows.push(XL_COLS.map((c) => (o[c] == null ? '' : o[c])));
  data.decks.forEach((dk) => (dk.qs || []).forEach((q, i) => {
    const n = i + 1, b = base(dk, n, q), cont = { 'Ενότητα': dk.label || '', 'Α/Α': n };
    if (q.t === 'mcq') { const o = { ...b, 'Σωστή': LABS[q.ans] || '' }; (q.opts || []).slice(0, 6).forEach((t, k) => { o[XL_OPT[k]] = t; o['Σχόλιο ' + XL_OPT[k]] = (q.fbs || [])[k] || ''; }); push(o); }
    else if (q.t === 'tf') { const L = q.labels || ['Σωστό', 'Λάθος']; push({ ...b, 'Α': L[0], 'Β': L[1], 'Σωστή': L[q.ans | 0] }); }
    else if (q.t === 'gap') { const o = { ...b, 'Κείμενο': q.text || '', 'Ρύθμιση': [q.mode === 'select' ? 'λίστα' : '', q.strict ? 'αυστηρά' : ''].filter(Boolean).join(', ') }; (q.distractors || []).filter((x) => String(x).trim()).slice(0, 6).forEach((t, k) => { o[XL_OPT[k]] = t; }); push(o); }
    else if (q.t === 'click') push({ ...b, 'Κείμενο': q.text || '' });
    else if (q.t === 'drag') (q.tgts || []).forEach((t, k) => push({ ...(k ? cont : b), 'Α': t, 'Β': (q.items || [])[Array.isArray(q.ans) ? q.ans[k] : k] ?? '' }));
    else if (q.t === 'order') (q.lines || []).filter((l) => String(l).trim()).forEach((l, k) => push({ ...(k ? cont : { ...b, 'Ρύθμιση': q.fixFirst ? 'σταθερή 1η' : '' }), 'Α': l }));
    else if (q.t === 'sort') { let k = 0; (q.cats || []).forEach((c) => (c.items || []).filter((x) => String(x).trim()).forEach((it) => { push({ ...(k ? cont : b), 'Α': c.name, 'Β': it }); k++; })); if (!k) push(b); }
    else if (q.t === 'cw') (q.words || []).filter((x) => String(x.w || '').trim()).forEach((x, k) => push({ ...(k ? cont : { ...b, 'Ρύθμιση': (q.seed | 0) > 1 ? 'διάταξη ' + q.seed : '' }), 'Α': x.w, 'Β': x.c }));
    else push(b);
  }));
  const decks = [['Ενότητα', 'Τίτλος', 'Συγγραφέας', 'Θεματικοί άξονες']].concat(data.decks.map((d) => [d.label || '', d.ktitle || '', d.author || '', d.sub || '']));
  const gen = [['Ρύθμιση', 'Τιμή'], ['Τίτλος εφαρμογής', data.title || ''], ['Μικρή επικεφαλίδα', data.eyebrow || ''], ['Μεγάλος τίτλος', data.heading || ''], ['Υπότιτλος', data.subtitle || ''], ['Όνομα δημιουργού', data.credits || ''], ['Χρονολογία', data.year || ''], ['Ανακάτεμα ερωτήσεων', data.shuffleQs ? 'ναι' : 'όχι'], ['Ανακάτεμα επιλογών', data.shuffleOpts ? 'ναι' : 'όχι']];
  const help = [['Οδηγίες συμπλήρωσης (φύλλο «Ερωτήσεις»)'], [''],
    ['Κάθε ερώτηση έχει Ενότητα και Α/Α. Οι ενότητες εμφανίζονται με τη σειρά που γράφονται.'],
    ['Πολλαπλής επιλογής: επιλογές στις στήλες Α–ΣΤ· «Σωστή» = το γράμμα (π.χ. Β).'],
    ['Σωστό/Λάθος: «Σωστή» = Σωστό ή Λάθος (στις Α/Β μπορείτε να αλλάξετε τις λέξεις, π.χ. Ναι/Όχι).'],
    ['Συμπλήρωση κενών: «Κείμενο» με τις σωστές λέξεις σε [αγκύλες], π.χ. «Ο [ήλιος] λάμπει». Εναλλακτικές σωστές: [ήλιος|Ήλιος].'],
    ['   «Ρύθμιση» = λίστα → ο μαθητής διαλέγει από λίστα· οι στήλες Α–ΣΤ δίνουν παραπλανητικές λέξεις. «αυστηρά» = μετρούν οι τόνοι.'],
    ['Επιλογή λέξεων: «Κείμενο» με τις σωστές λέξεις σε [αγκύλες]· ο μαθητής τις πατά.'],
    ['Τύποι με λίστα — μία γραμμή ανά στοιχείο, με τον ΙΔΙΟ Α/Α (Τύπος και Εκφώνηση μόνο στην 1η γραμμή):'],
    ['   Αντιστοίχιση: Α = στοιχείο αριστερής στήλης, Β = το σωστό ταίρι του.'],
    ['   Αναδιάταξη: Α = περίοδος, με τη ΣΩΣΤΗ σειρά. «Ρύθμιση» = σταθερή 1η → η 1η μένει στη θέση της.'],
    ['   Ταξινόμηση: Α = κατηγορία, Β = στοιχείο της (μία γραμμή για κάθε στοιχείο).'],
    ['   Σταυρόλεξο: Α = λέξη, Β = ορισμός. Το πλέγμα στήνεται αυτόματα. «Ρύθμιση» = διάταξη 2, 3… για άλλη τοποθέτηση.'],
    ['Προαιρετικά: Σχόλιο σωστού, Σχόλιο λάθους, Παραπομπή (π.χ. θεωρία), Δυσκολία (1–5).'],
    ['Πολλαπλής επιλογής: «Σχόλιο Α»–«Σχόλιο ΣΤ» = σχόλιο που εμφανίζεται όταν ο μαθητής διαλέξει τη συγκεκριμένη επιλογή.'],
    ['Δέχεται επίσης αρχεία με τη μορφή των εφαρμογών ΜΗΤΣΕΛΟΣ (στήλες ID, Κατηγορία, Δυσκολία, Τύπος YN/MC/DD/CLK/GAP/ORD/SORT, Απόσπασμα, Κείμενο Ερώτησης…).'],
    ['   ORD: περίοδοι με τη σωστή σειρά στο «Απόσπασμα», χωρισμένες με «|» (Σωστή Απάντηση = σταθερή 1η, προαιρετικά).'],
    ['   SORT: Αριστερά 1–4 = κατηγορίες· Δεξιά 1–4 = τα στοιχεία της αντίστοιχης κατηγορίας, χωρισμένα με «|».'],
    ['Φύλλο «Ενότητες»: τίτλος, συγγραφέας, άξονες κάθε κάρτας. Φύλλο «Γενικά»: η αρχική οθόνη.']];
  return { rows, decks, gen, help };
}
async function exportQuizXlsx(data, fileName) {
  const X = await loadXlsx();
  const { rows, decks, gen, help } = quizToSheets(data);
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet(rows);
  ws['!cols'] = [14, 5, 18, 40, 22, 22, 22, 22, 18, 18, 10, 50, 14, 24, 24, 16, 9, 24, 24, 24, 24, 20, 20].map((w) => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  X.utils.book_append_sheet(wb, ws, 'Ερωτήσεις');
  const wd = X.utils.aoa_to_sheet(decks); wd['!cols'] = [16, 34, 22, 34].map((w) => ({ wch: w })); X.utils.book_append_sheet(wb, wd, 'Ενότητες');
  const wg = X.utils.aoa_to_sheet(gen); wg['!cols'] = [{ wch: 22 }, { wch: 60 }]; X.utils.book_append_sheet(wb, wg, 'Γενικά');
  const wh = X.utils.aoa_to_sheet(help); wh['!cols'] = [{ wch: 120 }]; X.utils.book_append_sheet(wb, wh, 'Οδηγίες');
  const name = (String(fileName || 'kouiz').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'kouiz') + '.xlsx';
  const blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Ένα παράδειγμα από κάθε τύπο — για «Υπόδειγμα Excel»
function sampleQuizData(credits) {
  const d = newQuiz(credits, 'quiz-xlsx-deck'); d.title = 'Κουίζ από Excel'; d.heading = 'Κουίζ από *Excel*';
  d.decks = [{ label: 'Ενότητα 1', ktitle: 'Παραδείγματα τύπων', author: '', sub: 'Ένα παράδειγμα από κάθε τύπο', qs: [
    { ...newQuestion('mcq'), q: 'Ποια έγκλιση εκφράζει εντολή;', opts: ['Οριστική', 'Προστακτική', 'Υποτακτική', ''], ans: 1 },
    { ...newQuestion('tf'), q: 'Η παθητική σύνταξη αποσιωπά συχνά τον δράστη.', ans: 0 },
    { ...newQuestion('drag'), tgts: ['Μεταφορά', 'Παρομοίωση', 'Υπερβολή'], items: ['«μύγα ενοχλητική»', '«σαν μύγα»', '«χίλιες φορές»'], ans: [0, 1, 2] },
    { ...newQuestion('gap'), text: 'Η ονοματοποίηση κάνει τον λόγο πιο [πυκνό] και [απρόσωπο].', mode: 'select', distractors: ['ζωντανό'] },
    { ...newQuestion('click'), q: 'Επίλεξε τα ρήματα.', text: 'Ο Θανάσης [έπαιζε] κάθε βράδυ και [ξεχνούσε] τον χρόνο.' },
    { ...newQuestion('order'), lines: ['Ο αθλητισμός ωφελεί τον άνθρωπο.', 'Αρχικά, ενισχύει την υγεία.', 'Επιπλέον, μειώνει το άγχος.', 'Συνεπώς, αξίζει να γίνει συνήθεια.'], fixFirst: true },
    { ...newQuestion('sort'), cats: [{ name: 'Αιτιολογικές', items: ['επειδή έβρεχε', 'αφού το ήθελες'] }, { name: 'Τελικές', items: ['για να μάθει', 'να τον δει'] }] },
    { ...newQuestion('cw'), words: [{ w: 'μεταφορά', c: 'Σχήμα λόγου με μεταφορά σημασίας' }, { w: 'παρομοίωση', c: 'Σύγκριση με το «σαν»' }, { w: 'ασύνδετο', c: 'Παράθεση χωρίς συνδέσμους' }, { w: 'αντίθεση', c: 'Αντιπαράθεση εννοιών' }] },
  ] }];
  return d;
}
// Μορφή εφαρμογών ΜΗΤΣΕΛΟΣ: ID | Ενεργό | Κατηγορία | Δυσκολία | Τύπος (YN/MC/DD/CLK/GAP) | Απόσπασμα |
// Κείμενο Ερώτησης | Επιλογή Α–Δ | Σωστή Απάντηση | Αριστερά 1–4 | Δεξιά 1–4 | Λέξη-Στόχος | Διόρθωση 1–4 | Θεωρία
const stripTags = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').trim();
function mitselosRows(all, hi, col, getDeck, warnings) {
  const T = { yn: 'tf', mc: 'mcq', dd: 'drag', clk: 'click', gap: 'gap', ord: 'order', sort: 'sort' };
  all.slice(hi + 1).forEach((r, ri) => {
    if (!r.some((c) => c)) return;
    const line = hi + ri + 2, id = col(r, 'ID') || ('γρ. ' + line);
    if (/^(false|0|οχι|ψευδεσ|no)$/.test(xlN(col(r, 'Ενεργό')))) return;
    const raw = col(r, 'Τύπος'), t = T[xlN(raw)] || xlType(raw);
    if (!t || t === '?') { warnings.push(`${id}: άγνωστος τύπος «${raw || '—'}» — παραλείφθηκε.`); return; }
    const cat = col(r, 'Κατηγορία'), deck = getDeck(cat ? (/^[\d.]+$/.test(cat) ? 'Ενότητα ' + cat : cat) : '');
    const exc = stripTags(col(r, 'Απόσπασμα')), qt = stripTags(col(r, 'Κείμενο Ερώτησης'));
    const withExc = (x) => (exc ? `*${exc.replace(/\*/g, '')}*\n\n` : '') + x;
    const fixes = [1, 2, 3, 4].map((i) => stripTags(col(r, 'Διόρθωση ' + i)));
    const L = (s) => ['α', 'β', 'γ', 'δ', 'ε', 'στ'].indexOf(xlN(s));
    let q = null;
    if (t === 'tf') {
      q = { ...newQuestion('tf'), q: withExc(qt), labels: [col(r, 'Επιλογή Α') || 'Ναι', col(r, 'Επιλογή Β') || 'Όχι'], ans: L(col(r, 'Σωστή Απάντηση')) === 1 ? 1 : 0 };
    } else if (t === 'mcq') {
      const o = ['Α', 'Β', 'Γ', 'Δ'].map((k) => stripTags(col(r, 'Επιλογή ' + k))); while (o.length > 2 && !o[o.length - 1]) o.pop();
      let ans = L(col(r, 'Σωστή Απάντηση')); if (ans < 0 || ans >= o.length) { warnings.push(`${id}: δεν βρέθηκε σωστή απάντηση — ορίστηκε η Α.`); ans = 0; }
      q = { ...newQuestion('mcq'), q: withExc(qt), opts: o, ans };
      const nf = fixes.filter(Boolean).length;
      if (nf > 1) q.fbs = o.map((_, k) => fixes[k] || ''); else if (nf === 1) { q.fbC = fixes.find(Boolean); q.fbW = q.fbC; }
    } else if (t === 'drag') {
      const lefts = [1, 2, 3, 4].map((i) => stripTags(col(r, 'Αριστερά ' + i))).filter(Boolean);
      const rights = [1, 2, 3, 4].map((i) => stripTags(col(r, 'Δεξιά ' + i))).filter(Boolean);
      const ans = lefts.map((_, i) => i);
      [...col(r, 'Σωστή Απάντηση').matchAll(/Αριστερά\s*(\d+)\s*(?:→|->|=)\s*Δεξιά\s*(\d+)/gi)].forEach((m) => { const a = +m[1] - 1, b = +m[2] - 1; if (a >= 0 && a < lefts.length && b >= 0 && b < rights.length) ans[a] = b; });
      q = { ...newQuestion('drag'), q: withExc(qt), tgts: lefts, items: rights, ans };
    } else if (t === 'click') {
      let text = exc; const miss = [];
      col(r, 'Λέξη-Στόχος').split('|').map((x) => x.trim()).filter(Boolean).forEach((w) => {
        const tryMark = (x) => { const i = text.indexOf(x); if (i < 0 || !x) return false; text = text.slice(0, i) + '[' + x + ']' + text.slice(i + x.length); return true; };
        if (!tryMark(w)) { const parts = w.split('/').map((x) => x.trim()).filter(Boolean); if (!(parts.length > 1 && parts.every(tryMark))) miss.push(w); }
      });
      if (miss.length) warnings.push(`${id}: η λέξη-στόχος «${miss.join(', ')}» δεν βρέθηκε στο απόσπασμα.`);
      q = { ...newQuestion('click'), q: qt || 'Επίλεξε τις λέξεις που ζητούνται.', text };
    } else if (t === 'gap') {
      const alts = col(r, 'Σωστή Απάντηση').split(/[|/]/).map((x) => x.trim()).filter(Boolean);
      const m = qt.match(/^(συμπλ[ηή]ρωσε[^.:]*[.:])\s*/i);
      let instr = m ? m[1] : 'Συμπλήρωσε το κενό.', rest = m ? qt.slice(m[0].length) : qt;
      const blank = '[' + (alts.join('|') || '…') + ']', word = /\p{L}/u.test(alts[0] || '');
      // «αξιοποι__στε» (κενό μέσα σε λέξη) → όλη η λέξη· «____διαφέρει» → κενό + διάστημα
      const fill = (x) => { const m = x.match(/\p{L}+_{2,3}\p{L}+/u); if (m) return x.replace(m[0], blank);
        return x.replace(/(\p{L})?_{2,}(\p{L})?/u, (_, a, c) => (a ? a + (word ? ' ' : '') : '') + blank + (c ? ' ' + c : '')); };
      if (/_{2,}/.test(rest)) q = { ...newQuestion('gap'), q: withExc(instr), text: fill(rest) };
      else if (/_{2,}/.test(exc)) q = { ...newQuestion('gap'), q: qt || 'Συμπλήρωσε το κενό.', text: fill(exc) }; // το κενό είναι στο απόσπασμα
      else { warnings.push(`${id}: δεν βρέθηκε «____» στο κείμενο — το κενό μπήκε στο τέλος.`); q = { ...newQuestion('gap'), q: withExc(instr), text: rest + ' ' + blank }; }
    } else if (t === 'order') {
      // ORD: οι περίοδοι με τη ΣΩΣΤΗ σειρά στο «Απόσπασμα», χωρισμένες με «|» (ή στις Επιλογές Α–Δ)
      let lines = exc.split('|').map((x) => x.trim()).filter(Boolean);
      if (lines.length < 2) lines = ['Α', 'Β', 'Γ', 'Δ'].map((k) => stripTags(col(r, 'Επιλογή ' + k))).filter(Boolean);
      if (lines.length < 2) { warnings.push(`${id}: ORD χωρίς περιόδους (γράψτε τες στο «Απόσπασμα» χωρισμένες με «|») — παραλείφθηκε.`); return; }
      q = { ...newQuestion('order'), q: qt || 'Βάλε τις περιόδους στη σωστή σειρά.', lines, fixFirst: /σταθερ|fix/.test(xlN(col(r, 'Σωστή Απάντηση'))) };
    } else if (t === 'sort') {
      // SORT: Αριστερά 1–4 = κατηγορίες· Δεξιά 1–4 = τα στοιχεία της καθεμιάς, χωρισμένα με «|»
      const cats = [1, 2, 3, 4].map((i) => ({ name: stripTags(col(r, 'Αριστερά ' + i)), items: stripTags(col(r, 'Δεξιά ' + i)).split('|').map((x) => x.trim()).filter(Boolean) })).filter((c) => c.name || c.items.length);
      if (cats.length < 2) { warnings.push(`${id}: SORT με λιγότερες από 2 κατηγορίες (Αριστερά 1–4 / Δεξιά 1–4) — παραλείφθηκε.`); return; }
      q = { ...newQuestion('sort'), q: withExc(qt || 'Ταξινόμησε τα στοιχεία στις σωστές κατηγορίες.'), cats };
    }
    if (!q) { warnings.push(`${id}: ο τύπος «${raw}» δεν υποστηρίζεται σε αυτή τη μορφή — παραλείφθηκε.`); return; }
    if (t !== 'mcq' && fixes[0]) { q.fbC = fixes[0]; q.fbW = fixes[0]; }
    const df = parseInt(col(r, 'Δυσκολία')); if (df >= 1 && df <= 5) q.diff = df;
    deck.qs.push(q);
  });
}
// Ανάγνωση xlsx/csv → δεδομένα κουίζ  { data, n, warnings }
async function importQuizXlsx(file, credits) {
  const X = await loadXlsx();
  const wb = X.read(await file.arrayBuffer(), { type: 'array' });
  const findSheet = (re) => wb.SheetNames.find((n) => re.test(xlN(n)));
  const aoa = (name) => (name ? X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: false }) : []);
  const qName = findSheet(/ερωτησ/) || wb.SheetNames[0];
  const all = aoa(qName).map((r) => r.map((c) => String(c == null ? '' : c).trim()));
  const hi = all.findIndex((r) => r.some((c) => xlN(c) === 'τυποσ'));
  if (hi < 0) throw new Error('Δεν βρέθηκε γραμμή επικεφαλίδων με στήλη «Τύπος» (φύλλο «' + qName + '»).');
  const H = {}; all[hi].forEach((c, i) => { const k = xlN(c); if (k && H[k] == null) H[k] = i; });
  const col = (r, name) => { const i = H[xlN(name)]; return i == null ? '' : (r[i] || ''); };
  const warnings = []; const decks = []; const deckOf = {};
  let cur = null, lastDeck = '';
  const getDeck = (label) => { const k = label || 'Ενότητα 1'; if (!deckOf[k]) { deckOf[k] = { label: k, ktitle: '', author: '', sub: '', qs: [] }; decks.push(deckOf[k]); } return deckOf[k]; };
  const finish = () => {
    if (!cur) return; const { t, rows, b, deck } = cur;
    let q = null; const r0 = rows[0];
    const opts = (r) => XL_OPT.map((o) => col(r, o));
    if (t === 'mcq') { const o = opts(r0); while (o.length > 2 && !o[o.length - 1]) o.pop(); const s = xlN(col(r0, 'Σωστή')); let ans = LABS.findIndex((L) => xlN(L) === s); if (ans < 0 && /^\d+$/.test(s)) ans = +s - 1; if (ans < 0) ans = o.findIndex((x) => xlN(x) === s && s); if (ans < 0) { ans = 0; warnings.push(`${deck.label} · ${b.n}: δεν βρέθηκε σωστή απάντηση — ορίστηκε η Α.`); } q = { ...newQuestion('mcq'), opts: o, ans }; }
    else if (t === 'tf') { const L = [col(r0, 'Α') || 'Σωστό', col(r0, 'Β') || 'Λάθος']; const s = xlN(col(r0, 'Σωστή')); const ans = (s === xlN(L[1]) || /^λαθ|^οχι|^β$|^false|^0$/.test(s)) ? 1 : 0; q = { ...newQuestion('tf'), labels: L, ans }; }
    else if (t === 'gap') { const set = xlSettings(col(r0, 'Ρύθμιση')); q = { ...newQuestion('gap'), text: col(r0, 'Κείμενο') || b.q, mode: set.some((x) => /^λιστ|^επιλογ|select/.test(x)) ? 'select' : 'type', strict: set.some((x) => /^αυστηρ|strict/.test(x)), distractors: opts(r0).filter(Boolean) }; if (q.text === b.q) b.q = ''; }
    else if (t === 'click') { q = { ...newQuestion('click'), text: col(r0, 'Κείμενο') }; }
    else if (t === 'drag') { const pr = rows.map((r) => [col(r, 'Α'), col(r, 'Β')]).filter((p) => p[0] || p[1]); q = { ...newQuestion('drag'), tgts: pr.map((p) => p[0]), items: pr.map((p) => p[1]), ans: pr.map((_, i) => i) }; }
    else if (t === 'order') { q = { ...newQuestion('order'), lines: rows.map((r) => col(r, 'Α')).filter(Boolean), fixFirst: xlSettings(col(r0, 'Ρύθμιση')).some((x) => /^σταθερ|^fix/.test(x)) }; }
    else if (t === 'sort') { const cats = []; rows.forEach((r) => { const c = col(r, 'Α'), it = col(r, 'Β'); if (!c && !it) return; let cc = cats.find((x) => xlN(x.name) === xlN(c)); if (!cc) { cc = { name: c, items: [] }; cats.push(cc); } if (it) cc.items.push(it); }); q = { ...newQuestion('sort'), cats: cats.length ? cats : newQuestion('sort').cats }; }
    else if (t === 'cw') { const m = col(r0, 'Ρύθμιση').match(/\d+/); q = { ...newQuestion('cw'), words: rows.map((r) => ({ w: col(r, 'Α'), c: col(r, 'Β') })).filter((x) => x.w || x.c), seed: m ? Math.max(1, +m[0]) : 1 }; }
    if (q) {
      if (b.q) q.q = b.q; q.fbC = b.fbC; q.fbW = b.fbW; q.ref = b.ref;
      const df = parseInt(col(r0, 'Δυσκολία')); if (df >= 1 && df <= 5) q.diff = df;
      if (t === 'mcq') { const fb = q.opts.map((_, k) => col(r0, 'Σχόλιο ' + XL_OPT[k])); if (fb.some(Boolean)) q.fbs = fb; }
      deck.qs.push(q);
    }
    cur = null;
  };
  const isMit = H[xlN('Κείμενο Ερώτησης')] != null && H[xlN('Κατηγορία')] != null;
  if (isMit) mitselosRows(all, hi, col, getDeck, warnings);
  else all.slice(hi + 1).forEach((r, ri) => {
    if (!r.some((c) => c)) return;
    const label = col(r, 'Ενότητα') || lastDeck || 'Ενότητα 1'; lastDeck = label;
    const n = col(r, 'Α/Α'), tRaw = col(r, 'Τύπος'), t = xlType(tRaw);
    const sameQ = cur && cur.deck.label === label && (n ? n === cur.b.n : !t) && XL_MULTI.includes(cur.t) && (!t || t === cur.t);
    if (sameQ) { cur.rows.push(r); return; }
    finish();
    if (t === '?' || !t) { warnings.push(`Γραμμή ${hi + ri + 2}: άγνωστος τύπος «${tRaw || '—'}» — παραλείφθηκε.`); return; }
    cur = { t, rows: [r], deck: getDeck(label), b: { n: n || String(ri), q: col(r, 'Εκφώνηση'), fbC: col(r, 'Σχόλιο σωστού'), fbW: col(r, 'Σχόλιο λάθους'), ref: col(r, 'Παραπομπή') } };
  });
  finish();
  // Ενότητες
  const dRows = aoa(findSheet(/^ενοτητ/));
  if (dRows.length > 1) {
    const h = dRows[0].map(xlN); const ix = (re) => h.findIndex((x) => re.test(x));
    const iL = ix(/^ενοτητ/), iT = ix(/^τιτλ/), iA = ix(/^συγγραφ|^πηγ/), iS = ix(/^θεματ|^αξον/);
    dRows.slice(1).forEach((r) => { const L = String(r[iL] || '').trim(); if (!L) return; const d = deckOf[L] || (decks.push(deckOf[L] = { label: L, ktitle: '', author: '', sub: '', qs: [] }), deckOf[L]); if (iT >= 0) d.ktitle = String(r[iT] || '').trim(); if (iA >= 0) d.author = String(r[iA] || '').trim(); if (iS >= 0) d.sub = String(r[iS] || '').trim(); });
  }
  const data = newQuiz(credits, 'quiz-xlsx-deck');
  const gRows = aoa(findSheet(/^γενικ/));
  const yes = (v) => /^(ναι|ν|yes|1|true|x|✓)$/.test(xlN(v));
  gRows.forEach((r) => { const k = xlN(r[0]), v = String(r[1] == null ? '' : r[1]).trim(); if (!k) return;
    if (/^τιτλοσ εφαρμ/.test(k)) data.title = v; else if (/^μικρη/.test(k)) data.eyebrow = v; else if (/^μεγαλ/.test(k)) data.heading = v; else if (/^υποτιτλ/.test(k)) data.subtitle = v;
    else if (/^ονομα|^υπογραφ|^δημιουργ/.test(k)) data.credits = v; else if (/^χρονολογ|^ετοσ/.test(k)) { if (+v) data.year = +v; } else if (/^ανακατεμα ερωτ/.test(k)) data.shuffleQs = yes(v); else if (/^ανακατεμα επιλ/.test(k)) data.shuffleOpts = yes(v); });
  data.decks = decks.filter((d) => d.qs.length);
  if (!data.title) data.title = String(file.name || '').replace(/\.(xlsx|xls|csv|ods)$/i, '');
  const n = data.decks.reduce((s, d) => s + d.qs.length, 0);
  if (!n) throw new Error('Δεν βρέθηκαν ερωτήσεις στο αρχείο.' + (warnings.length ? '\n' + warnings.slice(0, 5).join('\n') : ''));
  return { data, n, warnings, hasGen: gRows.length > 1 };
}

function buildHtml(tpl, data) {
  const json = JSON.stringify(cleanForExport(data))
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const title = String(data.title || 'Κουίζ').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return tpl
    .replace(MARK_RE, () => '/*QUIZ_DATA_START*/' + json + '/*QUIZ_DATA_END*/')
    .replace(/<title>[^<]*<\/title>/, () => '<title>' + title + '</title>');
}
function parseHtml(html) {
  const m = String(html || '').match(MARK_RE);
  if (!m) return null;
  try { const d = JSON.parse(m[1]); return d && Array.isArray(d.decks) ? d : null; } catch { return null; }
}
const safeName = (s) => (String(s || '').replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Κουίζ').slice(0, 80);
const withHtml = (s) => (/\.html?$/i.test(s) ? s : s + '.html');
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ═════════════════════════════════════════════════════════════════
export default function Creator() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState('pick');          // pick | edit
  const [tplId, setTplId] = useState('quiz-deck');
  const [tplCache, setTplCache] = useState({});      // { [id]: html } — φορτώνονται όλα τα πρότυπα
  const [cwInfo, setCwInfo] = useState(null);        // { unplaced: [[λέξεις που δεν χώρεσαν] ανά ενότητα] } από την προεπισκόπηση
  const [data, setData] = useState(null);
  const [sel, setSel] = useState({ d: 0, q: 0 });
  const [editing, setEditing] = useState(null);      // { id, name, folderId } — υπάρχουσα εφαρμογή στο Drive
  const [drive, setDrive] = useState(null);          // { appsFolderId, folders, appsSub, apps }
  const [draft, setDraft] = useState(null);
  const [panel, setPanel] = useState('question');    // question | deck | general
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadingApp, setLoadingApp] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const fileRef = useRef(null);
  const xlRef = useRef(null);
  const [xlBusy, setXlBusy] = useState(false);
  const savedJson = useRef(null); // περιεχόμενο όπως είναι αποθηκευμένο στο Drive → πρόχειρο μόνο αν υπάρχουν αλλαγές

  const tpl = tplOf(tplId);
  const isCw = tpl.kind === 'cw';
  const isPara = tpl.kind === 'para';
  const isSort = tpl.kind === 'sort';
  const isPS = isPara || isSort; // ασκήσεις στο decks[].ps
  const newPItem = isSort ? newSortItem : newParaItem;
  const probsOfP = isSort ? problemsOfSort : problemsOfPara;
  const pWord = isSort ? ['άσκηση', 'ασκήσεις', 'της άσκησης'] : ['παράγραφο', 'παράγραφοι', 'της παραγράφου'];
  const tplHtml = tplCache[tpl.id] || '';
  const token = session?.accessToken;

  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 980);
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => { setDraft(lsGet(DRAFT_KEY)); }, []);
  useEffect(() => {
    TEMPLATES.forEach((t) => {
      fetch(t.file + '?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.text())
        .then((h) => setTplCache((c) => ({ ...c, [t.id]: h }))).catch(() => {});
    });
  }, []);
  // Η προεπισκόπηση του σταυρόλεξου ενημερώνει ποιες λέξεις δεν χώρεσαν στο πλέγμα
  useEffect(() => {
    const on = (e) => { if (e.data && e.data.type === 'lev-cw-info') setCwInfo(e.data); };
    window.addEventListener('message', on); return () => window.removeEventListener('message', on);
  }, []);

  // Φάκελοι + εφαρμογές του χρήστη (ίδια API με το index.js)
  const loadDrive = useCallback(async () => {
    try {
      const [rf, rr] = await Promise.all([fetch('/api/folders'), fetch('/api/registry')]);
      const f = await rf.json(); const r = await rr.json();
      const files = Array.isArray(r.files) ? r.files : [];
      const isFolder = (x) => x.mimeType === 'application/vnd.google-apps.folder';
      const appsSub = files.filter((x) => isFolder(x) && x.folderId === f.appsFolderId);
      const apps = files.filter((x) => !isFolder(x) && (/\.html?$/i.test(x.name || '') || x.mimeType === 'text/html'))
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      setDrive({ appsFolderId: f.appsFolderId, folders: f.folders || [], appsSub, apps });
    } catch { setDrive({ error: true, folders: [], appsSub: [], apps: [] }); }
  }, []);
  useEffect(() => { if (status === 'authenticated') loadDrive(); }, [status, loadDrive]);

  // Αυτόματη αποθήκευση πρόχειρου (στη συσκευή)
  useEffect(() => {
    if (step !== 'edit' || !data) return;
    // Ίδιο με την αποθηκευμένη στο Drive εφαρμογή → δεν υπάρχει πρόχειρο (σβήνεται)
    if (savedJson.current && JSON.stringify(data) === savedJson.current) { lsSet(DRAFT_KEY, null); return; }
    const t = setTimeout(() => lsSet(DRAFT_KEY, { data, editing, at: Date.now() }), 600);
    return () => clearTimeout(t);
  }, [data, editing, step]);

  const defaultCredits = () => {
    const n = session?.user?.name || '';
    return n;
  };
  const startNew = (id) => { savedJson.current = null; setTplId(id); setCwInfo(null); setData(tplOf(id).kind === 'cw' ? newCw(defaultCredits()) : tplOf(id).kind === 'para' ? newPara(defaultCredits()) : tplOf(id).kind === 'sort' ? newSort(defaultCredits()) : newQuiz(defaultCredits(), id)); setEditing(null); setSel({ d: 0, q: 0 }); setPanel('general'); setStep('edit'); };
  // fromDrive: άνοιγμα αποθηκευμένης εφαρμογής → δεν είναι πρόχειρο μέχρι να γίνει αλλαγή
  const openData = (d, ed, fromDrive) => { const nd = normalizeData(d); setTplId(tplIdOfData(d)); setCwInfo(null); savedJson.current = fromDrive ? JSON.stringify(nd) : null; setData(nd); setEditing(ed || null); setSel({ d: 0, q: 0 }); setPanel('question'); setStep('edit'); };

  const openDriveApp = async (f) => {
    if (!token) return;
    setLoadingApp(f.id);
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = parseHtml(await r.text());
      if (!d) alert('Η εφαρμογή «' + f.name + '» δεν δημιουργήθηκε με πρότυπο του Δημιουργού, οπότε δεν μπορεί να ανοίξει εδώ.');
      else openData(d, { id: f.id, name: f.name, folderId: f.folderId }, true);
    } catch (e) { alert('Δεν ήταν δυνατό το άνοιγμα: ' + e.message); }
    setLoadingApp('');
  };
  // ?edit=<fileId> → άνοιγμα κατευθείαν (σύνδεσμος από τον ΛΕΒΙΑΘΑΝ)
  useEffect(() => {
    const id = router.query.edit;
    if (!id || !drive || step !== 'pick') return;
    const f = drive.apps.find((x) => x.id === id);
    if (f) openDriveApp(f);
  }, [router.query.edit, drive]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLocalFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const d = parseHtml(await f.text());
    if (!d) alert('Το αρχείο δεν δημιουργήθηκε με πρότυπο του Δημιουργού.');
    else openData(d, null);
  };

  // ── Ενημερώσεις δεδομένων ──
  const upd = (fn) => setData((prev) => { const n = JSON.parse(JSON.stringify(prev)); fn(n); return n; });
  const deck = data?.decks[sel.d];
  const q = (isCw || isPS) ? null : deck?.qs[sel.q];
  const pItem = isPS ? deck?.ps[sel.q] : null;
  const setQ = (patch) => upd((n) => { Object.assign(n.decks[sel.d].qs[sel.q], patch); });

  const addQuestion = (t) => {
    upd((n) => { n.decks[sel.d].qs.push(newQuestion(t)); });
    setSel((s) => ({ d: s.d, q: data.decks[s.d].qs.length }));
    setPanel('question');
  };
  const moveQ = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= deck.qs.length) return;
    upd((n) => { const a = n.decks[sel.d].qs; [a[i], a[j]] = [a[j], a[i]]; });
    setSel((s) => ({ ...s, q: j }));
  };
  const dupQ = (i) => { upd((n) => { const a = n.decks[sel.d].qs; a.splice(i + 1, 0, JSON.parse(JSON.stringify(a[i]))); }); setSel((s) => ({ ...s, q: i + 1 })); };
  const delQ = (i) => {
    if (deck.qs.length === 1) { alert('Η ενότητα χρειάζεται τουλάχιστον μία ερώτηση.'); return; }
    if (!confirm('Διαγραφή της ερώτησης ' + (i + 1) + ';')) return;
    upd((n) => { n.decks[sel.d].qs.splice(i, 1); });
    setSel((s) => ({ ...s, q: Math.max(0, Math.min(s.q, deck.qs.length - 2)) }));
  };
  const addDeck = () => {
    upd((n) => { n.decks.push(isCw ? newCwDeck(n.decks.length + 1) : isPara ? newParaDeck(n.decks.length + 1) : isSort ? newSortDeck(n.decks.length + 1) : newDeck(n.decks.length + 1)); });
    setSel({ d: data.decks.length, q: 0 }); setPanel('deck');
  };
  const delDeck = (i) => {
    if (data.decks.length === 1) { alert('Η εφαρμογή χρειάζεται τουλάχιστον μία ενότητα.'); return; }
    if (!confirm('Διαγραφή ολόκληρης της ενότητας «' + (data.decks[i].label || i + 1) + '» με όλο το περιεχόμενό της;')) return;
    upd((n) => { n.decks.splice(i, 1); });
    setSel({ d: Math.max(0, i - 1), q: 0 });
  };
  const changeType = (t) => {
    if (t === q.t) return;
    const filled = q.t === 'mcq' ? q.opts.some((o) => o.trim()) : q.t === 'drag' ? q.tgts.some((o) => o.trim()) : (q.t === 'gap' || q.t === 'click') ? !!q.text.trim()
      : q.t === 'order' ? (q.lines || []).some((l) => String(l).trim()) : q.t === 'sort' ? (q.cats || []).some((c) => (c.items || []).some((x) => String(x).trim())) : q.t === 'cw' ? (q.words || []).some((x) => String(x.w || '').trim()) : false;
    if (filled && !confirm('Η αλλαγή τύπου θα σβήσει τις απαντήσεις αυτής της ερώτησης (η εκφώνηση μένει). Συνέχεια;')) return;
    upd((n) => { n.decks[sel.d].qs[sel.q] = newQuestion(t, q); });
  };

  // ── Έλεγχος ──
  const allProblems = useMemo(() => {
    if (!data) return [];
    const out = [];
    if (isCwData(data)) data.decks.forEach((dk, di) => problemsOfCw(dk).forEach((m) => out.push({ d: di, q: -2, m })));
    else if (isParaData(data)) data.decks.forEach((dk, di) => dk.ps.forEach((x, pi) => problemsOfPara(x).forEach((m) => out.push({ d: di, q: pi, m }))));
    else if (isSortData(data)) data.decks.forEach((dk, di) => dk.ps.forEach((x, pi) => problemsOfSort(x).forEach((m) => out.push({ d: di, q: pi, m }))));
    else data.decks.forEach((dk, di) => dk.qs.forEach((qq, qi) => problemsOf(qq).forEach((m) => out.push({ d: di, q: qi, m }))));
    if (!String(data.title || '').trim()) out.unshift({ d: -1, q: -1, m: 'Λείπει ο τίτλος της εφαρμογής (Γενικά).' });
    return out;
  }, [data]);
  const deckCount = (dk) => (isCw ? (dk.words || []).filter((x) => String(x.w).trim()).length : isPS ? (dk.ps || []).length : dk.qs.length);
  // Αναδιάταξη: παράγραφοι της ενότητας
  const setP = (patch) => upd((n) => { Object.assign(n.decks[sel.d].ps[sel.q], patch); });
  const addPara = () => { upd((n) => { n.decks[sel.d].ps.push(newPItem()); }); setSel((s) => ({ d: s.d, q: data.decks[s.d].ps.length })); setPanel('question'); };
  const movePara = (i, dir) => { const j = i + dir; if (j < 0 || j >= deck.ps.length) return; upd((n) => { const a = n.decks[sel.d].ps; [a[i], a[j]] = [a[j], a[i]]; }); setSel((s) => ({ ...s, q: j })); };
  const dupPara = (i) => { upd((n) => { const a = n.decks[sel.d].ps; a.splice(i + 1, 0, JSON.parse(JSON.stringify(a[i]))); }); setSel((s) => ({ ...s, q: i + 1 })); };
  const delPara = (i) => {
    if (deck.ps.length === 1) { alert('Η ενότητα χρειάζεται τουλάχιστον μία ' + pWord[0] + '.'); return; }
    if (!confirm('Διαγραφή ' + pWord[2] + ' ' + (i + 1) + ';')) return;
    upd((n) => { n.decks[sel.d].ps.splice(i, 1); });
    setSel((s) => ({ ...s, q: Math.max(0, Math.min(s.q, deck.ps.length - 2)) }));
  };
  const totalQs = data ? data.decks.reduce((s, d) => s + deckCount(d), 0) : 0;

  // ── Προεπισκόπηση ──
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewStart, setPreviewStart] = useState(false);
  useEffect(() => {
    if (!data || !tplHtml) return;
    const t = setTimeout(() => {
      const pv = `<script>window.LEV_PREVIEW=${JSON.stringify({ d: sel.d, q: previewStart || panel !== 'question' ? -1 : (isCw ? 0 : sel.q) })}</script>`;
      setPreviewHtml(buildHtml(tplHtml, data).replace(/<head>/i, '<head>' + pv));
    }, 450);
    return () => clearTimeout(t);
  }, [data, tplHtml, sel, panel, previewStart, isCw]);

  // ── Excel (μόνο πρότυπο κουίζ) ──
  const doExportXlsx = async (d, name) => {
    setXlBusy(true);
    try { await exportQuizXlsx(cleanForExport(d), name); } catch (e) { alert(e.message || String(e)); }
    setXlBusy(false);
  };
  const doImportXlsx = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setXlBusy(true);
    try {
      const r = await importQuizXlsx(f, defaultCredits());
      const nd = r.data.decks.length;
      const msg = `Βρέθηκαν ${r.n} ερωτήσεις σε ${nd} ${nd === 1 ? 'ενότητα' : 'ενότητες'}.` + (r.warnings.length ? '\n\nΠροσοχή:\n• ' + r.warnings.slice(0, 8).join('\n• ') + (r.warnings.length > 8 ? `\n… και ${r.warnings.length - 8} ακόμη` : '') : '');
      if (step === 'edit' && data && tpl.id === 'quiz-xlsx-deck') {
        if (!confirm(msg + '\n\nΝα αντικαταστήσουν τις ενότητες και τις ερωτήσεις της εφαρμογής που επεξεργάζεστε;')) { setXlBusy(false); return; }
        const nq = normalizeData(r.data);
        upd((n) => { if (r.hasGen) ['title', 'eyebrow', 'heading', 'subtitle', 'credits', 'shuffleQs', 'shuffleOpts'].forEach((k) => { n[k] = nq[k]; }); n.decks = nq.decks; });
        setSel({ d: 0, q: 0 }); setPanel('question');
      } else {
        openData(r.data, null);
        alert(msg);
      }
    } catch (err) { alert('Το αρχείο Excel δεν διαβάστηκε: ' + (err.message || err)); }
    setXlBusy(false);
  };
  const finalHtml = () => buildHtml(tplHtml, data);
  const testInTab = () => { const u = URL.createObjectURL(new Blob([finalHtml()], { type: 'text/html' })); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); };

  // ═══════════════════ ΟΘΟΝΗ 1: επιλογή προτύπου ═══════════════════
  if (step === 'pick') {
    return (
      <Page>
        <TopBar right={<a href="/" style={S.linkBtn}>← ΛΕΒΙΑΘΑΝ</a>} />
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 60px' }}>
          <div style={S.eyebrow}>Δημιουργός εφαρμογών</div>
          <h1 style={S.h1}>Από τις ερωτήσεις σου, <em style={{ color: C.purple }}>έτοιμη εφαρμογή</em></h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 620, margin: '8px 0 26px' }}>
            Διάλεξε πρότυπο, γράψε τις ερωτήσεις με τις απαντήσεις τους και αποθήκευσε. Η εφαρμογή μπαίνει σε φάκελο του ΛΕΒΙΑΘΑΝ, έτοιμη για μοίρασμα, QR και Live.
          </p>

          {draft?.data && (
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 22, borderLeft: `4px solid ${C.gold}` }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>Πρόχειρο σε εξέλιξη</div>
                <div style={{ fontSize: 13, color: C.muted }}>«{draft.data.title || 'Χωρίς τίτλο'}» · {new Date(draft.at).toLocaleString('el-GR')}</div>
              </div>
              <button style={S.btnPrimary} onClick={() => openData(draft.data, draft.editing)}>Συνέχεια</button>
              <button style={S.btnGhost} onClick={() => { if (confirm('Οριστική διαγραφή του πρόχειρου;')) { lsSet(DRAFT_KEY, null); setDraft(null); } }}>Απόρριψη</button>
            </div>
          )}

          <SectionTitle>Πρότυπα</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 34 }}>
            {TEMPLATES.map((t) => (
              <div key={t.id} style={{ ...S.card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative' }}>
                  <TemplateThumb kind={t.kind} look={t.look} />
                  {t.badge && <span style={{ position: 'absolute', top: 10, right: 10, background: '#1D6F42', color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 1, padding: '4px 9px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>{t.badge}</span>}
                </div>
                <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ fontFamily: 'Literata,serif', fontSize: 19, fontWeight: 700, color: C.navy }}>{t.name}</div>
                  <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>{t.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.types.map((x) => <span key={x} style={S.pill}>{x}</span>)}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button style={{ ...S.btnPrimary, alignSelf: 'flex-start' }} onClick={() => startNew(t.id)} disabled={!tplCache[t.id]}>Νέα εφαρμογή →</button>
                </div>
              </div>
            ))}
          </div>

          <SectionTitle>Επεξεργασία υπάρχουσας εφαρμογής</SectionTitle>
          <p style={{ color: C.muted, fontSize: 13.5, margin: '-4px 0 12px' }}>
            Άνοιξε μια εφαρμογή που φτιάχτηκε εδώ για να διορθώσεις ερωτήσεις ή να προσθέσεις νέα ενότητα (νέα κάρτα στην αρχική της οθόνη).
          </p>
          {status !== 'authenticated' ? (
            <div style={S.card}>
              <span style={{ fontSize: 14 }}>Συνδέσου για να δεις τις εφαρμογές σου στο Drive.</span>{' '}
              <button style={{ ...S.btnGhost, marginLeft: 8 }} onClick={() => signIn('google', { callbackUrl: '/creator' })}>Σύνδεση</button>
            </div>
          ) : !drive ? <div style={{ color: C.muted }}>Φόρτωση…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
              {drive.apps.length === 0 && <div style={{ color: C.muted, fontSize: 14 }}>Δεν υπάρχουν ακόμη εφαρμογές HTML στον ΛΕΒΙΑΘΑΝ.</div>}
              {drive.apps.slice(0, 60).map((f) => (
                <button key={f.id} onClick={() => openDriveApp(f)} disabled={!!loadingApp}
                  style={{ ...S.card, textAlign: 'left', cursor: 'pointer', padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {loadingApp === f.id && <span style={{ color: C.muted, fontSize: 12 }}>…</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <button style={S.btnGhost} onClick={() => fileRef.current?.click()}>📂 Άνοιγμα αρχείου από τη συσκευή</button>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" style={{ display: 'none' }} onChange={openLocalFile} />
          </div>
          <div style={{ ...S.card, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={S.miniTitle}>📊 Κουίζ από Excel (xlsx) — πρότυπο «Κουίζ ενοτήτων · xlsx»</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>Γράψτε τις ερωτήσεις σε φύλλο Excel ή Google Sheets — μία γραμμή ανά ερώτηση — και φορτώστε το. Κατεβάστε πρώτα το υπόδειγμα: έχει ένα παράδειγμα από κάθε τύπο και οδηγίες.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={S.btnGhost} disabled={xlBusy} onClick={() => doExportXlsx(sampleQuizData(defaultCredits()), 'Υπόδειγμα κουίζ')}>⬇ Υπόδειγμα Excel</button>
              <button style={S.btnGhost} disabled={xlBusy} onClick={() => xlRef.current?.click()}>⬆ Νέο κουίζ από Excel</button>
              {xlBusy && <span style={{ alignSelf: 'center', color: C.muted, fontSize: 13 }}>…</span>}
            </div>
            <input ref={xlRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display: 'none' }} onChange={doImportXlsx} />
          </div>
        </div>
      </Page>
    );
  }

  // ═══════════════════ ΟΘΟΝΗ 2: επεξεργασία ═══════════════════
  const preview = (
    <Preview html={previewHtml} onRestart={() => setPreviewStart((v) => !v)} startMode={previewStart} />
  );

  return (
    <Page>
      <TopBar
        title={data.title || 'Νέα εφαρμογή'}
        sub={editing ? 'Επεξεργασία: ' + editing.name : tpl.name}
        right={<>
          <button style={S.linkBtn} onClick={() => { setStep('pick'); setDraft(lsGet(DRAFT_KEY)); }}>← Πρότυπα</button>
          {narrow && <button style={S.btnGhostSm} onClick={() => setMobilePreview(true)}>👁 Προεπισκόπηση</button>}
          <button style={S.btnGhostSm} onClick={testInTab} title="Άνοιγμα της εφαρμογής σε νέα καρτέλα">▶ Δοκιμή</button>
          <button style={S.btnPrimarySm} onClick={() => setSaveOpen(true)}>💾 Αποθήκευση</button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : '300px minmax(0,1fr) minmax(360px,40%)', gap: 16, padding: narrow ? 12 : 16, alignItems: 'start', maxWidth: 1700, margin: '0 auto' }}>
        {/* ── Αριστερά: γενικά, ενότητες, λίστα ερωτήσεων ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, position: narrow ? 'static' : 'sticky', top: 70 }}>
          <button onClick={() => setPanel('general')} style={{ ...S.navBtn, ...(panel === 'general' ? S.navBtnOn : {}) }}>⚙︎ Γενικά στοιχεία εφαρμογής</button>
          {tpl.id === 'quiz-xlsx-deck' && (
            <div style={{ ...S.card, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ ...S.miniTitle, margin: 0, flex: 1 }}>📊 Excel</span>
              <button style={{ ...S.btnGhostSm }} disabled={xlBusy} title="Όλες οι ερωτήσεις σε αρχείο xlsx" onClick={() => doExportXlsx(data, data.title || 'kouiz')}>⬇ Εξαγωγή</button>
              <button style={{ ...S.btnGhostSm }} disabled={xlBusy} title="Αντικατάσταση των ερωτήσεων από αρχείο xlsx" onClick={() => xlRef.current?.click()}>⬆ Εισαγωγή</button>
              <input ref={xlRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display: 'none' }} onChange={doImportXlsx} />
            </div>
          )}

          <div style={S.card}>
            <div style={S.miniTitle}>Ενότητες (κάρτες αρχικής)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.decks.map((dk, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setSel({ d: i, q: 0 }); setPanel('deck'); }}
                    style={{ ...S.navBtn, flex: 1, ...(sel.d === i ? S.navBtnOn : {}) }}>
                    <b style={{ opacity: .5, marginRight: 6 }}>{String(i + 1).padStart(2, '0')}</b>{dk.label || 'Χωρίς όνομα'}
                    <span style={{ float: 'right', fontSize: 11, opacity: .7 }}>{deckCount(dk)}</span>
                  </button>
                </div>
              ))}
              <button style={{ ...S.btnGhost, fontSize: 13 }} onClick={addDeck}>＋ Νέα ενότητα</button>
            </div>
          </div>

          {isPS ? (
            <div style={S.card}>
              <div style={{ ...S.miniTitle, display: 'flex', justifyContent: 'space-between' }}>
                <span>{isSort ? 'Ασκήσεις' : 'Παράγραφοι'} · {deck.label || 'ενότητα'}</span><span>{deck.ps.length}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, margin: '-4px 0 8px' }}>Μία ή περισσότερες ανά ενότητα · σύνολο {totalQs}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: narrow ? 'none' : '42vh', overflowY: 'auto' }}>
                {deck.ps.map((x, i) => {
                  const bad = probsOfP(x).length > 0, on = panel === 'question' && sel.q === i;
                  return (
                    <button key={i} onClick={() => { setSel({ d: sel.d, q: i }); setPanel('question'); setPreviewStart(false); }} style={{ ...S.qItem, ...(on ? S.qItemOn : {}) }}>
                      <span style={{ width: 22, fontWeight: 700, color: on ? '#fff' : C.purpleLight }}>{i + 1}</span>
                      <span style={{ width: 16, opacity: .8 }}>{isSort ? '▤' : '⇅'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{isSort ? (x.title || sortCats(x).map((c) => c.name).filter(Boolean).join(' · ') || <i style={{ opacity: .6 }}>κενή άσκηση</i>) : (x.title || paraLines(x)[0] || <i style={{ opacity: .6 }}>κενή παράγραφος</i>)}</span>
                      <span style={{ fontSize: 11, opacity: .7 }}>{isSort ? sortCount(x) : paraLines(x).length}</span>
                      {bad && <span title="Ελλιπής" style={{ color: on ? '#ffd7d0' : C.bad }}>!</span>}
                    </button>
                  );
                })}
              </div>
              <button style={{ ...S.btnGhost, fontSize: 13, width: '100%', marginTop: 10 }} onClick={addPara}>{isSort ? '＋ Νέα άσκηση' : '＋ Νέα παράγραφος'}</button>
            </div>
          ) : isCw ? (
            <div style={S.card}>
              <div style={{ ...S.miniTitle, display: 'flex', justifyContent: 'space-between' }}>
                <span>Λέξεις · {deck.label || 'ενότητα'}</span><span>{deckCount(deck)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, margin: '-4px 0 8px' }}>Προτείνονται 8–20 λέξεις ανά σταυρόλεξο · σύνολο {totalQs}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {deck.words.filter((x) => String(x.w).trim()).map((x, i) => <span key={i} style={S.pill}>{cwNorm(x.w)}</span>)}
              </div>
              <button style={{ ...S.navBtn, ...(panel === 'question' ? S.navBtnOn : {}) }} onClick={() => { setPanel('question'); setPreviewStart(false); }}>✎ Λέξεις και ορισμοί</button>
            </div>
          ) : (
          <div style={S.card}>
            <div style={{ ...S.miniTitle, display: 'flex', justifyContent: 'space-between' }}>
              <span>Ερωτήσεις · {deck.label || 'ενότητα'}</span>
              <span style={{ color: [10, 20].includes(deck.qs.length) ? C.ok : C.muted }}>{deck.qs.length}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, margin: '-4px 0 8px' }}>Προτείνονται 10 ή 20 ανά ενότητα · σύνολο {totalQs}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: narrow ? 'none' : '42vh', overflowY: 'auto' }}>
              {deck.qs.map((qq, i) => {
                const bad = problemsOf(qq).length > 0;
                const on = panel === 'question' && sel.q === i;
                return (
                  <button key={i} onClick={() => { setSel({ d: sel.d, q: i }); setPanel('question'); setPreviewStart(false); }}
                    style={{ ...S.qItem, ...(on ? S.qItemOn : {}) }}>
                    <span style={{ width: 22, fontWeight: 700, color: on ? '#fff' : C.purpleLight }}>{i + 1}</span>
                    <span title={typeOf(qq.t).label} style={{ width: 16, opacity: .8 }}>{typeOf(qq.t).icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{qq.q || <i style={{ opacity: .6 }}>χωρίς εκφώνηση</i>}</span>
                    {bad && <span title="Ελλιπής" style={{ color: on ? '#ffd7d0' : C.bad }}>!</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ ...S.miniTitle, marginTop: 12 }}>＋ Προσθήκη ερώτησης</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {TYPES.map((t) => (
                <button key={t.t} onClick={() => addQuestion(t.t)} style={S.addBtn}><span style={{ color: C.purple }}>{t.icon}</span> {t.label}</button>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* ── Κέντρο: φόρμα ── */}
        <div style={{ ...S.card, padding: narrow ? 16 : 22, minWidth: 0 }}>
          {panel === 'general' && <GeneralForm data={data} upd={upd} isCw={isCw} kind={tpl.kind} />}
          {panel === 'deck' && <DeckForm deck={deck} index={sel.d} upd={(fn) => upd((n) => fn(n.decks[sel.d]))} onDelete={() => delDeck(sel.d)} onOpenQs={() => setPanel('question')} isCw={isCw} kind={tpl.kind} count={deckCount(deck)} />}
          {panel === 'question' && isSort && pItem && (
            <SortItemForm key={sel.d + ':' + sel.q} x={pItem} index={sel.q} total={deck.ps.length} setP={setP}
              onUp={() => movePara(sel.q, -1)} onDown={() => movePara(sel.q, 1)} onDup={() => dupPara(sel.q)} onDel={() => delPara(sel.q)}
              onPrev={() => setSel((s) => ({ ...s, q: Math.max(0, s.q - 1) }))}
              onNext={() => (sel.q < deck.ps.length - 1 ? setSel((s) => ({ ...s, q: s.q + 1 })) : addPara())} />
          )}
          {panel === 'question' && isPara && pItem && (
            <ParaForm key={sel.d + ':' + sel.q} x={pItem} index={sel.q} total={deck.ps.length} setP={setP}
              onUp={() => movePara(sel.q, -1)} onDown={() => movePara(sel.q, 1)} onDup={() => dupPara(sel.q)} onDel={() => delPara(sel.q)}
              onPrev={() => setSel((s) => ({ ...s, q: Math.max(0, s.q - 1) }))}
              onNext={() => (sel.q < deck.ps.length - 1 ? setSel((s) => ({ ...s, q: s.q + 1 })) : addPara())} />
          )}
          {panel === 'question' && isCw && (
            <CwWordsForm key={sel.d} deck={deck} index={sel.d} upd={(fn) => upd((n) => fn(n.decks[sel.d]))} unplaced={(cwInfo?.unplaced || [])[sel.d] || []} />
          )}
          {panel === 'question' && q && (
            <QuestionForm key={sel.d + ':' + sel.q} adv={tpl.id === 'quiz-xlsx-deck'} q={q} index={sel.q} total={deck.qs.length} setQ={setQ} changeType={changeType}
              onUp={() => moveQ(sel.q, -1)} onDown={() => moveQ(sel.q, 1)} onDup={() => dupQ(sel.q)} onDel={() => delQ(sel.q)}
              onPrev={() => setSel((s) => ({ ...s, q: Math.max(0, s.q - 1) }))}
              onNext={() => sel.q < deck.qs.length - 1 ? setSel((s) => ({ ...s, q: s.q + 1 })) : addQuestion(q.t)} />
          )}
        </div>

        {/* ── Δεξιά: προεπισκόπηση ── */}
        {!narrow && <div style={{ position: 'sticky', top: 70 }}>{preview}</div>}
      </div>

      {narrow && mobilePreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,16,.55)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button style={{ ...S.btnPrimarySm }} onClick={() => setMobilePreview(false)}>✕ Κλείσιμο</button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}><Preview html={previewHtml} fill initialMode="mob" onRestart={() => setPreviewStart((v) => !v)} startMode={previewStart} /></div>
        </div>
      )}

      {saveOpen && (
        <SaveDialog
          data={data} problems={allProblems} editing={editing} drive={drive} status={status} token={token} itemLbl={isPara ? 'Παρ.' : isSort ? 'Ασκ.' : 'Ερ.'}
          defaultFolder={typeof router.query.folder === 'string' ? router.query.folder : ''}
          onClose={() => setSaveOpen(false)} onGo={(p) => { setSaveOpen(false); if (p.d >= 0) { setSel({ d: p.d, q: Math.max(0, p.q) }); setPanel('question'); } else setPanel('general'); }}
          getHtml={finalHtml}
          onSaved={(ed) => { savedJson.current = JSON.stringify(data); lsSet(DRAFT_KEY, null); setDraft(null); setEditing(ed); loadDrive(); }}
          onLogin={() => { lsSet(DRAFT_KEY, { data, editing, at: Date.now() }); signIn('google', { callbackUrl: '/creator' }); }}
        />
      )}
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════
// Φόρμες
// ═════════════════════════════════════════════════════════════════
function GeneralForm({ data, upd, isCw, kind }) {
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; upd((n) => { n[k] = v; }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormTitle eyebrow="Γενικά" title="Η αρχική οθόνη της εφαρμογής" />
      <Field label="Τίτλος εφαρμογής" hint="Γίνεται και όνομα αρχείου στον ΛΕΒΙΑΘΑΝ.">
        <input style={S.input} value={data.title} onChange={set('title')} placeholder={isCw ? 'π.χ. Σταυρόλεξα — Σχήματα λόγου' : kind === 'para' ? 'π.χ. Αναδιάταξη — Η δομή της παραγράφου' : kind === 'sort' ? 'π.χ. Ταξινόμηση — Είδη δευτερευουσών προτάσεων' : 'π.χ. Κουίζ — 14η Διδακτική πρόταση'} autoFocus />
      </Field>
      <Field label="Μικρή επικεφαλίδα (πάνω από τον τίτλο)">
        <input style={S.input} value={data.eyebrow} onChange={set('eyebrow')} />
      </Field>
      <Field label="Μεγάλος τίτλος αρχικής" hint="Με *αστεράκια* μια λέξη γίνεται πλάγια και μωβ. Αν μείνει κενό, μπαίνει ο τίτλος εφαρμογής.">
        <input style={S.input} value={data.heading} onChange={set('heading')} placeholder="π.χ. 14η Διδακτική *πρόταση*" />
      </Field>
      <Field label="Υπότιτλος / οδηγίες">
        <textarea style={{ ...S.input, minHeight: 70 }} value={data.subtitle} onChange={set('subtitle')} />
      </Field>
      <Field label="Όνομα δημιουργού (προαιρετικό)" hint={`Κάτω μέρος της εφαρμογής και της εκτύπωσης: © ΛΕΒΙΑΘΑΝ ${data.year || new Date().getFullYear()}${String(data.credits || '').trim() ? ' · ' + String(data.credits).trim().replace(/[\s,·–—-]*\b(19|20)\d{2}\s*$/, '') : ''}`}>
        <input style={S.input} value={data.credits} onChange={set('credits')} placeholder="π.χ. Σπύρος Μητσέλος" />
      </Field>
      {!isCw && kind !== 'para' && kind !== 'sort' && <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <label style={S.check}><input type="checkbox" checked={!!data.shuffleQs} onChange={set('shuffleQs')} /> Ανακάτεμα σειράς ερωτήσεων</label>
        <label style={S.check}><input type="checkbox" checked={!!data.shuffleOpts} onChange={set('shuffleOpts')} /> Ανακάτεμα επιλογών (πολλαπλής)</label>
      </div>}
    </div>
  );
}

function DeckForm({ deck, index, upd, onDelete, onOpenQs, isCw, kind, count }) {
  const set = (k) => (e) => { const v = e.target.value; upd((d) => { d[k] = v; }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormTitle eyebrow={'Ενότητα ' + String(index + 1).padStart(2, '0')} title="Η κάρτα της ενότητας στην αρχική οθόνη" />
      <Field label="Ετικέτα κάρτας" hint={isCw ? 'π.χ. Ενότητα 1 — εμφανίζεται και πάνω αριστερά στη διάρκεια του σταυρόλεξου.' : (kind === 'para' || kind === 'sort') ? 'π.χ. Ενότητα 1 — εμφανίζεται και πάνω αριστερά στη διάρκεια της άσκησης.' : 'π.χ. Κείμενο 1 — εμφανίζεται και πάνω αριστερά στη διάρκεια του κουίζ.'}>
        <input style={S.input} value={deck.label} onChange={set('label')} autoFocus />
      </Field>
      <Field label="Τίτλος (πλάγια γράμματα)">
        <input style={S.input} value={deck.ktitle} onChange={set('ktitle')} placeholder="π.χ. «Ήμουν χαμένος σε εικονικό κόσμο»" />
      </Field>
      <Field label="Συγγραφέας / πηγή">
        <input style={S.input} value={deck.author} onChange={set('author')} placeholder="π.χ. Γιάννης Παπαδόπουλος" />
      </Field>
      <Field label="Θεματικοί άξονες">
        <input style={S.input} value={deck.sub} onChange={set('sub')} placeholder="π.χ. Αφήγηση · Μαρτυρία · Άποψη ειδικών" />
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <button style={S.btnPrimary} onClick={onOpenQs}>{isCw ? `Στις λέξεις (${count}) →` : kind === 'para' ? `Στις παραγράφους (${count}) →` : kind === 'sort' ? `Στις ασκήσεις (${count}) →` : `Στις ερωτήσεις (${count}) →`}</button>
        <div style={{ flex: 1 }} />
        <button style={{ ...S.btnGhost, color: C.bad, borderColor: 'rgba(196,74,61,.35)' }} onClick={onDelete}>Διαγραφή ενότητας</button>
      </div>
    </div>
  );
}

// Σταυρόλεξο: λέξεις και ορισμοί μιας ενότητας
function CwWordsForm({ deck, index, upd, unplaced }) {
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const probs = problemsOfCw(deck);
  const setW = (i, k, v) => upd((d) => { d.words[i][k] = v; });
  const add = () => upd((d) => { d.words.push(newWord()); });
  const del = (i) => upd((d) => { d.words.splice(i, 1); if (!d.words.length) d.words.push(newWord()); });
  // Επικόλληση λίστας: «λέξη — ορισμός», «λέξη: ορισμός» ή λέξη<Tab>ορισμός, μία ανά γραμμή
  const importPaste = () => {
    const rows = paste.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.+?)\s*(?:\t|\s[—–-]\s|:)\s*(.+)$/);
      return m ? { w: m[1].trim(), c: m[2].trim() } : { w: l, c: '' };
    });
    if (!rows.length) return;
    upd((d) => { d.words = d.words.filter((x) => String(x.w).trim() || String(x.c).trim()).concat(rows); });
    setPaste(''); setShowPaste(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormTitle eyebrow={'Ενότητα ' + String(index + 1).padStart(2, '0') + ' · Σταυρόλεξο'} title="Λέξεις και ορισμοί" />
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginTop: -6 }}>
        Γράψε κάθε λέξη και τον ορισμό της. Η λέξη μπορεί να γραφτεί με πεζά και τόνους — στο σταυρόλεξο μπαίνει με <b>κεφαλαία χωρίς τόνους</b>.
        Το πλέγμα στήνεται αυτόματα (δες την προεπισκόπηση). Προτείνονται 8–20 λέξεις.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deck.words.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 22, paddingTop: 10, fontWeight: 700, color: C.purpleLight, fontSize: 13, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            <input style={{ ...S.input, width: '34%', minWidth: 0, flexShrink: 0, fontWeight: 600 }} value={x.w} placeholder="λέξη" onChange={(e) => setW(i, 'w', e.target.value)} />
            <textarea style={{ ...S.input, flex: 1, minWidth: 0 }} rows={Math.min(5, Math.max(1, Math.ceil(String(x.c || '').length / 38)))} value={x.c} placeholder="ορισμός / ερώτηση"
              onChange={(e) => setW(i, 'c', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (i === deck.words.length - 1) add(); } }} />
            <IconBtn danger title="Διαγραφή" onClick={() => del(i)}>✕</IconBtn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={S.btnGhost} onClick={add}>＋ Λέξη</button>
        <button style={S.btnGhost} onClick={() => setShowPaste((v) => !v)}>📋 Επικόλληση λίστας</button>
        <div style={{ flex: 1 }} />
        <button style={S.btnGhost} onClick={() => upd((d) => { d.seed = ((d.seed | 0) || 1) + 1; })} title="Άλλη τοποθέτηση των λέξεων στο πλέγμα">🔀 Νέα διάταξη πλέγματος</button>
      </div>
      {showPaste && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(107,63,160,.04)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12.5, color: C.muted }}>Μία λέξη ανά γραμμή: <b>λέξη — ορισμός</b> ή <b>λέξη: ορισμός</b> (ή αντιγραφή δύο στηλών από Excel/Sheets).</div>
          <textarea style={{ ...S.input, minHeight: 120 }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'μεταφορά — Σχήμα λόγου που…\nπαρομοίωση: Σύγκριση με το «σαν»'} />
          <div><button style={S.btnPrimarySm} onClick={importPaste} disabled={!paste.trim()}>Προσθήκη στη λίστα</button></div>
        </div>
      )}
      {unplaced.length > 0 && (
        <div style={{ background: '#fff7e0', border: `1px solid ${C.gold}`, borderRadius: 8, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
          ⚠ Δεν χώρεσαν στο πλέγμα: <b>{unplaced.join(', ')}</b>. Πάτησε «Νέα διάταξη πλέγματος», ή άλλαξε/πρόσθεσε λέξεις με κοινά γράμματα.
        </div>
      )}
      {probs.length > 0 && (
        <div style={{ background: 'rgba(196,74,61,.06)', borderLeft: `3px solid ${C.bad}`, padding: '10px 14px', borderRadius: 6, fontSize: 13.5, color: C.bad, lineHeight: 1.6 }}>
          {probs.map((m, i) => <div key={i}>• {m}</div>)}
        </div>
      )}
    </div>
  );
}

// Αναδιάταξη: μία παράγραφος (περίοδοι με τη ΣΩΣΤΗ σειρά, μία ανά γραμμή)
function ParaForm({ x, index, total, setP, onUp, onDown, onDup, onDel, onPrev, onNext }) {
  const probs = problemsOfPara(x);
  const text = (x.lines || []).join('\n');
  const [whole, setWhole] = useState('');
  const doSplit = () => { const parts = splitSentences(whole); if (parts.length) { setP({ lines: parts }); setWhole(''); } };
  const n = paraLines(x).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <FormTitle eyebrow={`Παράγραφος ${index + 1} / ${total}`} title="Αναδιάταξη παραγράφου" />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn title="Πάνω" onClick={onUp} disabled={index === 0}>↑</IconBtn>
          <IconBtn title="Κάτω" onClick={onDown} disabled={index === total - 1}>↓</IconBtn>
          <IconBtn title="Αντίγραφο" onClick={onDup}>⧉</IconBtn>
          <IconBtn title="Διαγραφή" onClick={onDel} danger>🗑</IconBtn>
        </div>
      </div>
      <Field label="Τίτλος (προαιρετικός)" hint="π.χ. το θέμα της παραγράφου — εμφανίζεται στην αριστερή στήλη.">
        <input style={S.input} value={x.title} onChange={(e) => setP({ title: e.target.value })} placeholder="π.χ. Η αξία της ανάγνωσης" />
      </Field>
      <Field label="Πηγή (προαιρετική)">
        <input style={S.input} value={x.src} onChange={(e) => setP({ src: e.target.value })} placeholder="π.χ. Κείμενο 3, Νεοελληνική Γλώσσα Β΄ Λυκείου" />
      </Field>
      <div style={{ background: 'rgba(107,63,160,.04)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Γρήγορα: επικόλλησε όλη την παράγραφο</div>
        <textarea style={{ ...S.input, minHeight: 70, fontFamily: 'Literata,serif', fontSize: 14.5 }} value={whole} onChange={(e) => setWhole(e.target.value)} placeholder="Επικόλλησε εδώ την παράγραφο όπως είναι στο κείμενο…" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={S.btnPrimarySm} onClick={doSplit} disabled={!whole.trim()}>✂ Χωρισμός σε περιόδους</button>
          <span style={{ fontSize: 12, color: C.muted }}>Χωρίζει σε κάθε τελεία, ερωτηματικό, θαυμαστικό. Έλεγξε το αποτέλεσμα από κάτω (π.χ. συντομογραφίες όπως «π.χ.»).</span>
        </div>
      </div>
      <Field label={`Περίοδοι με τη ΣΩΣΤΗ σειρά — μία ανά γραμμή (${n})`} hint="Ο μαθητής θα τις δει ανακατεμένες. Αλλαγή γραμμής = νέα περίοδος.">
        <textarea style={{ ...S.input, minHeight: 200, fontFamily: 'Literata,serif', fontSize: 15, lineHeight: 1.6 }} value={text}
          onChange={(e) => setP({ lines: e.target.value.split('\n') })} placeholder={'Θεματική περίοδος…\nΠρώτη λεπτομέρεια…\nΔεύτερη λεπτομέρεια…\nΚατακλείδα…'} />
      </Field>
      <label style={S.check}><input type="checkbox" checked={!!x.fixFirst} onChange={(e) => setP({ fixFirst: e.target.checked })} /> Η πρώτη περίοδος (θεματική) μένει σταθερή στη θέση της — πιο εύκολη άσκηση</label>
      <Field label="Σχόλιο μετά τη λύση (προαιρετικό)" hint="π.χ. ποιες διαρθρωτικές λέξεις δείχνουν τη σειρά.">
        <textarea style={{ ...S.input, minHeight: 60 }} value={x.fb} onChange={(e) => setP({ fb: e.target.value })} placeholder="π.χ. Θεματική περίοδος → «Αρχικά» → «Επιπλέον» → «Έτσι» → κατακλείδα «Συνεπώς»." />
      </Field>
      {probs.length > 0 && (
        <div style={{ background: 'rgba(196,74,61,.06)', borderLeft: `3px solid ${C.bad}`, padding: '10px 14px', borderRadius: 6, fontSize: 13.5, color: C.bad }}>
          {probs.map((m, i) => <div key={i}>• {m}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <button style={S.btnGhost} onClick={onPrev} disabled={index === 0}>← Προηγούμενη</button>
        <div style={{ flex: 1 }} />
        <button style={S.btnPrimary} onClick={onNext}>{index < total - 1 ? 'Επόμενη →' : '＋ Νέα παράγραφος'}</button>
      </div>
    </div>
  );
}

// Ταξινόμηση: μία άσκηση (κατηγορίες με τα στοιχεία τους)
function SortItemForm({ x, index, total, setP, onUp, onDown, onDup, onDel, onPrev, onNext }) {
  const probs = problemsOfSort(x);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <FormTitle eyebrow={`Άσκηση ${index + 1} / ${total}`} title="Ταξινόμηση σε κατηγορίες" />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn title="Πάνω" onClick={onUp} disabled={index === 0}>↑</IconBtn>
          <IconBtn title="Κάτω" onClick={onDown} disabled={index === total - 1}>↓</IconBtn>
          <IconBtn title="Αντίγραφο" onClick={onDup}>⧉</IconBtn>
          <IconBtn title="Διαγραφή" onClick={onDel} danger>🗑</IconBtn>
        </div>
      </div>
      <Field label="Τίτλος (προαιρετικός)" hint="Εμφανίζεται στην αριστερή στήλη· αν μείνει κενός, μπαίνουν τα ονόματα των κατηγοριών.">
        <input style={S.input} value={x.title} onChange={(e) => setP({ title: e.target.value })} placeholder="π.χ. Είδη επιρρηματικών προτάσεων" />
      </Field>
      <Field label="Πηγή (προαιρετική)">
        <input style={S.input} value={x.src} onChange={(e) => setP({ src: e.target.value })} placeholder="π.χ. Κείμενο 3, Νεοελληνική Γλώσσα Β΄ Λυκείου" />
      </Field>
      <SortFields q={x} setQ={setP} />
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: -6 }}>Σύνολο στοιχείων: <b>{sortCount(x)}</b> · προτείνονται 6–20 ανά άσκηση.</div>
      <Field label="Σχόλιο μετά τη λύση (προαιρετικό)" hint="π.χ. ποιες λέξεις-κλειδιά βοηθούν στην ταξινόμηση.">
        <textarea style={{ ...S.input, minHeight: 60 }} value={x.fb} onChange={(e) => setP({ fb: e.target.value })} placeholder="π.χ. Αιτιολογικές: επειδή, αφού, γιατί · Τελικές: για να, να · Χρονικές: όταν, μόλις." />
      </Field>
      {probs.length > 0 && (
        <div style={{ background: 'rgba(196,74,61,.06)', borderLeft: `3px solid ${C.bad}`, padding: '10px 14px', borderRadius: 6, fontSize: 13.5, color: C.bad }}>
          {probs.map((m, i) => <div key={i}>• {m}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <button style={S.btnGhost} onClick={onPrev} disabled={index === 0}>← Προηγούμενη</button>
        <div style={{ flex: 1 }} />
        <button style={S.btnPrimary} onClick={onNext}>{index < total - 1 ? 'Επόμενη →' : '＋ Νέα άσκηση'}</button>
      </div>
    </div>
  );
}

// ── Πεδία των νέων τύπων ερώτησης του κουίζ ──
function OrderFields({ q, setQ }) {
  const [whole, setWhole] = useState('');
  const n = (q.lines || []).filter((l) => String(l).trim()).length;
  return (
    <>
      <div style={{ background: 'rgba(107,63,160,.04)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Γρήγορα: επικόλλησε όλη την παράγραφο</div>
        <textarea style={{ ...S.input, minHeight: 60, fontFamily: 'Literata,serif', fontSize: 14.5 }} value={whole} onChange={(e) => setWhole(e.target.value)} placeholder="Επικόλλησε εδώ την παράγραφο…" />
        <div><button style={S.btnPrimarySm} disabled={!whole.trim()} onClick={() => { const parts = splitSentences(whole); if (parts.length) { setQ({ lines: parts }); setWhole(''); } }}>✂ Χωρισμός σε περιόδους</button></div>
      </div>
      <Field label={`Περίοδοι με τη ΣΩΣΤΗ σειρά — μία ανά γραμμή (${n})`} hint="Ο μαθητής τις βλέπει ανακατεμένες. Μέσα στο κουίζ προτείνονται 3–8 περίοδοι.">
        <textarea style={{ ...S.input, minHeight: 150, fontFamily: 'Literata,serif', fontSize: 15, lineHeight: 1.6 }} value={(q.lines || []).join('\n')} onChange={(e) => setQ({ lines: e.target.value.split('\n') })} />
      </Field>
      <label style={S.check}><input type="checkbox" checked={!!q.fixFirst} onChange={(e) => setQ({ fixFirst: e.target.checked })} /> Η πρώτη περίοδος (θεματική) μένει σταθερή</label>
    </>
  );
}
function SortFields({ q, setQ }) {
  const cats = q.cats || [];
  const setCat = (i, patch) => setQ({ cats: cats.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <Field label="Κατηγορίες και τα στοιχεία τους" hint="Ένα στοιχείο ανά γραμμή. Ο μαθητής τα βλέπει όλα ανακατεμένα και τα βάζει στη σωστή κατηγορία. Προτείνονται 2–4 κατηγορίες.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        {cats.map((c, i) => (
          <div key={i} style={{ border: `1.5px solid ${C.line}`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: '#fff' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...S.input, fontWeight: 700 }} value={c.name} placeholder={`Κατηγορία ${i + 1}`} onChange={(e) => setCat(i, { name: e.target.value })} />
              <IconBtn danger title="Διαγραφή κατηγορίας" disabled={cats.length <= 2} onClick={() => setQ({ cats: cats.filter((_, j) => j !== i) })}>✕</IconBtn>
            </div>
            <textarea style={{ ...S.input, minHeight: 90 }} value={(c.items || []).join('\n')} placeholder={'στοιχείο 1\nστοιχείο 2'} onChange={(e) => setCat(i, { items: e.target.value.split('\n') })} />
          </div>
        ))}
      </div>
      {cats.length < 5 && <div><button style={{ ...S.btnGhost, fontSize: 13 }} onClick={() => setQ({ cats: [...cats, { name: '', items: [''] }] })}>＋ Κατηγορία</button></div>}
    </Field>
  );
}
function MiniCwFields({ q, setQ }) {
  const words = q.words || [];
  const setW = (i, k, v) => setQ({ words: words.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  return (
    <Field label={`Λέξεις και ορισμοί (${words.filter((x) => String(x.w || '').trim()).length})`} hint="Το πλέγμα στήνεται αυτόματα. Μέσα στο κουίζ προτείνονται 3–8 λέξεις· για μεγαλύτερα υπάρχει το πρότυπο «Σταυρόλεξα ενοτήτων».">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {words.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...S.input, width: '34%', minWidth: 0, flexShrink: 0, fontWeight: 600 }} value={x.w} placeholder="λέξη" onChange={(e) => setW(i, 'w', e.target.value)} />
            <input style={{ ...S.input, flex: 1, minWidth: 0 }} value={x.c} placeholder="ορισμός" onChange={(e) => setW(i, 'c', e.target.value)} />
            <IconBtn danger title="Διαγραφή" onClick={() => setQ({ words: words.length > 1 ? words.filter((_, j) => j !== i) : [{ w: '', c: '' }] })}>✕</IconBtn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button style={{ ...S.btnGhost, fontSize: 13 }} onClick={() => setQ({ words: [...words, { w: '', c: '' }] })}>＋ Λέξη</button>
        <button style={{ ...S.btnGhost, fontSize: 13 }} onClick={() => setQ({ seed: ((q.seed | 0) || 1) + 1 })}>🔀 Νέα διάταξη πλέγματος</button>
      </div>
    </Field>
  );
}

function QuestionForm({ adv, q, index, total, setQ, changeType, onUp, onDown, onDup, onDel, onPrev, onNext }) {
  const probs = problemsOf(q);
  const taRef = useRef(null);
  const wrapSel = () => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    if (a === b) { alert('Επίλεξε πρώτα (σέρνοντας με το ποντίκι ή το δάχτυλο) τη λέξη ή φράση μέσα στο κείμενο.'); return; }
    const pick = value.slice(a, b);
    const lead = pick.match(/^\s*/)[0], trail = pick.match(/\s*$/)[0];
    const core = pick.trim();
    if (!core) return;
    setQ({ text: value.slice(0, a) + lead + '[' + core + ']' + trail + value.slice(b) });
    setTimeout(() => { ta.focus(); }, 0);
  };
  const clearMarks = () => setQ({ text: q.text.replace(/\[([^\]|]+)(\|[^\]]*)?\]/g, '$1') });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <FormTitle eyebrow={`Ερώτηση ${index + 1} / ${total}`} title={typeOf(q.t).label} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn title="Πάνω" onClick={onUp} disabled={index === 0}>↑</IconBtn>
          <IconBtn title="Κάτω" onClick={onDown} disabled={index === total - 1}>↓</IconBtn>
          <IconBtn title="Αντίγραφο" onClick={onDup}>⧉</IconBtn>
          <IconBtn title="Διαγραφή" onClick={onDel} danger>🗑</IconBtn>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TYPES.map((t) => (
          <button key={t.t} onClick={() => changeType(t.t)} style={{ ...S.typeChip, ...(q.t === t.t ? S.typeChipOn : {}) }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <Field label={q.t === 'tf' ? 'Πρόταση προς κρίση' : (q.t === 'gap' || q.t === 'click') ? 'Οδηγία (αριστερή στήλη)' : 'Εκφώνηση'}
        hint={q.t === 'click' ? 'π.χ. «Επίλεξε τα ρήματα σε παθητική φωνή»' : null}>
        <textarea style={{ ...S.input, minHeight: 64, fontFamily: 'Literata,serif', fontSize: 15 }} value={q.q} onChange={(e) => setQ({ q: e.target.value })} autoFocus={!q.q} />
      </Field>

      {/* ── Πολλαπλής ── */}
      {q.t === 'mcq' && (
        <Field label="Επιλογές" hint="Πάτησε τον κύκλο για να ορίσεις τη σωστή.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.opts.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setQ({ ans: i })} title="Σωστή"
                  style={{ ...S.radio, ...(q.ans === i ? S.radioOn : {}) }}>{q.ans === i ? '✓' : LABS[i]}</button>
                <input style={{ ...S.input, ...(q.ans === i ? { borderColor: C.ok, background: 'rgba(45,142,78,.05)' } : {}) }} value={o}
                  onChange={(e) => { const a = [...q.opts]; a[i] = e.target.value; setQ({ opts: a }); }} placeholder={'Επιλογή ' + LABS[i]} />
                <IconBtn title="Αφαίρεση" disabled={q.opts.length <= 2} onClick={() => {
                  const a = q.opts.filter((_, k) => k !== i);
                  setQ({ opts: a, ans: q.ans === i ? 0 : q.ans > i ? q.ans - 1 : q.ans, ...(Array.isArray(q.fbs) ? { fbs: q.fbs.filter((_, k) => k !== i) } : {}) });
                }}>✕</IconBtn>
              </div>
            ))}
            {q.opts.length < 6 && <button style={{ ...S.btnGhost, alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setQ({ opts: [...q.opts, ''] })}>＋ Επιλογή</button>}
          </div>
        </Field>
      )}

      {/* ── Σωστό / Λάθος ── */}
      {q.t === 'tf' && (
        <>
          <Field label="Μορφή κουμπιών">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['Σωστό', 'Λάθος'], ['Ναι', 'Όχι']].map((l) => (
                <button key={l[0]} onClick={() => setQ({ labels: l })} style={{ ...S.typeChip, ...(q.labels[0] === l[0] ? S.typeChipOn : {}) }}>{l[0]} / {l[1]}</button>
              ))}
            </div>
          </Field>
          <Field label="Σωστή απάντηση">
            <div style={{ display: 'flex', gap: 8 }}>
              {q.labels.map((l, i) => (
                <button key={i} onClick={() => setQ({ ans: i })}
                  style={{ ...S.bigChoice, ...(q.ans === i ? { background: C.ok, color: '#fff', borderColor: C.ok } : {}) }}>{q.ans === i ? '✓ ' : ''}{l}</button>
              ))}
            </div>
          </Field>
        </>
      )}

      {/* ── Αντιστοίχιση ── */}
      {q.t === 'drag' && (
        <Field label="Ζεύγη" hint="Αριστερά η σταθερή θέση (κατηγορία/όρος), δεξιά το στοιχείο που σέρνει ο μαθητής. Ίδια ετικέτα σε δύο θέσεις = κοινή κατηγορία.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.tgts.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1.4fr 30px', gap: 6, alignItems: 'center' }}>
                <input style={{ ...S.input, fontWeight: 700 }} value={t} placeholder={'Θέση ' + (i + 1)}
                  onChange={(e) => { const a = [...q.tgts]; a[i] = e.target.value; setQ({ tgts: a }); }} />
                <span style={{ textAlign: 'center', color: C.purpleLight }}>⇄</span>
                <input style={S.input} value={q.items[i]} placeholder="Στοιχείο"
                  onChange={(e) => { const a = [...q.items]; a[i] = e.target.value; setQ({ items: a }); }} />
                <IconBtn title="Αφαίρεση" disabled={q.tgts.length <= 2} onClick={() => {
                  const tg = q.tgts.filter((_, k) => k !== i), it = q.items.filter((_, k) => k !== i);
                  setQ({ tgts: tg, items: it, ans: tg.map((_, k) => k) });
                }}>✕</IconBtn>
              </div>
            ))}
            {q.tgts.length < 8 && <button style={{ ...S.btnGhost, alignSelf: 'flex-start', fontSize: 13 }}
              onClick={() => setQ({ tgts: [...q.tgts, ''], items: [...q.items, ''], ans: [...q.tgts, ''].map((_, k) => k) })}>＋ Ζεύγος</button>}
          </div>
        </Field>
      )}

      {/* ── Κενά / Επιλογή λέξεων ── */}
      {(q.t === 'gap' || q.t === 'click') && (
        <Field label="Κείμενο"
          hint={q.t === 'gap'
            ? 'Βάλε κάθε σωστή απάντηση σε [αγκύλες] — γίνεται κενό. Εναλλακτικές αποδεκτές: [πυκνό|δύσκολο].'
            : 'Βάλε σε [αγκύλες] τις λέξεις ή φράσεις που πρέπει να επιλέξει ο μαθητής. Όλες οι άλλες λέξεις είναι επίσης πατήσιμες.'}>
          <textarea ref={taRef} style={{ ...S.input, minHeight: 120, fontFamily: 'Literata,serif', fontSize: 15, lineHeight: 1.7 }}
            value={q.text} onChange={(e) => setQ({ text: e.target.value })} placeholder={q.t === 'gap' ? 'Η ονοματοποίηση κάνει τον λόγο πιο [πυκνό].' : 'Ο Θανάσης [έπαιζε] κάθε βράδυ και [ξεχνούσε] τον χρόνο.'} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button style={S.btnPrimarySm} onMouseDown={(e) => e.preventDefault()} onClick={wrapSel}>
              [ ] {q.t === 'gap' ? 'Κάνε κενό την επιλεγμένη λέξη' : 'Σημείωσε ως σωστή'}
            </button>
            {marked(q.text).length > 0 && <button style={S.btnGhostSm} onClick={clearMarks}>Καθάρισμα αγκυλών</button>}
            <span style={{ fontSize: 12.5, color: C.muted, alignSelf: 'center' }}>
              {marked(q.text).length} {q.t === 'gap' ? 'κενά' : 'σωστές'}: {marked(q.text).map((m) => m.split('|')[0]).join(' · ')}
            </span>
          </div>
        </Field>
      )}
      {q.t === 'gap' && (
        <>
          <Field label="Τρόπος απάντησης">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setQ({ mode: 'type' })} style={{ ...S.typeChip, ...(q.mode !== 'select' ? S.typeChipOn : {}) }}>⌨ Πληκτρολόγηση</button>
              <button onClick={() => setQ({ mode: 'select' })} style={{ ...S.typeChip, ...(q.mode === 'select' ? S.typeChipOn : {}) }}>▾ Επιλογή από λίστα</button>
            </div>
          </Field>
          {q.mode === 'select' && (
            <Field label="Παραπλανητικές λέξεις στη λίστα" hint="Χωρισμένες με κόμμα. Η λίστα κάθε κενού περιέχει όλες τις σωστές + αυτές.">
              <input style={S.input} value={(q.distractors || []).join(', ')} onChange={(e) => setQ({ distractors: e.target.value.split(',') })} placeholder="π.χ. αραιό, απλό" />
            </Field>
          )}
          {q.mode !== 'select' && (
            <label style={S.check}><input type="checkbox" checked={!!q.strict} onChange={(e) => setQ({ strict: e.target.checked })} />
              Αυστηρός έλεγχος τόνων (αλλιώς το «πυκνο» μετρά σωστό)</label>
          )}
        </>
      )}

      {/* ── Αναδιάταξη ── */}
      {q.t === 'order' && <OrderFields q={q} setQ={setQ} />}
      {/* ── Ταξινόμηση ── */}
      {q.t === 'sort' && <SortFields q={q} setQ={setQ} />}
      {/* ── Μικρό σταυρόλεξο ── */}
      {q.t === 'cw' && <MiniCwFields q={q} setQ={setQ} />}

      {adv && <Field label="Βαθμός δυσκολίας (προαιρετικός)" hint="Ο μαθητής μπορεί να διαλέξει δυσκολία στην αρχική οθόνη· το ίδιο φίλτρο υπάρχει και στην εκτύπωση.">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <button key={v} onClick={() => setQ({ diff: v || undefined })} title={v ? 'Βαθμός ' + v : 'Χωρίς βαθμό'}
              style={{ ...S.typeChip, ...((+q.diff || 0) === v ? S.typeChipOn : {}) }}>{v ? `${v} ${'●'.repeat(v)}` : '—'}</button>
          ))}
        </div>
      </Field>}

      <details style={{ background: 'rgba(107,63,160,.04)', borderRadius: 10, padding: '10px 14px' }} open={!!(q.fbC || q.fbW || q.ref || (Array.isArray(q.fbs) && q.fbs.some((x) => String(x || '').trim())))}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: C.purple }}>Ανατροφοδότηση / διόρθωση (προαιρετικά)</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <Field label="✓ Σχόλιο όταν απαντά σωστά" hint="Κενό → «Σωστά!»">
            <textarea style={{ ...S.input, minHeight: 50 }} value={q.fbC} onChange={(e) => setQ({ fbC: e.target.value })} />
          </Field>
          <Field label="✗ Σχόλιο / διόρθωση όταν απαντά λάθος" hint="Κενό → εμφανίζεται αυτόματα η σωστή απάντηση.">
            <textarea style={{ ...S.input, minHeight: 50 }} value={q.fbW} onChange={(e) => setQ({ fbW: e.target.value })} />
          </Field>
          {adv && q.t === 'mcq' && (
            <Field label="Σχόλιο για κάθε επιλογή (προαιρετικό)" hint="Εμφανίζεται όταν ο μαθητής διαλέξει τη συγκεκριμένη επιλογή· όπου είναι κενό, ισχύουν τα παραπάνω σχόλια.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.opts.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, paddingTop: 9, fontWeight: 700, color: q.ans === i ? C.ok : C.purple }}>{LABS[i]}</span>
                    <textarea style={{ ...S.input, minHeight: 40 }} value={(q.fbs || [])[i] || ''} placeholder={o ? 'Αν διαλέξει: ' + o : ''}
                      onChange={(e) => { const a = q.opts.map((_, k) => (q.fbs || [])[k] || ''); a[i] = e.target.value; setQ({ fbs: a }); }} />
                  </div>
                ))}
              </div>
            </Field>
          )}
          <Field label="Παραπομπή (μικρά πλάγια, κάτω από το σχόλιο)">
            <input style={S.input} value={q.ref} onChange={(e) => setQ({ ref: e.target.value })} placeholder="π.χ. Κείμενο 1 · Ερ. 3 · Κριτήριο εθισμού" />
          </Field>
        </div>
      </details>

      {probs.length > 0 && (
        <div style={{ background: 'rgba(196,74,61,.07)', borderLeft: `3px solid ${C.bad}`, padding: '8px 12px', borderRadius: 6, fontSize: 13, color: C.bad }}>
          {probs.map((p) => <div key={p}>• {p}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <button style={S.btnGhost} onClick={onPrev} disabled={index === 0}>← Προηγούμενη</button>
        <div style={{ flex: 1 }} />
        <button style={S.btnPrimary} onClick={onNext}>{index < total - 1 ? 'Επόμενη →' : '＋ Νέα ερώτηση ίδιου τύπου'}</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Αποθήκευση
// ═════════════════════════════════════════════════════════════════
function SaveDialog({ data, problems, editing, drive, status, token, onClose, onGo, getHtml, onSaved, onLogin, defaultFolder, itemLbl = 'Ερ.' }) {
  const [name, setName] = useState(editing?.name || withHtml(safeName(data.title)));
  const [mode, setMode] = useState(editing ? 'overwrite' : 'new');
  // Προεπιλογή: ο φάκελος της εφαρμογής ή ο υποφάκελος από όπου ξεκίνησε (?folder=)
  const [folderId, setFolderId] = useState(editing?.folderId || defaultFolder || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  // Νέα αρχεία μπαίνουν ΜΟΝΟ στον φάκελο «Εφαρμογές» ή σε υποφάκελό του
  useEffect(() => {
    if (!drive?.appsFolderId) return;
    const allowed = [drive.appsFolderId, ...drive.appsSub.map((s) => s.id)];
    if (!allowed.includes(folderId)) setFolderId(drive.appsFolderId);
  }, [drive, folderId]);

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([getHtml()], { type: 'text/html' }));
    a.download = withHtml(safeName(name.replace(/\.html?$/i, '')));
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const html = getHtml();
      const fname = withHtml(safeName(name.replace(/\.html?$/i, '')));
      const auth = { Authorization: 'Bearer ' + token };
      let doc, fid = folderId;
      if (mode === 'overwrite' && editing) {
        // Αντικατάσταση περιεχομένου του ίδιου αρχείου (ίδιο id → οι σύνδεσμοι/QR μένουν ίδιοι)
        const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(editing.id)}?uploadType=media&fields=id,name,mimeType`,
          { method: 'PATCH', headers: { ...auth, 'Content-Type': 'text/html; charset=UTF-8' }, body: new Blob([html], { type: 'text/html' }) });
        doc = await r.json();
        if (!doc.id) throw new Error(doc.error?.message || 'αποτυχία ενημέρωσης');
        if (fname !== editing.name) {
          const r2 = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(editing.id)}?fields=id,name,mimeType`,
            { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fname }) });
          const d2 = await r2.json(); if (d2.id) doc = d2;
        }
        fid = editing.folderId;
      } else {
        if (!fid) throw new Error('Διάλεξε φάκελο.');
        const metadata = { name: fname, mimeType: 'text/html', parents: [fid] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([html], { type: 'text/html' }));
        const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', { method: 'POST', headers: auth, body: form });
        doc = await r.json();
        if (!doc.id) throw new Error(doc.error?.message || 'αποτυχία ανεβάσματος');
      }
      // Εγγραφή στο μητρώο του ΛΕΒΙΑΘΑΝ → εμφανίζεται στις Εφαρμογές / στον φάκελο
      const rr = await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ id: doc.id, name: doc.name, mimeType: doc.mimeType || 'text/html', folderId: fid }] }) });
      if (!rr.ok) throw new Error('το αρχείο ανέβηκε, αλλά δεν καταχωρίστηκε στον ΛΕΒΙΑΘΑΝ');
      const ed = { id: doc.id, name: doc.name, folderId: fid };
      onSaved(ed); setDone(ed); setMode('overwrite');
    } catch (e) { setErr(e.message || 'Σφάλμα'); }
    setBusy(false);
  };

  const folderLabel = (id) => {
    if (!drive) return '';
    if (id === drive.appsFolderId) return '⚡ Εφαρμογές';
    const s = drive.appsSub.find((x) => x.id === id); if (s) return '⚡ Εφαρμογές › ' + s.name;
    const f = drive.folders.find((x) => x.id === id); return f ? '📁 ' + f.name : '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,16,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }} onClick={onClose}>
      <div style={{ ...S.card, width: 'min(560px,100%)', maxHeight: '92vh', overflowY: 'auto', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <FormTitle eyebrow="Αποθήκευση" title={done ? 'Η εφαρμογή αποθηκεύτηκε' : 'Στον ΛΕΒΙΑΘΑΝ (Google Drive)'} />

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div style={{ background: 'rgba(45,142,78,.09)', borderLeft: `3px solid ${C.ok}`, padding: '10px 14px', borderRadius: 6, fontSize: 14, lineHeight: 1.55 }}>
              ✓ <b>{done.name}</b> στο <b>{folderLabel(done.folderId) || 'φάκελο'}</b>.<br />
              Από τον ΛΕΒΙΑΘΑΝ τη μοιράζεις, βγάζεις QR ή την ανοίγεις σε Live, όπως κάθε εφαρμογή.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/" style={{ ...S.btnPrimary, textDecoration: 'none' }}>Στον ΛΕΒΙΑΘΑΝ →</a>
              <button style={S.btnGhost} onClick={onClose}>Συνέχεια επεξεργασίας</button>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Οι επόμενες αποθηκεύσεις ενημερώνουν το ίδιο αρχείο, οπότε σύνδεσμοι και QR δεν αλλάζουν.</div>
          </div>
        ) : problems.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Πριν την αποθήκευση, συμπλήρωσε {problems.length === 1 ? 'το εξής' : `τα εξής ${problems.length}`}:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {problems.slice(0, 40).map((p, i) => (
                <button key={i} onClick={() => onGo(p)} style={{ ...S.qItem, color: C.bad }}>
                  <span style={{ minWidth: 70, fontWeight: 700 }}>{p.d >= 0 ? (p.q >= 0 ? `Εν.${p.d + 1} · ${itemLbl}${p.q + 1}` : `Εν.${p.d + 1}`) : 'Γενικά'}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{p.m}</span><span>→</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={S.btnGhost} onClick={onClose}>Κλείσιμο</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <Field label="Όνομα αρχείου">
              <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {status !== 'authenticated' ? (
              <div style={{ fontSize: 14 }}>Για αποθήκευση στο Drive χρειάζεται σύνδεση (το πρόχειρο κρατιέται).{' '}
                <button style={{ ...S.btnPrimarySm, marginLeft: 6 }} onClick={onLogin}>Σύνδεση με Google</button></div>
            ) : (
              <>
                {editing && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setMode('overwrite')} style={{ ...S.typeChip, ...(mode === 'overwrite' ? S.typeChipOn : {}) }}>↻ Ενημέρωση του υπάρχοντος</button>
                    <button onClick={() => setMode('new')} style={{ ...S.typeChip, ...(mode === 'new' ? S.typeChipOn : {}) }}>＋ Ως νέο αρχείο</button>
                  </div>
                )}
                {mode === 'new' ? (
                  <Field label="Αποθήκευση στον φάκελο «Εφαρμογές»" hint={drive?.appsSub?.length ? 'Ή σε έναν από τους υποφακέλους του.' : null}>
                    {!drive ? <div style={{ color: C.muted }}>Φόρτωση φακέλων…</div> : (
                      <select style={S.input} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                        {drive.appsFolderId && <option value={drive.appsFolderId}>⚡ Εφαρμογές</option>}
                        {drive.appsSub.map((s) => <option key={s.id} value={s.id}>⚡ Εφαρμογές › {s.name}</option>)}
                      </select>
                    )}
                  </Field>
                ) : (
                  <div style={{ fontSize: 13.5, color: C.muted }}>Θα ενημερωθεί το «{editing.name}» στο {folderLabel(editing.folderId) || 'ίδιο φάκελο'}. Σύνδεσμοι και QR μένουν ίδιοι.</div>
                )}
              </>
            )}
            {err && <div style={{ color: C.bad, fontSize: 13.5 }}>✗ {err}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              {status === 'authenticated' && <button style={S.btnPrimary} onClick={save} disabled={busy || (mode === 'new' && !folderId)}>{busy ? 'Αποθήκευση…' : '💾 Αποθήκευση στο Drive'}</button>}
              <button style={S.btnGhost} onClick={download}>⬇ Λήψη .html</button>
              <div style={{ flex: 1 }} />
              <button style={S.linkBtn} onClick={onClose}>Άκυρο</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Μικρά δομικά στοιχεία
// ═════════════════════════════════════════════════════════════════
function Preview({ html, fill, onRestart, startMode, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'desk');
  const boxRef = useRef(null);
  const [w, setW] = useState(500);
  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(boxRef.current); return () => ro.disconnect();
  }, []);
  const vw = mode === 'desk' ? 1100 : 390, vh = mode === 'desk' ? 720 : 760;
  const scale = Math.min(1, w / vw);
  return (
    <div style={{ ...S.card, padding: 10, height: fill ? '100%' : 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ ...S.miniTitle, margin: 0, flex: 1 }}>Προεπισκόπηση</span>
        <button onClick={onRestart} style={{ ...S.typeChip, ...(startMode ? S.typeChipOn : {}), padding: '4px 10px' }} title="Αρχική οθόνη ή τρέχουσα ερώτηση">⌂ Αρχική</button>
        <button onClick={() => setMode('desk')} style={{ ...S.typeChip, ...(mode === 'desk' ? S.typeChipOn : {}), padding: '4px 10px' }}>🖥</button>
        <button onClick={() => setMode('mob')} style={{ ...S.typeChip, ...(mode === 'mob' ? S.typeChipOn : {}), padding: '4px 10px' }}>📱</button>
      </div>
      <div ref={boxRef} style={{ position: 'relative', width: '100%', height: fill ? '100%' : vh * scale, flex: fill ? 1 : 'none', overflow: 'hidden', borderRadius: 8, background: C.cream, border: `1px solid ${C.line}` }}>
        <iframe title="Προεπισκόπηση" srcDoc={html} sandbox="allow-scripts allow-modals"
          style={{ position: 'absolute', left: Math.max(0, (w - vw * scale) / 2), top: 0, width: vw, height: fill ? `${100 / scale}%` : vh, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', background: C.cream }} />
      </div>
    </div>
  );
}

function TemplateThumb({ kind, look }) {
  if (look === 'paper' || look === 'archaia') {
    const P = look === 'paper'
      ? { bg: '#FAF9F5', card: '#fff', line: '#E8E4DA', acc: '#C15F3C', ink: '#2B2A26', font: 'Georgia,serif', r: 10 }
      : { bg: '#F3E9D2', card: '#FBF5E6', line: '#D8C29A', acc: '#9E3B22', ink: '#2A211B', font: 'Georgia,serif', r: 2 };
    return (
      <div style={{ height: 150, background: P.bg, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
        {look === 'archaia' && <><div style={{ position: 'absolute', left: 12, right: 12, top: 12, height: 4, borderTop: '1px solid rgba(42,33,27,.45)', borderBottom: '1px solid rgba(42,33,27,.45)' }} />
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, height: 4, borderTop: '1px solid rgba(42,33,27,.45)', borderBottom: '1px solid rgba(42,33,27,.45)' }} /></>}
        <div style={{ position: 'absolute', left: '50%', top: 30, transform: 'translateX(-50%)', textAlign: 'center', fontFamily: P.font, color: P.ink, fontSize: 15, letterSpacing: look === 'archaia' ? 2 : 0, textTransform: look === 'archaia' ? 'uppercase' : 'none', whiteSpace: 'nowrap' }}>
          {look === 'archaia' ? 'Κουίζ' : <>Κουίζ <i style={{ color: P.acc }}>ενοτήτων</i></>}
          <div style={{ width: 30, height: 2, background: P.acc, margin: '6px auto 0' }} />
        </div>
        <div style={{ position: 'absolute', left: '50%', top: 72, transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
          {['01', '02', '03'].map((n, i) => (
            <div key={n} style={{ width: 62, height: 52, background: P.card, border: `1px solid ${i === 0 ? P.acc : P.line}`, borderRadius: P.r, boxShadow: '0 4px 12px rgba(26,22,16,.08)', padding: '6px 8px', position: 'relative', overflow: 'hidden' }}>
              {look === 'paper' && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: P.acc }} />}
              <div style={{ fontFamily: P.font, fontSize: 15, color: P.ink, opacity: .25 }}>{n}</div>
              <div style={{ height: 3, width: 34, background: P.acc, opacity: .6, marginTop: 4 }} />
              <div style={{ height: 3, width: 24, background: P.line, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'sort') {
    const bins = [['Α', ['▬▬', '▬▬▬']], ['Β', ['▬▬▬', '▬']], ['Γ', ['▬▬']]];
    return (
      <div style={{ height: 150, background: C.cream, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', left: -70, top: -80, background: C.gold }}>
          <div style={{ position: 'absolute', inset: '16%', borderRadius: '50%', background: '#F0C9A8' }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: '#D94F4F' }} /></div>
        </div>
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: -80, bottom: -100, background: `linear-gradient(135deg,${C.navy},${C.cyan})` }}>
          <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: C.cyan }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: C.gold }} /></div>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 6 }}>
          {bins.map(([h, items], i) => (
            <div key={i} style={{ width: 56, background: '#fff', borderRadius: 6, boxShadow: '2px 4px 12px rgba(26,22,16,.12)', border: '1.5px solid rgba(107,63,160,.18)', overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(135deg,${C.purple},${C.purpleDark})`, color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 5px' }}>{h}</div>
              <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 44 }}>
                {items.map((t, j) => <span key={j} style={{ fontSize: 7, color: C.purple, border: `1px solid ${C.purpleLight}`, borderRadius: 99, padding: '1px 4px', alignSelf: 'flex-start', letterSpacing: -1 }}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'para') {
    const rows = [['3', '75%', C.purpleLight], ['1', '90%', C.purple], ['4', '60%', C.purpleLight], ['2', '82%', C.purpleLight]];
    return (
      <div style={{ height: 150, background: C.cream, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', left: -70, top: -80, background: C.gold }}>
          <div style={{ position: 'absolute', inset: '16%', borderRadius: '50%', background: '#F0C9A8' }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: '#D94F4F' }} /></div>
        </div>
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: -80, bottom: -100, background: `linear-gradient(135deg,${C.navy},${C.cyan})` }}>
          <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: C.cyan }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: C.gold }} /></div>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 170, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(([n, w, col], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 6, padding: '5px 7px', boxShadow: '2px 4px 12px rgba(26,22,16,.12)', border: `1.5px solid ${i === 1 ? C.purple : 'rgba(107,63,160,.18)'}`, transform: i === 1 ? 'translateX(10px) rotate(-2deg)' : 'none' }}>
              <span style={{ fontSize: 10, color: C.purpleLight }}>⠿</span>
              <span style={{ fontFamily: 'Literata,serif', fontWeight: 700, fontSize: 11, color: C.purple }}>{n}</span>
              <span style={{ height: 4, width: w, background: col, opacity: .45, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'cw') {
    const cells = [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 2], [3, 4], [4, 1], [4, 2], [4, 3], [4, 4], [5, 4]];
    return (
      <div style={{ height: 150, background: C.cream, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', left: -70, top: -80, background: C.gold }}>
          <div style={{ position: 'absolute', inset: '16%', borderRadius: '50%', background: '#F0C9A8' }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: '#D94F4F' }} /></div>
        </div>
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: -80, bottom: -100, background: `linear-gradient(135deg,${C.navy},${C.cyan})` }}>
          <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: C.cyan }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: C.gold }} /></div>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 5 * 20, height: 6 * 20, transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 6, boxShadow: '2px 4px 14px rgba(26,22,16,.14)' }}>
          {cells.map(([r, c], i) => (
            <div key={i} style={{ position: 'absolute', left: c * 20, top: r * 20, width: 20, height: 20, border: `1.5px solid ${C.navy}`, background: r === 2 ? 'rgba(107,63,160,.18)' : '#fff', fontSize: 11, fontWeight: 700, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r === 2 ? 'ΛΕΞΗ!'[c] : ''}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ height: 150, background: C.cream, position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', left: -70, top: -80, background: C.gold }}>
        <div style={{ position: 'absolute', inset: '16%', borderRadius: '50%', background: '#F0C9A8' }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: '#D94F4F' }} /></div>
      </div>
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: -80, bottom: -100, background: `linear-gradient(135deg,${C.navy},${C.cyan})` }}>
        <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: C.cyan }}><div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: C.gold }} /></div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {['01', '02', '03'].map((n, i) => (
          <div key={n} style={{ width: 62, height: 78, background: '#fff', borderRadius: 6, boxShadow: '2px 4px 14px rgba(26,22,16,.14)', borderLeft: `3px solid ${C.purple}`, padding: 6, outline: i === 0 ? `2px solid ${C.purple}` : 'none' }}>
            <div style={{ fontFamily: 'Literata,serif', fontWeight: 700, fontSize: 18, color: C.purple, opacity: i === 0 ? .4 : .1 }}>{n}</div>
            <div style={{ height: 4, width: '70%', background: C.purpleLight, opacity: .4, borderRadius: 2, marginTop: 4 }} />
            <div style={{ height: 4, width: '90%', background: C.ink, opacity: .15, borderRadius: 2, marginTop: 5 }} />
            <div style={{ height: 4, width: '55%', background: C.coral, opacity: .5, borderRadius: 2, marginTop: 5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Page({ children }) {
  return (
    <>
      <Head>
        <title>Δημιουργός εφαρμογών · ΛΕΒΙΑΘΑΝ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        html, body { background: ${C.cream}; color: ${C.ink}; margin: 0; font-family: 'Source Sans 3', system-ui, sans-serif; }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:disabled { opacity: .4; cursor: default !important; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: ${C.purple} !important; box-shadow: 0 0 0 3px rgba(107,63,160,.12); }
      `}</style>
      <div style={{ minHeight: '100vh' }}>{children}</div>
    </>
  );
}
function TopBar({ title, sub, right }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,250,247,.94)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${C.line}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${C.navy},${C.cyan})`, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', background: C.gold }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.purpleLight, fontWeight: 700 }}>ΛΕΒΙΑΘΑΝ · Δημιουργός</div>
        {title && <div style={{ fontFamily: 'Literata,serif', fontWeight: 700, fontSize: 16, color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title} <span style={{ fontFamily: 'Source Sans 3', fontWeight: 400, fontSize: 12, color: C.muted }}>· {sub}</span></div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>
    </div>
  );
}
const SectionTitle = ({ children }) => <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, color: C.purpleLight, margin: '0 0 12px' }}>{children}</div>;
const FormTitle = ({ eyebrow, title }) => (
  <div>
    <div style={{ fontSize: 10.5, letterSpacing: 2.5, textTransform: 'uppercase', color: C.purpleLight, fontWeight: 700 }}>{eyebrow}</div>
    <div style={{ fontFamily: 'Literata,serif', fontSize: 21, fontWeight: 700, color: C.navy, marginTop: 2 }}>{title}</div>
  </div>
);
const Field = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{hint}</span>}
  </div>
);
const IconBtn = ({ children, danger, ...p }) => (
  <button {...p} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${danger ? 'rgba(196,74,61,.3)' : C.line}`, background: '#fff', cursor: 'pointer', color: danger ? C.bad : C.purple, fontSize: 13, flexShrink: 0 }}>{children}</button>
);

const S = {
  eyebrow: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.purpleLight, fontWeight: 700 },
  h1: { fontFamily: 'Literata,serif', fontSize: 'clamp(26px,4vw,38px)', color: C.navy, margin: '6px 0 0', lineHeight: 1.2 },
  card: { background: '#fff', borderRadius: 12, boxShadow: '2px 6px 22px rgba(26,22,16,.08)', border: `1px solid ${C.line}`, padding: 16 },
  pill: { fontSize: 11.5, fontWeight: 600, color: C.purpleDark, background: 'rgba(107,63,160,.08)', borderRadius: 999, padding: '3px 9px' },
  miniTitle: { fontSize: 10.5, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 700, color: C.purpleLight, marginBottom: 8 },
  input: { width: '100%', padding: '9px 12px', border: `1.5px solid ${C.line}`, borderRadius: 8, fontSize: 14.5, fontFamily: 'inherit', background: '#fff', color: C.ink, resize: 'vertical' },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' },
  btnPrimary: { padding: '10px 20px', background: `linear-gradient(135deg,${C.purple},${C.purpleDark})`, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(107,63,160,.25)' },
  btnPrimarySm: { padding: '7px 14px', background: `linear-gradient(135deg,${C.purple},${C.purpleDark})`, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnGhost: { padding: '9px 16px', background: '#fff', color: C.purple, border: `1.5px solid rgba(107,63,160,.28)`, borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  btnGhostSm: { padding: '6px 12px', background: '#fff', color: C.purple, border: `1.5px solid rgba(107,63,160,.28)`, borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: C.purple, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none', padding: '6px 4px' },
  navBtn: { width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 14, color: C.ink },
  navBtnOn: { background: C.purple, color: '#fff', borderColor: C.purple },
  qItem: { display: 'flex', gap: 6, alignItems: 'center', width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid transparent', background: 'rgba(107,63,160,.04)', cursor: 'pointer', fontSize: 13.5, color: C.ink },
  qItemOn: { background: C.purple, color: '#fff' },
  addBtn: { padding: '7px 8px', borderRadius: 7, border: `1px dashed rgba(107,63,160,.35)`, background: '#fff', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', color: C.ink },
  typeChip: { padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink },
  typeChipOn: { background: C.purple, color: '#fff', borderColor: C.purple },
  radio: { width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: C.purpleLight, flexShrink: 0 },
  radioOn: { background: C.ok, borderColor: C.ok, color: '#fff' },
  bigChoice: { flex: 1, padding: '12px', borderRadius: 10, border: `2px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15 },
};
