// pages/index.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

const PALETTE = {
  bg: '#f5f0e1', card: '#fff', text: '#3d3a2e', deep: '#8a7d4a',
  peach: '#c97b5a', peachSoft: '#fdf0e4', soft: '#faf6ea', border: '#e8dfc4', muted: '#aeaeb8',
};

const SUGGESTED_TAGS = [
  'Γλώσσα', 'Λογοτεχνία', 'Ιστορία', 'Αρχαία', 'Λατινικά',
  'Έκθεση', 'Γραμματική', 'Λεξιλόγιο', 'Ανάλυση', 'Αξιολόγηση',
  'Α΄ Λυκείου', 'Β΄ Λυκείου', 'Γ΄ Λυκείου',
];
const TAG_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9' }, { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#b45309' }, { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#fce7f3', text: '#9d174d' }, { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#f3f4f6', text: '#374151' },
];
const tagColor = (tag) => TAG_COLORS[Math.abs([...tag].reduce((a, c) => a + c.charCodeAt(0), 0)) % TAG_COLORS.length];

// Φόρτωση του Google Picker script (μία φορά)
function loadPickerApi() {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) return resolve();
    const existing = document.getElementById('gapi-script');
    const onload = () => window.gapi.load('picker', { callback: resolve });
    if (existing) { onload(); return; }
    const s = document.createElement('script');
    s.id = 'gapi-script';
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = onload;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [rootId, setRootId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openFolder, setOpenFolder] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState('');
  const uploadRef = useRef(null);

  // Ετικέτες & σχόλια
  const [showMetaPanel, setShowMetaPanel] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const saveTimer = useRef(null);

  // Guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (session?.error === 'RefreshAccessTokenError') signOut({ callbackUrl: '/login' });
  }, [status, session, router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rf, rr] = await Promise.all([fetch('/api/folders'), fetch('/api/registry')]);
      const df = await rf.json();
      const dr = await rr.json();
      setRootId(df.rootId || null);
      setFolders(Array.isArray(df.folders) ? df.folders : []);
      setFiles(Array.isArray(dr.files) ? dr.files : []);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (status === 'authenticated') loadAll(); }, [status, loadAll]);

  // ── Φάκελοι ──────────────────────────────────────────────
  const addFolder = async () => {
    const name = prompt('Όνομα νέου φακέλου:');
    if (!name || !name.trim()) return;
    setBusy('folder');
    try {
      const r = await fetch('/api/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await r.json();
      if (!r.ok) alert(d.error || 'Σφάλμα δημιουργίας φακέλου');
      else { setFolders(d.folders); if (d.rootId) setRootId(d.rootId); }
    } catch (e) { alert('Σφάλμα: ' + e.message); }
    setBusy('');
  };

  const removeFolder = async (folder) => {
    const choice = prompt(
      `Διαγραφή του φακέλου «${folder.name}».\n\n` +
      `  1 = αφαίρεση μόνο από τη λίστα (τα αρχεία μένουν στο Drive)\n` +
      `  2 = διαγραφή και από το Google Drive (στον κάδο)\n\n(Άκυρο για ακύρωση)`, '1'
    );
    if (choice !== '1' && choice !== '2') return;
    setBusy('folder');
    try {
      const r = await fetch('/api/folders', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folder.id, deleteFromDrive: choice === '2' }),
      });
      const d = await r.json();
      if (d.folders) setFolders(d.folders);
      setFiles((prev) => prev.filter((f) => f.folderId !== folder.id));
      if (openFolder?.id === folder.id) setOpenFolder(null);
    } catch (e) { alert('Σφάλμα: ' + e.message); }
    setBusy('');
  };

  // ── Μητρώο ───────────────────────────────────────────────
  const registerFiles = async (items) => {
    const r = await fetch('/api/registry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: items }),
    });
    const d = await r.json();
    if (d.files) setFiles(d.files);
  };

  // ── Ετικέτες & σχόλια (helpers) ──────────────────────────
  const fileTags = (id) => files.find((f) => f.id === id)?.tags || [];
  const fileComment = (id) => files.find((f) => f.id === id)?.comment || '';

  const patchMeta = async (id, body) => {
    setMetaSaving(true);
    try {
      const r = await fetch('/api/registry', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const d = await r.json();
      if (d.files) setFiles(d.files);
    } catch (e) { /* noop */ }
    setMetaSaving(false);
  };

  const addTag = (id, tag) => {
    const t = (tag || '').trim();
    if (!t) return;
    const cur = fileTags(id);
    if (cur.includes(t)) return;
    const next = [...cur, t];
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, tags: next } : f));
    patchMeta(id, { tags: next });
    setTagInput('');
  };

  const removeTag = (id, tag) => {
    const next = fileTags(id).filter((t) => t !== tag);
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, tags: next } : f));
    patchMeta(id, { tags: next });
  };

  const updateComment = (id, value) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, comment: value } : f));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => patchMeta(id, { comment: value }), 800);
  };

  // ── Google Picker → στον τρέχοντα φάκελο ─────────────────
  const openPicker = async () => {
    if (!openFolder) return;
    try {
      setBusy('picker');
      await loadPickerApi();
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setIncludeFolders(false)
        .setMimeTypes('application/pdf,application/vnd.google-apps.document,application/vnd.google-apps.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/html');
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(session.accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
        .setAppId(process.env.NEXT_PUBLIC_GOOGLE_APP_ID)
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const items = (data.docs || []).map((doc) => ({
              id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: openFolder.id,
            }));
            if (items.length) await registerFiles(items);
          }
          setBusy('');
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      alert('Σφάλμα Picker: ' + e.message + '\n\n(Αν χρησιμοποιείς Safari, ίσως χρειάζεται να επιτρέψεις cookies τρίτων. Εναλλακτικά, χρησιμοποίησε το «Ανέβασμα αρχείου».)');
      setBusy('');
    }
  };

  // ── Ανέβασμα → μέσα στον τρέχοντα φάκελο ─────────────────
  const onUpload = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length || !openFolder) return;
    setBusy('upload');
    try {
      const added = [];
      for (const file of list) {
        const metadata = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parents: [openFolder.id],
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
          { method: 'POST', headers: { Authorization: 'Bearer ' + session.accessToken }, body: form }
        );
        const doc = await res.json();
        if (doc.id) added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: openFolder.id });
      }
      if (added.length) await registerFiles(added);
    } catch (err) {
      alert('Σφάλμα ανεβάσματος: ' + err.message);
    }
    setBusy('');
  };

  const removeFile = async (id) => {
    const choice = prompt(
      'Αφαίρεση αρχείου.\n\n' +
      '  1 = αφαίρεση μόνο από τη λίστα (μένει στο Drive)\n' +
      '  2 = διαγραφή και από το Drive (στον κάδο)\n\n(Άκυρο για ακύρωση)', '1'
    );
    if (choice !== '1' && choice !== '2') return;
    const r = await fetch('/api/registry', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleteFromDrive: choice === '2' }),
    });
    const d = await r.json();
    if (d.files) setFiles(d.files);
  };

  const openViewer = (f) => { setViewing(f); setShowMetaPanel(false); setTagInput(''); };

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PALETTE.bg, color: PALETTE.deep, fontFamily: 'sans-serif' }}>Φόρτωση…</div>;
  }

  let filesInOpen = openFolder ? files.filter((f) => f.folderId === openFolder.id) : [];
  if (openFolder && activeTagFilter) filesInOpen = filesInOpen.filter((f) => (f.tags || []).includes(activeTagFilter));
  const countFor = (fid) => files.filter((f) => f.folderId === fid).length;

  // ετικέτες που υπάρχουν στον τρέχοντα φάκελο (για φίλτρο)
  const tagsInFolder = (() => {
    if (!openFolder) return [];
    const set = new Set();
    files.filter((f) => f.folderId === openFolder.id).forEach((f) => (f.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  })();

  const vTags = viewing ? fileTags(viewing.id) : [];
  const suggested = SUGGESTED_TAGS.filter((t) => !vTags.includes(t));

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', color: PALETTE.text }}>
      <style>{`.tag-chip:hover .tag-x{opacity:1!important;}`}</style>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: PALETTE.card, borderBottom: `1px solid ${PALETTE.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📚</span>
          <strong style={{ fontSize: 17 }}>ΛΕΒΙΑΘΑΝ Cloud</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: PALETTE.muted }}>{session.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={btn('ghost')}>Έξοδος</button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '20px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 14 }}>
          <button onClick={() => { setOpenFolder(null); setActiveTagFilter(null); }} style={{ ...btn('ghost'), fontWeight: openFolder ? 400 : 700 }}>
            🗂️ Οι φάκελοί μου
          </button>
          {openFolder && (<><span style={{ color: PALETTE.muted }}>›</span><strong>{openFolder.name}</strong></>)}
        </div>

        {/* ΟΘΟΝΗ 1: Λίστα φακέλων */}
        {!openFolder && (
          <>
            <div style={{ marginBottom: 18 }}>
              <button onClick={addFolder} disabled={!!busy} style={btn('solid')}>
                {busy === 'folder' ? '…' : '➕ Προσθήκη φακέλου'}
              </button>
            </div>
            {loading ? (
              <div style={{ color: PALETTE.muted, padding: 24, textAlign: 'center' }}>Φόρτωση…</div>
            ) : folders.length === 0 ? (
              <div style={{ color: PALETTE.muted, padding: 40, textAlign: 'center', background: PALETTE.soft, borderRadius: 14, border: `1px dashed ${PALETTE.border}` }}>
                Δεν υπάρχουν φάκελοι ακόμη. Πάτησε «Προσθήκη φακέλου» για να ξεκινήσεις.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {folders.map((fld) => (
                  <div key={fld.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 12, padding: '12px 14px' }}>
                    <span style={{ fontSize: 20 }}>📁</span>
                    <button onClick={() => setOpenFolder(fld)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: PALETTE.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fld.name}</button>
                    <span style={{ fontSize: 12, color: PALETTE.muted }}>{countFor(fld.id)} αρχεία</span>
                    <button onClick={() => setOpenFolder(fld)} style={btn('mini')}>Άνοιγμα</button>
                    <button onClick={() => removeFolder(fld)} style={{ ...btn('mini'), color: PALETTE.peach, borderColor: PALETTE.peach }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ΟΘΟΝΗ 2: Μέσα σε φάκελο */}
        {openFolder && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={openPicker} disabled={!!busy} style={btn('solid')}>{busy === 'picker' ? '…' : '➕ Επιλογή από Drive'}</button>
              <button onClick={() => uploadRef.current?.click()} disabled={!!busy} style={btn('outline')}>{busy === 'upload' ? 'Ανέβασμα…' : '⬆️ Ανέβασμα αρχείου'}</button>
              <input ref={uploadRef} type="file" multiple onChange={onUpload} style={{ display: 'none' }} />
            </div>

            {/* Φίλτρο ετικετών */}
            {tagsInFolder.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: PALETTE.muted }}>Φίλτρο:</span>
                {tagsInFolder.map((t) => {
                  const c = tagColor(t); const on = activeTagFilter === t;
                  return <button key={t} onClick={() => setActiveTagFilter(on ? null : t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: on ? 700 : 500, background: on ? c.text : c.bg, color: on ? '#fff' : c.text }}>#{t}</button>;
                })}
                {activeTagFilter && <button onClick={() => setActiveTagFilter(null)} style={{ ...btn('ghost'), fontSize: 12 }}>✕ καθαρισμός</button>}
              </div>
            )}

            {loading ? (
              <div style={{ color: PALETTE.muted, padding: 24, textAlign: 'center' }}>Φόρτωση…</div>
            ) : filesInOpen.length === 0 ? (
              <div style={{ color: PALETTE.muted, padding: 40, textAlign: 'center', background: PALETTE.soft, borderRadius: 14, border: `1px dashed ${PALETTE.border}` }}>
                {activeTagFilter ? 'Κανένα αρχείο με αυτή την ετικέτα.' : 'Κανένα αρχείο σε αυτόν τον φάκελο. Πρόσθεσε με «Επιλογή από Drive» ή «Ανέβασμα».'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filesInOpen.map((f) => {
                  const tags = f.tags || [];
                  const hasComment = !!(f.comment || '').trim();
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 12, padding: '12px 14px' }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        {(tags.length > 0 || hasComment) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                            {tags.map((t) => { const c = tagColor(t); return <span key={t} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, background: c.bg, color: c.text }}>#{t}</span>; })}
                            {hasComment && <span style={{ fontSize: 11, color: PALETTE.muted }}>💬</span>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => openViewer(f)} style={btn('mini')}>Άνοιγμα</button>
                      <button onClick={() => removeFile(f.id)} style={{ ...btn('mini'), color: PALETTE.peach, borderColor: PALETTE.peach }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Viewer modal — πλάτος ~80% */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '3vh 0' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.card, borderRadius: 16, width: '80vw', height: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${PALETTE.border}`, gap: 10 }}>
              <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{viewing.name}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setShowMetaPanel((p) => !p)}
                  style={{ ...iconBtn, background: showMetaPanel ? PALETTE.peachSoft : '#f4f4f4', borderColor: showMetaPanel ? PALETTE.peach : '#e0e0e0', color: showMetaPanel ? PALETTE.peach : '#444' }}
                  title="Ετικέτες & Σχόλια">🏷️</button>
                <button onClick={() => setViewing(null)} style={btn('ghost')}>✕</button>
              </div>
            </div>

            {/* Σώμα: PDF + προαιρετικό πάνελ */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <iframe src={'/api/file/' + viewing.id} style={{ flex: 1, border: 'none', minWidth: 0 }} title={viewing.name} />

              {showMetaPanel && (
                <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', background: PALETTE.soft }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${PALETTE.border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Ετικέτες · Σχόλια</span>
                    {metaSaving && <span style={{ fontSize: 11, color: PALETTE.peach }}>Αποθήκευση…</span>}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                    {/* Ετικέτες */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.deep, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ετικέτες</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {vTags.map((t) => { const c = tagColor(t); return (
                        <span key={t} className="tag-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.bg, color: c.text, borderRadius: 999, padding: '3px 9px', fontSize: 12 }}>
                          #{t}<span className="tag-x" style={{ cursor: 'pointer', opacity: 0.45, fontSize: 10 }} onClick={() => removeTag(viewing.id, t)}>✕</span>
                        </span>
                      ); })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input type="text" placeholder="Νέα ετικέτα…" value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addTag(viewing.id, tagInput); }}
                        style={{ flex: 1, padding: '7px 10px', border: `1px solid ${PALETTE.border}`, borderRadius: 8, fontSize: 13, background: '#fff' }} />
                      {tagInput.trim() && <button onClick={() => addTag(viewing.id, tagInput)} style={{ ...btn('solid'), padding: '7px 12px' }}>+</button>}
                    </div>
                    <div style={{ fontSize: 11, color: PALETTE.muted, marginBottom: 6 }}>Προτεινόμενες:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
                      {suggested.map((t) => { const c = tagColor(t); return (
                        <span key={t} onClick={() => addTag(viewing.id, t)} style={{ cursor: 'pointer', background: c.bg, color: c.text, borderRadius: 999, padding: '3px 9px', fontSize: 12 }}>+{t}</span>
                      ); })}
                    </div>
                    {/* Σχόλια */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.deep, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Σχόλια</div>
                    <textarea placeholder="Σημειώσεις για το αρχείο…" value={fileComment(viewing.id)}
                      onChange={(e) => updateComment(viewing.id, e.target.value)}
                      style={{ width: '100%', minHeight: 110, padding: '8px 10px', border: `1px solid ${PALETTE.border}`, borderRadius: 8, fontSize: 13, lineHeight: 1.5, background: '#fff', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn = { width: 34, height: 34, borderRadius: 9, border: '1.5px solid #e0e0e0', background: '#f4f4f4', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function btn(kind) {
  const base = { borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 14px', border: '1.5px solid transparent' };
  if (kind === 'solid') return { ...base, background: PALETTE.deep, color: '#fff' };
  if (kind === 'outline') return { ...base, background: 'transparent', color: PALETTE.deep, borderColor: PALETTE.deep };
  if (kind === 'ghost') return { ...base, background: 'transparent', color: PALETTE.text, padding: '6px 10px' };
  if (kind === 'mini') return { ...base, padding: '5px 10px', fontSize: 12, background: 'transparent', color: PALETTE.deep, border: `1.5px solid ${PALETTE.border}` };
  return base;
}
