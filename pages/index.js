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
  { name:'Ψηφιακό Σχολείο', url:'https://dschool.edu.gr' },
  { name:'Φωτόδεντρο', url:'http://photodentro.edu.gr' },
  { name:'sch.gr', url:'https://www.sch.gr' },
  { name:'ΕΡΤ', url:'https://www.ert.gr' },
  { name:'Wikipedia (Ελ.)', url:'https://el.wikipedia.org' },
  { name:'Λεξικό Τριανταφυλλίδη', url:'http://www.greek-language.gr/greekLang/modern_greek/tools/lexica/triantafyllides/' },
  { name:'Λεξικό Ακαδημίας Αθηνών', url:'https://www.lexikon.academyofathens.gr' },
  { name:'Πύλη για την Ελληνική Γλώσσα', url:'http://www.greek-language.gr' },
];
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (tag) => TAG_COLORS[Math.abs([...tag].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

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
};

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

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [folders, setFolders] = useState([]);
  const [appsFolderId, setAppsFolderId] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [walletActive, setWalletActive] = useState(null);
  const [statActive, setStatActive] = useState(null);
  const [activeView, setActiveView] = useState('home'); // home | folder | favorites | newFiles | tagSearch
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

  // Αναζήτηση με ετικέτες
  const [searchTags, setSearchTags] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [folderSearch, setFolderSearch] = useState('');

  // Live & Συνδέσεις
  const [liveFile, setLiveFile] = useState(null);
  const [activeLiveTab, setActiveLiveTab] = useState(0);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkNameInput, setLinkNameInput] = useState('');
  const [modalPickerSection, setModalPickerSection] = useState(null);
  const [studentUrl, setStudentUrl] = useState('/student');
  const [publishing, setPublishing] = useState(false);
  const [liveSending, setLiveSending] = useState(false);
  const [liveToast, setLiveToast] = useState(null);
  const [visibilityPicker, setVisibilityPicker] = useState(null);
  const [networkData, setNetworkData] = useState({ connections:[], received:[], sent:[] });
  const [networkInviteEmail, setNetworkInviteEmail] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (session?.error === 'RefreshAccessTokenError') signOut({ callbackUrl: '/login' });
  }, [status, session, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
  useEffect(() => { if (status === 'authenticated') { loadAll(); fetch('/api/network').then(r=>r.json()).then(d=>setNetworkData(d)).catch(()=>{}); } }, [status, loadAll]);

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

  // ── Μητρώο ──
  const registerFiles = async (items) => {
    const r = await fetch('/api/registry', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ files: items }) });
    const d = await r.json(); if (d.files) setFiles(d.files);
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
  const fileQuestions = (id) => fileOf(id).questions || '';
  const updateQuestions = (id, value) => {
    setFiles((p) => p.map((f) => f.id === id ? { ...f, questions: value } : f));
    if (saveTimerQ.current) clearTimeout(saveTimerQ.current);
    saveTimerQ.current = setTimeout(() => patchMeta(id, { questions: value }), 800);
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
  const openLive = async (f) => {
    const fLinks = fileLinks(f.id);
    if (!fLinks.length || liveSending) return;
    setLiveSending(true);
    try {
      const r = await fetch('/api/live', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file:{ id:f.id, name:f.name, tags:f.tags||[], questions:f.questions||'' }, links:fLinks }) });
      const d = await r.json();
      if (d.code) {
        const url = `${window.location.origin}/live?code=${d.code}`;
        try { await navigator.clipboard.writeText(url); } catch(e) {}
        setLiveToast({ code: d.code, url });
        setTimeout(() => setLiveToast(null), 8000);
      }
    } catch(e) {}
    setLiveSending(false);
  };
  const setVisibility = async (id, visibility) => {
    setPublishing(true);
    try {
      const r = await fetch('/api/publish', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, visibility }) });
      if (r.ok) setFiles((p) => p.map((f) => f.id === id ? { ...f, visibility, published: visibility !== 'none' } : f));
    } catch(e) {}
    setPublishing(false);
    setVisibilityPicker(null);
  };
  const togglePublish = (id) => {
    const cur = fileOf(id).visibility || 'none';
    if (cur !== 'none') setVisibility(id, 'none');
    else setVisibilityPicker(id);
  };
  const openNetwork = async () => {
    setActiveView('network');
    setNetworkLoading(true);
    try { const r = await fetch('/api/network'); const d = await r.json(); setNetworkData(d); } catch(e) {}
    setNetworkLoading(false);
  };
  const sendInvite = async () => {
    if (!networkInviteEmail.trim()) return;
    setNetworkLoading(true);
    try {
      const r = await fetch('/api/network', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ toEmail: networkInviteEmail.trim() }) });
      const d = await r.json();
      if (d.ok) { setNetworkInviteEmail(''); const r2 = await fetch('/api/network'); setNetworkData(await r2.json()); }
      else alert(d.error || 'Σφάλμα');
    } catch(e) {}
    setNetworkLoading(false);
  };
  const respondInvite = async (fromEmail, action) => {
    try { await fetch('/api/network', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fromEmail, action }) }); const r = await fetch('/api/network'); setNetworkData(await r.json()); } catch(e) {}
  };
  const disconnect = async (email) => {
    if (!confirm(`Αποσύνδεση από ${email};`)) return;
    try { await fetch('/api/network', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) }); const r = await fetch('/api/network'); setNetworkData(await r.json()); } catch(e) {}
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
    if (isMobile) { window.open('/api/file/' + f.id, '_blank'); return; }
    setViewing(f); setShowMetaPanel(false); setTagInput(''); setMobileZoom(1);
  };

  // ── Navigation helpers ──
  const goHome = () => { setActiveView('home'); setOpenFolder(null); setActiveTagFilter(null); setWalletActive(null); setStatActive(null); };
  const openFolderView = (fld) => { setOpenFolder(fld); setActiveView('folder'); setActiveTagFilter(null); setFolderSearch(''); setWalletActive(null); };
  const openApps = () => {
    if (!appsFolderId) return;
    setOpenFolder({ id: appsFolderId, name: 'Εφαρμογές', isApps: true });
    setActiveView('apps'); setActiveTagFilter(null);
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={S.loading}>Φόρτωση…</div>;
  }

  const userName = session.user?.email?.split('@')[0] || '';
  const countFor = (fid) => files.filter((f) => f.folderId === fid).length;

  // Αρχεία εκτός του φακέλου «Εφαρμογές» (για τις κανονικές λίστες)
  const normalFiles = files.filter((f) => !appsFolderId || f.folderId !== appsFolderId);

  // Παράγωγες λίστες
  const favoriteFiles = normalFiles.filter((f) => f.favorite);
  const newFiles = [...normalFiles].sort((a,b)=>(b.addedAt||0)-(a.addedAt||0)).slice(0,10);
  const recentFiles = normalFiles.filter((f)=>f.openedAt).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0)).slice(0,8);
  const popularFiles = normalFiles.filter((f)=>(f.openCount||0)>0).sort((a,b)=>(b.openCount||0)-(a.openCount||0)).slice(0,8);
  const allTags = [...new Set(normalFiles.flatMap((f)=>f.tags||[]))].sort();

  // Αναζήτηση
  const searchResults = normalFiles.filter((f) => {
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
    viewFiles = files.filter((f) => f.folderId === openFolder.id);
    if (activeTagFilter) viewFiles = viewFiles.filter((f)=>(f.tags||[]).includes(activeTagFilter));
  }
  else if (activeView === 'folder' && openFolder) {
    viewFiles = files.filter((f) => f.folderId === openFolder.id);
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
      {badge && <span style={{ position:'absolute', top:4, right:sidebarCollapsed?4:8, background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{badge}</span>}
    </button>
  );

  return (
    <div style={S.app}>
      <style>{`
        *{box-sizing:border-box;}
        html,body{margin:0;padding:0;}
        .ch:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.04)!important;}
        .nav-h:hover{background:rgba(255,255,255,0.06)!important;color:#ececec!important;}
        .ri-h:hover{background:#fcf0e5!important;}
        .del-h:hover{background:#fde8e8!important;color:#dc2626!important;border-color:#f5c6c6!important;}
        .tag-chip:hover .tag-x{opacity:1!important;}
        input:focus,textarea:focus{border-color:#c97b5a!important;outline:none;box-shadow:0 0 0 3px rgba(201,123,90,0.12)!important;}
        .wallet-card{transition:all 0.35s cubic-bezier(.4,0,.2,1);}
        .wallet-card:active{transform:scale(0.97)!important;}
        .btm-item{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;cursor:pointer;padding:4px 0;min-width:0;flex:1;}
        .btm-item svg{width:20px;height:20px;}
      `}</style>

      {/* ── Sidebar (desktop only) ── */}
      {!isMobile && (
      <aside style={{ ...S.sidebar, width: sidebarCollapsed ? 70 : 260 }}>
        <div style={S.sidebarHeader}>
          {!sidebarCollapsed && <strong style={{ color:'#ececec', fontSize:15 }}>📚 ΛΕΒΙΑΘΑΝ</strong>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={S.collapseBtn}>
            {sidebarCollapsed ? Icon.collapseR : Icon.collapseL}
          </button>
        </div>
        <nav style={S.nav}>
          <NavItem icon={Icon.home} label="Αρχική" active={activeView==='home'} onClick={goHome} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.net} label="Δίκτυα" active={activeView==='network'} onClick={openNetwork}
            badge={networkData.received?.length > 0 ? networkData.received.length : null} />
          <NavItem icon={Icon.netAdd} label="Νέα Σύνδεση" onClick={openNetwork} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.apps} label="Εφαρμογές" active={activeView==='apps'} onClick={openApps} />
          <div style={S.navDiv} />
          <NavItem icon={Icon.student} label="Student" onClick={() => window.open('/student', '_blank')} />
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
            {Icon.home}<span style={{ fontSize:10 }}>Αρχική</span>
          </button>
          <button className="btm-item" style={{ color:'#8e8ea0', opacity:0.35 }}>
            {Icon.net}<span style={{ fontSize:10 }}>Δίκτυα</span>
          </button>
          <button className="btm-item" onClick={openApps} style={{ color: activeView==='apps'?'#ececec':'#8e8ea0' }}>
            {Icon.apps}<span style={{ fontSize:10 }}>Εφαρμογές</span>
          </button>
          <button className="btm-item" style={{ color:'#16a34a' }} onClick={() => window.open('/student', '_blank')}>
            {Icon.student}<span style={{ fontSize:10 }}>Student</span>
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
                /* ── Unified wallet renderer (ίδιος αλγόριθμος με παλιό ΛΕΒΙΑΘΑΝ) ── */
                const renderWallet = (items) => {
                  const expandedIdx = items.findIndex(i => i.view === (i.type==='stat' ? statActive : walletActive));
                  const hasExpanded = expandedIdx >= 0;

                  return items.map((item, idx) => {
                    const p = PALETTE[item.tone];
                    const activeId = item.type==='stat' ? statActive : walletActive;
                    const isExpanded = activeId === item.view;
                    const isBefore = hasExpanded && idx < expandedIdx;
                    const isAfter = hasExpanded && idx > expandedIdx;

                    let mt = idx === 0 ? 0 : -36;
                    let ty = 0;
                    if (isExpanded)     { mt = idx===0 ? 0 : 16; ty = -8; }
                    else if (isBefore)  { mt = idx===0 ? 0 : -48; ty = -4; }
                    else if (isAfter)   { mt = -48; ty = 40; }

                    const cardClick = () => {
                      if (isExpanded) {
                        if (item.type==='stat') { setStatActive(null); setActiveView(item.view); }
                        else { setWalletActive(null); openFolderView(item); }
                      } else {
                        if (item.type==='stat') setStatActive(item.view);
                        else setWalletActive(item.view);
                      }
                    };

                    return (
                      <div key={item.view} className="wallet-card" onClick={cardClick}
                        style={{
                          position:'relative',
                          zIndex: isExpanded ? 50 : (isBefore ? idx : hasExpanded ? idx : idx+1),
                          marginTop: mt,
                          borderRadius:22, cursor:'pointer',
                          padding: item.type==='stat' ? '20px 22px' : '22px 24px',
                          minHeight: item.type==='stat' ? 115 : 120,
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
                                  <span style={{ fontSize:14, color:p.text, opacity:0.6 }}>αρχεία</span>
                                </div>
                                <div style={{ fontSize:12, color:p.text, opacity:0.55 }}>{item.sub}</div>
                              </div>
                              <div style={{ ...S.statIcon, background:p.accent, color:p.deep }}>{item.icon}</div>
                            </div>
                            {isExpanded && (
                              <div style={{ textAlign:'right', marginTop:6 }}>
                                <span style={{ fontSize:12, fontWeight:600, color:p.deep }}>Προβολή →</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                            <div style={{ width:42, height:42, borderRadius:12, background:p.accent, color:p.deep, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.folder}</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:16, fontWeight:700, color:p.text, marginBottom:2 }}>{item.name}</div>
                              <div style={{ fontSize:12, color:p.text, opacity:0.6 }}>{item.desc}</div>
                            </div>
                            {isExpanded && <span style={{ fontSize:13, fontWeight:600, color:p.deep, flexShrink:0 }}>Άνοιγμα →</span>}
                          </div>
                        )}
                      </div>
                    );
                  });
                };

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
                      {renderWallet(statsItems)}
                    </div>
                    <section style={{ marginBottom:24 }}>
                      <h2 style={{ ...S.secTitle, marginBottom:12, fontSize:15 }}>Οι φάκελοί μου</h2>
                      <div style={{ position:'relative', marginBottom:8, paddingBottom:8 }}>
                        {renderWallet(folderItems)}
                      </div>
                      <div onClick={addFolder} style={{ textAlign:'center', padding:'8px 0' }}>
                        <span style={{ fontSize:12, color:PALETTE.cream.deep, cursor:'pointer', opacity:0.6 }}>{busy==='folder' ? 'Δημιουργία…' : '＋ Νέος φάκελος'}</span>
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
                          <div key={fld.id} className="ch" onClick={() => openFolderView(fld)}
                            style={{ ...S.folderCard, background:`linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.10) 45%, transparent 65%), ${p.bg}` }}>
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
                      <div className="ch" onClick={addFolder}
                        style={{ ...S.folderCard, background:'transparent', border:`1.5px dashed ${PALETTE.cream.accent}`, alignItems:'center', justifyContent:'center', textAlign:'center', color:PALETTE.cream.accent, minHeight:120 }}>
                        <div style={{ fontSize:22, lineHeight:1, marginBottom:4, opacity:0.7 }}>＋</div>
                        <div style={{ fontSize:12, fontWeight:500, opacity:0.7 }}>{busy==='folder' ? 'Δημιουργία…' : 'Νέος φάκελος'}</div>
                      </div>
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
                            <div style={S.recentInfo}><div style={S.recentTitle}>{f.name}</div></div>
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
                            <div style={S.recentInfo}><div style={S.recentTitle}>{f.name}</div></div>
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
                <button onClick={openPicker} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', opacity:0.7 }} title="Επιλογή από Drive">{busy==='picker'?'…':'➕ Drive'}</button>
                <button onClick={() => uploadRef.current?.click()} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, padding:'5px 10px', opacity:0.7 }} title="Ανέβασμα αρχείου">{busy==='upload'?'…':'⬆️ Ανέβασμα'}</button>
                <input ref={uploadRef} type="file" multiple onChange={onUpload} style={{ display:'none' }} />
              </div>
              <input type="search" placeholder="Αναζήτηση με όνομα ή ετικέτα στον φάκελο…" value={folderSearch} onChange={(e)=>setFolderSearch(e.target.value)}
                style={{ width:'100%', padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:12, fontSize: isMobile ? 16 : 13, background:'#fff', marginBottom:12 }} />
              <FileList files={viewFiles} loading={loading} empty="Κανένα αρχείο σε αυτόν τον φάκελο." onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} folders={folders} compact={isMobile} />
            </>
          )}

          {/* APPS VIEW */}
          {activeView === 'apps' && openFolder && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>Εφαρμογές</h1>
              </div>
              <p style={{ fontSize:13, color:'#6b6b80', marginTop:-8, marginBottom:16 }}>
                Ανέβασε ή επίλεξε εφαρμογές (π.χ. διαδραστικά HTML, κουίζ). Αποθηκεύονται χωριστά και δεν εμφανίζονται στους φακέλους σου.
              </p>
              <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                <button onClick={openPicker} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, opacity:0.7 }}>{busy==='picker'?'…':'➕ Drive'}</button>
                <button onClick={() => uploadRef.current?.click()} disabled={!!busy} style={{ ...btn('mini'), fontSize:11, opacity:0.7 }}>{busy==='upload'?'…':'⬆️ Ανέβασμα'}</button>
                <input ref={uploadRef} type="file" multiple onChange={onUpload} style={{ display:'none' }} />
              </div>
              <FileList files={viewFiles} loading={loading} empty="Καμία εφαρμογή ακόμη. Πρόσθεσε με «Επιλογή από Drive» ή «Ανέβασμα»." onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} folders={folders} compact={isMobile} />
            </>
          )}

          {/* ΔΙΚΤΥΑ */}
          {activeView === 'network' && (
            <div style={{ maxWidth:600 }}>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>Δίκτυα</h1>
              </div>
              {networkData.received?.length > 0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#dc2626', marginBottom:10 }}>🔔 Εκκρεμείς προσκλήσεις ({networkData.received.length})</div>
                  {networkData.received.map(inv => (
                    <div key={inv.email} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', borderRadius:14, border:'1px solid #fecaca', marginBottom:8 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👤</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{inv.name || inv.email}</div>
                        <div style={{ fontSize:11, color:'#6b6b80' }}>{inv.email}</div>
                      </div>
                      <button onClick={() => respondInvite(inv.email,'accept')} style={{ padding:'6px 14px', borderRadius:10, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>✓</button>
                      <button onClick={() => respondInvite(inv.email,'reject')} style={{ padding:'6px 12px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fff', color:'#6b6b80', fontSize:12, cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>Πρόσκληση συναδέλφου</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={networkInviteEmail} onChange={e=>setNetworkInviteEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendInvite();}} placeholder="email@gmail.com" type="email"
                    style={{ flex:1, padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:12, fontSize:isMobile?16:13, background:'#fff' }} />
                  <button onClick={sendInvite} disabled={networkLoading||!networkInviteEmail.trim()} style={{ ...btn('solid'), padding:'10px 18px', opacity:networkInviteEmail.trim()?1:0.4 }}>{networkLoading?'…':'Αποστολή'}</button>
                </div>
                {networkData.sent?.length > 0 && <div style={{ marginTop:8, fontSize:11, color:'#aeaeb8' }}>Αναμένει: {networkData.sent.join(', ')}</div>}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:10 }}>Συνδέσεις {networkData.connections?.length > 0 && `(${networkData.connections.length})`}</div>
                {networkLoading && <div style={{ color:'#aeaeb8', fontSize:13 }}>Φόρτωση…</div>}
                {!networkLoading && (networkData.connections||[]).length === 0 && <div style={{ color:'#aeaeb8', fontSize:13, fontStyle:'italic' }}>Καμία σύνδεση ακόμα.</div>}
                {(networkData.connections||[]).map(conn => (
                  <div key={conn.email} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', borderRadius:14, border:'1px solid #ebebeb', marginBottom:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{conn.name||conn.email}</div>
                      <div style={{ fontSize:11, color:'#6b6b80' }}>{conn.email}</div>
                    </div>
                    <button onClick={()=>window.open(`/student?teacher=${encodeURIComponent(conn.email)}`, '_blank')} style={{ padding:'6px 14px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fff', color:'#5c4a1e', fontSize:12, fontWeight:600, cursor:'pointer' }}>Υλικό →</button>
                    <button onClick={()=>disconnect(conn.email)} style={{ background:'none', border:'none', color:'#aeaeb8', cursor:'pointer', fontSize:12, padding:'4px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAVORITES / NEW */}
          {(activeView === 'favorites' || activeView === 'newFiles') && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>{activeView==='favorites'?'Αγαπημένα':'Νέα'}</h1>
              </div>
              <FileList files={viewFiles} loading={loading}
                empty={activeView==='favorites'?'Δεν έχεις αγαπημένα ακόμη. Πάτησε το ☆ σε ένα αρχείο.':'Δεν υπάρχουν αρχεία ακόμη.'}
                onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} showFolder folders={folders} compact={isMobile} />
            </>
          )}

          {/* TAG SEARCH */}
          {activeView === 'tagSearch' && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <h1 style={S.pageTitle}>Αναζήτηση με ετικέτες</h1>
              </div>
              <input type="search" placeholder="Αναζήτηση σε τίτλο ή ετικέτα…" value={searchText} onChange={(e)=>setSearchText(e.target.value)}
                style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize: isMobile ? 16 : 14, background:'#fff', marginBottom:14 }} />
              {allTags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18 }}>
                  {allTags.map((t) => { const c=tagColor(t); const on=searchTags.includes(t);
                    return <button key={t} onClick={()=>setSearchTags((p)=>p.includes(t)?p.filter(x=>x!==t):[...p,t])}
                      style={{ border:'none', cursor:'pointer', borderRadius:999, padding:'4px 12px', fontSize:12, fontWeight:on?700:500, background:on?c.text:c.bg, color:on?'#fff':c.text }}>#{t}</button>;
                  })}
                </div>
              )}
              {(searchTags.length===0 && !searchText)
                ? <div style={S.empty}>Διάλεξε ετικέτες ή πληκτρολόγησε για αναζήτηση.</div>
                : <FileList files={searchResults} loading={false} empty="Κανένα αρχείο δεν ταιριάζει." onOpen={openViewer} onRemove={removeFile} onFav={toggleFavorite} onComment={updateComment} onQuestions={updateQuestions} onAddLink={addLink} onRemoveLink={removeLink} onLive={openLive} onPublish={togglePublish} liveSending={liveSending} allFiles={normalFiles} showFolder folders={folders} compact={isMobile} />}
            </>
          )}

        </div>
      </main>

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
              <button onClick={()=>window.open('/api/file/'+viewing.id,'_blank')} style={S.iconBtn} title="Νέα καρτέλα">↗</button>
            </div>
            {/* Action toolbar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'6px 8px', borderBottom:'1px solid #f0f0f0', background:PALETTE.cream.bgSoft, flexShrink:0 }}>
              <button style={{ ...S.mobileAction, opacity:0.35 }} disabled title="Student">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span>Student</span>
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
              <iframe src={'/api/file/'+viewing.id}
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
        ) : (
          /* ── Desktop: modal viewer ── */
          <div onClick={() => setViewing(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'3vh 0' }}>
            <div onClick={(e)=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width: showMetaPanel?'90vw':'80vw', height:'94vh', display:'flex', flexDirection:'column', overflow:'hidden', transition:'width 0.18s ease' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #ebebeb', gap:10 }}>
                <strong style={{ fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{viewing.name}</strong>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={()=>window.open('/api/file/'+viewing.id,'_blank')} style={S.iconBtn} title="Άνοιγμα σε νέα καρτέλα">↗</button>
                  <button onClick={()=>setShowMetaPanel((p)=>!p)} style={{ ...S.iconBtn, background:showMetaPanel?PALETTE.peach.bgSoft:'#f4f4f4', borderColor:showMetaPanel?PALETTE.peach.deep:'#e0e0e0', color:showMetaPanel?PALETTE.peach.deep:'#444' }} title="Ετικέτες & Σχόλια">🏷️</button>
                  <button onClick={()=>setViewing(null)} style={S.closeBtn} title="Κλείσιμο">✕</button>
                </div>
              </div>
              <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
                <iframe src={'/api/file/'+viewing.id} style={{ flex:1, border:'none', minWidth:0 }} title={viewing.name} />
                {showMetaPanel && (
                  <div style={{ flex:'0 0 50%', borderLeft:'1px solid #ebebeb', display:'flex', flexDirection:'column', background:PALETTE.cream.bgSoft }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #ebebeb' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>Ετικέτες · Σχόλια · Ερωτήσεις · Συνδέσεις</span>
                      {metaSaving && <span style={{ fontSize:11, color:PALETTE.peach.deep }}>Αποθήκευση…</span>}
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
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
                      <div style={S.cpLabel}>Σχόλια</div>
                      <textarea placeholder="Σημειώσεις για το αρχείο…" value={fileComment(viewing.id)} onChange={(e)=>updateComment(viewing.id,e.target.value)}
                        style={{ width:'100%', minHeight:200, padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:14, lineHeight:1.6, background:'#fff', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
                      <div style={{ ...S.cpLabel, marginTop:18 }}>Ερωτήσεις</div>
                      <textarea placeholder="π.χ. Α1. Ποια επιχειρήματα χρησιμοποιεί ο συντάκτης;&#10;Β1. Να εντοπίσετε τα γλωσσικά μέσα…" value={fileQuestions(viewing.id)} onChange={(e)=>updateQuestions(viewing.id,e.target.value)}
                        style={{ width:'100%', minHeight:180, padding:'10px 12px', border:'1px solid '+PALETTE.mustard.accent, borderRadius:8, fontSize:14, lineHeight:1.6, background:'#fff', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />

                      <div style={{ ...S.cpLabel, marginTop:18 }}>Συνδέσεις</div>
                      {vLinks.map((lnk, li) => (
                        <div key={li} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 10px', background:'#fff', borderRadius:8, border:'1px solid #e8e0c8' }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{lnk.type==='url'?'🌐':'📄'}</span>
                          <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lnk.name}</span>
                          <button onClick={() => removeLink(viewing.id, li)} style={S.delBtnSm}>✕</button>
                        </div>
                      ))}

                      <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, margin:'10px 0 6px' }}>Διεύθυνση URL</div>
                      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                        <input placeholder="https://…" value={linkUrlInput} onChange={(e)=>setLinkUrlInput(e.target.value)}
                          style={{ flex:2, padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, background:'#fff' }} />
                        <input placeholder="Τίτλος…" value={linkNameInput} onChange={(e)=>setLinkNameInput(e.target.value)}
                          style={{ flex:1, padding:'7px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, background:'#fff' }} />
                        <button onClick={() => { const u=linkUrlInput.trim(); if (u) { addLink(viewing.id, { type:'url', url:u, name:linkNameInput.trim()||u }); setLinkUrlInput(''); setLinkNameInput(''); } }}
                          style={{ ...btn('solid'), padding:'7px 12px' }}>+</button>
                      </div>

                      <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Ιστότοποι</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                        {SUGGESTED_URLS.filter(s => !vLinks.some(l=>l.url===s.url)).map((s) => (
                          <button key={s.url} onClick={() => addLink(viewing.id, { type:'url', url:s.url, name:s.name })}
                            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:10, border:'1px solid #e0e0e0', background:'#fafafa', cursor:'pointer', fontSize:11, fontWeight:500, color:'#333' }}>
                            + {s.name}
                          </button>
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
                      </div>
                      {modalPickerSection && (()=> {
                        const fldFiles = normalFiles.filter(x => x.folderId===modalPickerSection && x.id!==viewing.id && !vLinks.some(l=>l.targetId===x.id));
                        if (!fldFiles.length) return <div style={{ padding:10, color:'#aeaeb8', fontSize:12, textAlign:'center' }}>Κανένα αρχείο</div>;
                        return (
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {fldFiles.map((af) => (
                              <div key={af.id} onClick={() => addLink(viewing.id, { type:'file', targetId:af.id, name:af.name })}
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
        const curSrc = curLink ? (curLink.type === 'url' ? curLink.url : '/api/file/'+curLink.targetId) : null;

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
            <div style={{ flex:1, overflow:'auto', WebkitOverflowScrolling:'touch' }}>
              <iframe src={activeLiveTab===-1 ? '/api/file/'+liveFile.id : curSrc} style={{ border:'none', width:'100%', height:'100%', display:'block' }}
                title={activeLiveTab===-1 ? liveFile.name : (curLink?.name||'')} />
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
                <div style={{ flex:1, overflow:'hidden' }}>
                  {curSrc ? (
                    <iframe src={curSrc} style={{ width:'100%', height:'100%', border:'none' }} title={curLink?.name||''} />
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
      {visibilityPicker && (
        <div onClick={()=>setVisibilityPicker(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'24px 20px', maxWidth:360, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>Ορατό σε…</div>
            <div style={{ fontSize:12, color:'#6b6b80', marginBottom:20 }}>Ποιος θα βλέπει αυτό το αρχείο στη σελίδα Student;</div>
            {[
              { value:'public',      icon:'🌍', label:'Όλοι', desc:'Οποιοσδήποτε έχει τον σύνδεσμο' },
              { value:'connections', icon:'👥', label:'Συνδέσεις μου', desc:'Μόνο όσοι είναι στο δίκτυό μου' },
            ].map(opt => (
              <button key={opt.value} onClick={()=>setVisibility(visibilityPicker, opt.value)}
                style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid #ebebeb', background:'#fafafa', cursor:'pointer', marginBottom:8, textAlign:'left' }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{opt.label}</div>
                  <div style={{ fontSize:11, color:'#6b6b80' }}>{opt.desc}</div>
                </div>
              </button>
            ))}
            {(networkData.connections||[]).length > 0 && (
              <>
                <div style={{ fontSize:11, color:'#aeaeb8', margin:'8px 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Συγκεκριμένος χρήστης</div>
                {networkData.connections.map(conn => (
                  <button key={conn.email} onClick={()=>setVisibility(visibilityPicker, `user:${conn.email}`)}
                    style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:12, border:'1px solid #ebebeb', background:'#fafafa', cursor:'pointer', marginBottom:6, textAlign:'left' }}>
                    <span style={{ fontSize:18 }}>👤</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{conn.name||conn.email}</div>
                      <div style={{ fontSize:11, color:'#6b6b80' }}>{conn.email}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
            {(networkData.connections||[]).length === 0 && <div style={{ fontSize:12, color:'#aeaeb8', fontStyle:'italic', padding:'4px 0 8px' }}>Δεν έχεις συνδέσεις ακόμα — πήγαινε στα Δίκτυα.</div>}
            <button onClick={()=>setVisibilityPicker(null)} style={{ width:'100%', padding:'10px', borderRadius:12, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer', marginTop:8, color:'#6b6b80' }}>Ακύρωση</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Λίστα αρχείων (κοινό component) ──
function FileList({ files, loading, empty, onOpen, onRemove, onFav, onComment, onQuestions, onAddLink, onRemoveLink, onLive, onPublish, liveSending, allFiles, showFolder, folders, compact }) {
  const [expanded, setExpanded] = useState(null);
  const [commentOpen, setCommentOpen] = useState(null);
  const [questionsOpen, setQuestionsOpen] = useState(null);
  const [linksOpen, setLinksOpen] = useState(null);
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
        const tags = f.tags || []; const hasComment = !!(f.comment||'').trim(); const hasQuestions = !!(f.questions||'').trim();
        const fLinks = f.links || []; const hasLinks = fLinks.length > 0;
        const isPublished = !!(f.published || (f.visibility && f.visibility !== 'none'));
        const visIcon = f.visibility === 'public' ? '🌍' : f.visibility === 'connections' ? '👥' : f.visibility?.startsWith('user:') ? '👤' : null;
        const isExp = expanded === f.id;
        const isCommentOpen = isExp && commentOpen === f.id;
        const isQuestionsOpen = isExp && questionsOpen === f.id;
        const isLinksOpen = isExp && linksOpen === f.id;
        return (
          <div key={f.id} style={{
            background: isExp ? PALETTE.peach.bgSoft : '#fff',
            border: isExp ? `1.5px solid ${PALETTE.peach.accent}` : '1px solid #ebebeb',
            borderRadius: isExp ? 18 : (compact ? 10 : 12),
            overflow:'hidden', transition:'all 0.3s ease',
            boxShadow: isExp ? '0 8px 28px rgba(0,0,0,0.10)' : 'none',
            maxWidth:'100%', minWidth:0,
          }}>
            <div onClick={() => { setExpanded(isExp ? null : f.id); setCommentOpen(null); setQuestionsOpen(null); setLinksOpen(null); }}
              style={{ display:'flex', alignItems:'center', gap: compact ? 8 : 12, padding: compact ? '10px 10px' : '12px 14px', cursor:'pointer', minWidth:0 }}>
              <button onClick={(e)=>{e.stopPropagation();onFav(f.id,e);}} title={f.favorite?'Αφαίρεση':'Αγαπημένο'}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize: compact ? 15 : 17, color:f.favorite?'#eab308':'#d0d0d0', flexShrink:0, padding:0 }}>{f.favorite?'★':'☆'}</button>
              {!compact && <span style={{ fontSize:18 }}>📄</span>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize: compact ? 13 : 14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                {!compact && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4, flexWrap:'wrap' }}>
                    {showFolder && folderName(f.folderId) && <span style={{ fontSize:10, color:'#aeaeb8' }}>📁 {folderName(f.folderId)}</span>}
                    {tags.slice(0,3).map((t)=>{ const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                    {tags.length > 3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{tags.length-3}</span>}
                    {hasQuestions && <span style={{ fontSize:10, color:'#aeaeb8' }}>📝</span>}
                    {hasLinks && <span style={{ fontSize:10, color:'#aeaeb8' }}>🔗{fLinks.length}</span>}
                    {visIcon {isPublished && <span style={{ fontSize:10, color:'#16a34a' }}>📌</span>}{isPublished && <span style={{ fontSize:10, color:'#16a34a' }}>📌</span>} <span style={{ fontSize:10 }}>{visIcon}</span>}
                  </div>
                )}
                {compact && showFolder && folderName(f.folderId) && (
                  <div style={{ fontSize:10, color:'#aeaeb8', marginTop:2 }}>📁 {folderName(f.folderId)}</div>
                )}
                {compact && (isPublished || hasLinks) && (
                  <div style={{ display:'flex', gap:4, marginTop:2 }}>
                    {visIcon {isPublished && <span style={{ fontSize:10, color:'#16a34a' }}>📌</span>}{isPublished && <span style={{ fontSize:10, color:'#16a34a' }}>📌</span>} <span style={{ fontSize:10 }}>{visIcon}</span>}
                    {hasLinks && <span style={{ fontSize:10, color:'#aeaeb8' }}>🔗{fLinks.length}</span>}
                  </div>
                )}
              </div>
              <button onClick={(e)=>{e.stopPropagation();onOpen(f);}} style={{ ...btn('mini'), padding: compact ? '4px 8px' : '5px 10px', fontSize: compact ? 11 : 12 }}>Άνοιγμα</button>
              {!compact && <button onClick={(e)=>{e.stopPropagation();onRemove(f.id);}} className="del-h" style={S.delBtn} title="Διαγραφή">✕</button>}
            </div>

            {isExp && (
              <div style={{ padding: compact ? '0 10px 14px' : '0 14px 14px', borderTop: compact ? 'none' : '1px solid #f0f0f0', background: compact ? 'transparent' : PALETTE.cream.bgSoft }}>
                {tags.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10, paddingLeft:2, paddingTop: compact ? 0 : 8 }}>
                    {tags.map((t)=>{ const c=tagColor(t); return <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                  </div>
                )}
                {hasComment && !isCommentOpen && !isQuestionsOpen && !isLinksOpen && (
                  <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.6)', borderRadius:10, marginBottom:10, fontSize:12, color:'#5c3826', lineHeight:1.5 }}>
                    💬 {f.comment.split(/\s+/).slice(0,35).join(' ')}{f.comment.split(/\s+/).length > 35 ? ' …' : ''}
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', background:'rgba(255,255,255,0.5)', borderRadius:14, padding:'4px 0', flexWrap:'wrap', gap: compact ? 2 : 0 }}>
                  <button style={{ ...actionBtn, color: isPublished ? '#fff' : PALETTE.peach.deep, background: isPublished ? '#16a34a' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); if (onPublish) onPublish(f.id); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>{visIcon || 'Student'}</span>
                  </button>
                  <button style={{ ...actionBtn, color: PALETTE.peach.deep, opacity: hasLinks ? 1 : 0.35 }}
                    onClick={(e) => { e.stopPropagation(); if (hasLinks && onLive) onLive(f); }}
                    disabled={!hasLinks} title={hasLinks ? 'Προβολή με συνδέσεις' : 'Πρόσθεσε συνδέσεις πρώτα'}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Live</span>
                  </button>
                  <button style={{ ...actionBtn, color: isCommentOpen ? '#fff' : PALETTE.peach.deep, background: isCommentOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setCommentOpen(isCommentOpen ? null : f.id); setQuestionsOpen(null); setLinksOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Σχόλια</span>
                  </button>
                  <button style={{ ...actionBtn, color: isLinksOpen ? '#fff' : PALETTE.peach.deep, background: isLinksOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setLinksOpen(isLinksOpen ? null : f.id); setCommentOpen(null); setQuestionsOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Σύνδεση</span>
                  </button>
                  <button style={{ ...actionBtn, color: isQuestionsOpen ? '#fff' : PALETTE.peach.deep, background: isQuestionsOpen ? PALETTE.peach.deep : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setQuestionsOpen(isQuestionsOpen ? null : f.id); setCommentOpen(null); setLinksOpen(null); setPickerSection(null); }}>
                    <svg width={compact?17:18} height={compact?17:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span style={{ fontSize: compact?11:undefined }}>Ερωτήσεις</span>
                  </button>
                </div>

                {/* Σχόλια */}
                {isCommentOpen && (
                  <div style={{ marginTop:10 }}>
                    {compact ? (
                      <textarea value={f.comment || ''} onChange={(e) => { e.stopPropagation(); if (onComment) onComment(f.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()} placeholder="Σημειώσεις για το αρχείο…"
                        style={{ width:'100%', padding:'10px 12px', border:'1px solid '+PALETTE.peach.accent, borderRadius:12, fontSize:16, lineHeight:1.6, color:'#3d3a2e', background:'rgba(255,255,255,0.7)', resize:'none', fontFamily:'inherit', boxSizing:'border-box', minHeight:60, overflow:'hidden' }}
                        ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }} />
                    ) : (
                      <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:12, fontSize:13, color:'#5c3826', lineHeight:1.6, whiteSpace:'pre-wrap', border:'1px solid '+PALETTE.peach.accent }}>
                        {(f.comment||'').trim() || <span style={{ color:'#aeaeb8', fontStyle:'italic' }}>Χωρίς σχόλια — επεξεργασία από το modal (🏷️)</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Ερωτήσεις */}
                {isQuestionsOpen && (
                  <div style={{ marginTop:10 }}>
                    {compact ? (
                      <textarea value={f.questions || ''} onChange={(e) => { e.stopPropagation(); if (onQuestions) onQuestions(f.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()} placeholder="Ερωτήσεις, π.χ. Α1. Ποια είναι τα επιχειρήματα…"
                        style={{ width:'100%', padding:'10px 12px', border:'1px solid '+PALETTE.mustard.accent, borderRadius:12, fontSize:16, lineHeight:1.6, color:'#3d3a2e', background:'rgba(255,255,255,0.7)', resize:'none', fontFamily:'inherit', boxSizing:'border-box', minHeight:80, overflow:'hidden' }}
                        ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }} />
                    ) : (
                      <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.7)', borderRadius:12, fontSize:13, color:'#4a3f1a', lineHeight:1.6, whiteSpace:'pre-wrap', border:'1px solid '+PALETTE.mustard.accent }}>
                        {(f.questions||'').trim() || <span style={{ color:'#aeaeb8', fontStyle:'italic' }}>Χωρίς ερωτήσεις — επεξεργασία από το modal (🏷️)</span>}
                      </div>
                    )}
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
                      <input value={mLinkUrl} onChange={(e)=>setMLinkUrl(e.target.value)} placeholder="https://…"
                        style={{ flex:compact?undefined:2, width:compact?'100%':undefined, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: compact?16:13, background:'#fff', boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={mLinkName} onChange={(e)=>setMLinkName(e.target.value)} placeholder="Τίτλος…"
                          style={{ flex:1, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: compact?16:13, background:'#fff', boxSizing:'border-box', minWidth:0 }} />
                        <button onClick={() => { const u=mLinkUrl.trim(); if (u && onAddLink) { onAddLink(f.id, { type:'url', url:u, name:mLinkName.trim()||u }); setMLinkUrl(''); setMLinkName(''); } }}
                          style={{ ...btn('solid'), padding:'8px 14px', flexShrink:0, fontSize:13 }}>+</button>
                      </div>
                    </div>

                    {/* Γρήγορες επιλογές */}
                    <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Ιστότοποι</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                      {SUGGESTED_URLS.filter(s => !fLinks.some(l=>l.url===s.url)).map((s) => (
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
                    </div>

                    {/* Αρχεία ανοιχτού φακέλου */}
                    {pickerSection && (()=> {
                      const fldFiles = (allFiles||[]).filter(x => x.folderId===pickerSection && x.id!==f.id && !fLinks.some(l=>l.targetId===x.id));
                      if (!fldFiles.length) return <div style={{ padding:10, color:'#aeaeb8', fontSize:12, textAlign:'center' }}>Κανένα αρχείο</div>;
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:6 }}>
                          {fldFiles.map((af) => (
                            <div key={af.id} onClick={() => { if (onAddLink) onAddLink(f.id, { type:'file', targetId:af.id, name:af.name }); }}
                              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.6)', border:'1px solid #e8e0c8' }}>
                              <span style={{ fontSize:14 }}>📄</span>
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
  loading:{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f9f9f8', color:PALETTE.cream.deep, fontFamily:'system-ui,-apple-system,sans-serif' },
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
  welcomeTitle:{ fontSize:26, fontWeight:600, color:'#1a1a1a', marginBottom:6, letterSpacing:'-0.01em' },
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
  cardsGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 },
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
