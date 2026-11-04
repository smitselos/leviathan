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
    types: ['Πολλαπλής επιλογής', 'Σωστό / Λάθος', 'Αντιστοίχιση', 'Συμπλήρωση κενών', 'Επιλογή λέξεων'],
  },
];

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
  return { ...base, q: base.q || 'Επίλεξε…', text: '' };
}
function newDeck(n) { return { label: 'Ενότητα ' + n, ktitle: '', author: '', sub: '', qs: [newQuestion('mcq')] }; }
function newQuiz(credits) {
  return { v: 1, template: 'quiz-deck', title: '', eyebrow: 'Κουίζ αυτοαξιολόγησης', heading: '', subtitle: 'Διάλεξε ενότητα και ξεκίνα. Κάθε ερώτηση εμφανίζεται ξεχωριστά.', credits: credits || '', shuffleOpts: false, shuffleQs: false, decks: [newDeck(1)] };
}
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
  return {
    ...d,
    decks: d.decks.map((dk) => ({
      ...dk,
      qs: dk.qs.map((q) => {
        if (q.t === 'drag') return { ...q, ans: q.tgts.map((_, i) => i) };
        if (q.t === 'gap') return { ...q, distractors: (q.distractors || []).map((s) => s.trim()).filter(Boolean) };
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
  return p;
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
  const [tplHtml, setTplHtml] = useState('');
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

  const tpl = TEMPLATES.find((t) => t.id === tplId) || TEMPLATES[0];
  const token = session?.accessToken;

  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 980);
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => { setDraft(lsGet(DRAFT_KEY)); }, []);
  useEffect(() => {
    fetch(tpl.file + '?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then(setTplHtml).catch(() => setTplHtml(''));
  }, [tpl.file]);

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
    const t = setTimeout(() => lsSet(DRAFT_KEY, { data, editing, at: Date.now() }), 600);
    return () => clearTimeout(t);
  }, [data, editing, step]);

  const defaultCredits = () => {
    const n = session?.user?.name || '';
    return n ? `${n}, ${new Date().getFullYear()}` : '';
  };
  const startNew = () => { setData(newQuiz(defaultCredits())); setEditing(null); setSel({ d: 0, q: 0 }); setPanel('general'); setStep('edit'); };
  const openData = (d, ed) => { setData(normalizeQuiz(d)); setEditing(ed || null); setSel({ d: 0, q: 0 }); setPanel('question'); setStep('edit'); };

  const openDriveApp = async (f) => {
    if (!token) return;
    setLoadingApp(f.id);
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = parseHtml(await r.text());
      if (!d) alert('Η εφαρμογή «' + f.name + '» δεν δημιουργήθηκε με πρότυπο του Δημιουργού, οπότε δεν μπορεί να ανοίξει εδώ.');
      else openData(d, { id: f.id, name: f.name, folderId: f.folderId });
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
  const q = deck?.qs[sel.q];
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
    upd((n) => { n.decks.push(newDeck(n.decks.length + 1)); });
    setSel({ d: data.decks.length, q: 0 }); setPanel('deck');
  };
  const delDeck = (i) => {
    if (data.decks.length === 1) { alert('Η εφαρμογή χρειάζεται τουλάχιστον μία ενότητα.'); return; }
    if (!confirm('Διαγραφή ολόκληρης της ενότητας «' + (data.decks[i].label || i + 1) + '» με όλες τις ερωτήσεις της;')) return;
    upd((n) => { n.decks.splice(i, 1); });
    setSel({ d: Math.max(0, i - 1), q: 0 });
  };
  const changeType = (t) => {
    if (t === q.t) return;
    const filled = q.t === 'mcq' ? q.opts.some((o) => o.trim()) : q.t === 'drag' ? q.tgts.some((o) => o.trim()) : (q.t === 'gap' || q.t === 'click') ? !!q.text.trim() : false;
    if (filled && !confirm('Η αλλαγή τύπου θα σβήσει τις απαντήσεις αυτής της ερώτησης (η εκφώνηση μένει). Συνέχεια;')) return;
    upd((n) => { n.decks[sel.d].qs[sel.q] = newQuestion(t, q); });
  };

  // ── Έλεγχος ──
  const allProblems = useMemo(() => {
    if (!data) return [];
    const out = [];
    data.decks.forEach((dk, di) => dk.qs.forEach((qq, qi) => problemsOf(qq).forEach((m) => out.push({ d: di, q: qi, m }))));
    if (!String(data.title || '').trim()) out.unshift({ d: -1, q: -1, m: 'Λείπει ο τίτλος της εφαρμογής (Γενικά).' });
    return out;
  }, [data]);
  const totalQs = data ? data.decks.reduce((s, d) => s + d.qs.length, 0) : 0;

  // ── Προεπισκόπηση ──
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewStart, setPreviewStart] = useState(false);
  useEffect(() => {
    if (!data || !tplHtml) return;
    const t = setTimeout(() => {
      const pv = `<script>window.LEV_PREVIEW=${JSON.stringify({ d: sel.d, q: previewStart || panel !== 'question' ? -1 : sel.q })}</script>`;
      setPreviewHtml(buildHtml(tplHtml, data).replace(/<head>/i, '<head>' + pv));
    }, 450);
    return () => clearTimeout(t);
  }, [data, tplHtml, sel, panel, previewStart]);

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
                <TemplateThumb />
                <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ fontFamily: 'Literata,serif', fontSize: 19, fontWeight: 700, color: C.navy }}>{t.name}</div>
                  <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>{t.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.types.map((x) => <span key={x} style={S.pill}>{x}</span>)}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button style={{ ...S.btnPrimary, alignSelf: 'flex-start' }} onClick={() => { setTplId(t.id); startNew(); }} disabled={!tplHtml}>Νέα εφαρμογή →</button>
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

          <div style={S.card}>
            <div style={S.miniTitle}>Ενότητες (κάρτες αρχικής)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.decks.map((dk, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setSel({ d: i, q: 0 }); setPanel('deck'); }}
                    style={{ ...S.navBtn, flex: 1, ...(sel.d === i ? S.navBtnOn : {}) }}>
                    <b style={{ opacity: .5, marginRight: 6 }}>{String(i + 1).padStart(2, '0')}</b>{dk.label || 'Χωρίς όνομα'}
                    <span style={{ float: 'right', fontSize: 11, opacity: .7 }}>{dk.qs.length}</span>
                  </button>
                </div>
              ))}
              <button style={{ ...S.btnGhost, fontSize: 13 }} onClick={addDeck}>＋ Νέα ενότητα</button>
            </div>
          </div>

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
        </div>

        {/* ── Κέντρο: φόρμα ── */}
        <div style={{ ...S.card, padding: narrow ? 16 : 22, minWidth: 0 }}>
          {panel === 'general' && <GeneralForm data={data} upd={upd} />}
          {panel === 'deck' && <DeckForm deck={deck} index={sel.d} upd={(fn) => upd((n) => fn(n.decks[sel.d]))} onDelete={() => delDeck(sel.d)} onOpenQs={() => setPanel('question')} />}
          {panel === 'question' && q && (
            <QuestionForm key={sel.d + ':' + sel.q} q={q} index={sel.q} total={deck.qs.length} setQ={setQ} changeType={changeType}
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
          data={data} problems={allProblems} editing={editing} drive={drive} status={status} token={token}
          defaultFolder={typeof router.query.folder === 'string' ? router.query.folder : ''}
          onClose={() => setSaveOpen(false)} onGo={(p) => { setSaveOpen(false); if (p.d >= 0) { setSel({ d: p.d, q: p.q }); setPanel('question'); } else setPanel('general'); }}
          getHtml={finalHtml}
          onSaved={(ed) => { setEditing(ed); loadDrive(); }}
          onLogin={() => { lsSet(DRAFT_KEY, { data, editing, at: Date.now() }); signIn('google', { callbackUrl: '/creator' }); }}
        />
      )}
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════
// Φόρμες
// ═════════════════════════════════════════════════════════════════
function GeneralForm({ data, upd }) {
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; upd((n) => { n[k] = v; }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormTitle eyebrow="Γενικά" title="Η αρχική οθόνη της εφαρμογής" />
      <Field label="Τίτλος εφαρμογής" hint="Γίνεται και όνομα αρχείου στον ΛΕΒΙΑΘΑΝ.">
        <input style={S.input} value={data.title} onChange={set('title')} placeholder="π.χ. Κουίζ — 14η Διδακτική πρόταση" autoFocus />
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
      <Field label="Υπογραφή (κάτω μέρος)">
        <input style={S.input} value={data.credits} onChange={set('credits')} placeholder="π.χ. Α. & Σ. ΜΗΤΣΕΛΟΣ — ΕΛΛΗΝΟΕΚΔΟΤΙΚΗ, 2026" />
      </Field>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <label style={S.check}><input type="checkbox" checked={!!data.shuffleQs} onChange={set('shuffleQs')} /> Ανακάτεμα σειράς ερωτήσεων</label>
        <label style={S.check}><input type="checkbox" checked={!!data.shuffleOpts} onChange={set('shuffleOpts')} /> Ανακάτεμα επιλογών (πολλαπλής)</label>
      </div>
    </div>
  );
}

function DeckForm({ deck, index, upd, onDelete, onOpenQs }) {
  const set = (k) => (e) => { const v = e.target.value; upd((d) => { d[k] = v; }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormTitle eyebrow={'Ενότητα ' + String(index + 1).padStart(2, '0')} title="Η κάρτα της ενότητας στην αρχική οθόνη" />
      <Field label="Ετικέτα κάρτας" hint="π.χ. Κείμενο 1 — εμφανίζεται και πάνω αριστερά στη διάρκεια του κουίζ.">
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
        <button style={S.btnPrimary} onClick={onOpenQs}>Στις ερωτήσεις ({deck.qs.length}) →</button>
        <div style={{ flex: 1 }} />
        <button style={{ ...S.btnGhost, color: C.bad, borderColor: 'rgba(196,74,61,.35)' }} onClick={onDelete}>Διαγραφή ενότητας</button>
      </div>
    </div>
  );
}

function QuestionForm({ q, index, total, setQ, changeType, onUp, onDown, onDup, onDel, onPrev, onNext }) {
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
                  setQ({ opts: a, ans: q.ans === i ? 0 : q.ans > i ? q.ans - 1 : q.ans });
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

      <details style={{ background: 'rgba(107,63,160,.04)', borderRadius: 10, padding: '10px 14px' }} open={!!(q.fbC || q.fbW || q.ref)}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: C.purple }}>Ανατροφοδότηση / διόρθωση (προαιρετικά)</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <Field label="✓ Σχόλιο όταν απαντά σωστά" hint="Κενό → «Σωστά!»">
            <textarea style={{ ...S.input, minHeight: 50 }} value={q.fbC} onChange={(e) => setQ({ fbC: e.target.value })} />
          </Field>
          <Field label="✗ Σχόλιο / διόρθωση όταν απαντά λάθος" hint="Κενό → εμφανίζεται αυτόματα η σωστή απάντηση.">
            <textarea style={{ ...S.input, minHeight: 50 }} value={q.fbW} onChange={(e) => setQ({ fbW: e.target.value })} />
          </Field>
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
function SaveDialog({ data, problems, editing, drive, status, token, onClose, onGo, getHtml, onSaved, onLogin, defaultFolder }) {
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
                  <span style={{ minWidth: 70, fontWeight: 700 }}>{p.d >= 0 ? `Εν.${p.d + 1} · Ερ.${p.q + 1}` : 'Γενικά'}</span>
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

function TemplateThumb() {
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
