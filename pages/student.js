// pages/student.js — Σελίδα Student: εκπαιδευτικός βλέπει τις δημοσιεύσεις του, μαθητής βλέπει εισερχόμενα
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const PALETTE = {
  cream:  { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach:  { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
};
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (t) => TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];
const trunc = (s, n) => s && s.length > n ? s.slice(0, n) + '…' : s;

/* ── Icons ── */
const Ic = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  net:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg>,
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H19a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="8 17 3 12 8 7"/><line x1="3" y1="12" x2="15" y2="12"/></svg>,
  live: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
};

export default function StudentPage() {
  const router = useRouter();
  const { teacher } = router.query;
  const { data: session } = useSession();
  const hasSession = !!session?.accessToken;
  const myEmail = session?.user?.email || null;

  const [role, setRole] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    fetch('/api/role').then(r => r.json()).then(d => setRole(d.role || 'teacher')).catch(() => setRole('teacher'));
  }, [hasSession]);

  if (!hasSession || !role) return (
    <div style={S.page}><div style={{ color:'#6b6b80', fontSize:14 }}>Φόρτωση…</div></div>
  );

  if (role === 'student') {
    return <StudentView myEmail={myEmail} hasSession={hasSession} isMobile={isMobile} router={router} />;
  }

  // Εκπαιδευτικός → υπάρχον UI
  return <TeacherView teacher={teacher} myEmail={myEmail} hasSession={hasSession} isMobile={isMobile} router={router} />;
}


/* ══════════════════════════════════════════════════════════════
   STUDENT VIEW — δύο στήλες: Εισερχόμενα | Δημοσιεύσεις μου
   ══════════════════════════════════════════════════════════════ */
function StudentView({ myEmail, hasSession, isMobile, router }) {
  const [tab, setTab] = useState('home');       // home | network | userFiles
  const [incoming, setIncoming] = useState([]);
  const [myFiles, setMyFiles] = useState([]);
  const [network, setNetwork] = useState({ connections:[], received:[], sent:[], inbox:[], unseenCount:0 });
  const [seenIds, setSeenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [qrFile, setQrFile] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [expandedIn, setExpandedIn] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [netLoading, setNetLoading] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [userFilesFrom, setUserFilesFrom] = useState([]);  // αρχεία ΑΠΟ αυτόν
  const [userFilesTo, setUserFilesTo] = useState([]);      // αρχεία ΠΡΟΣ αυτόν

  // ── Φόρτωση δεδομένων ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rNet, rReg] = await Promise.all([
        fetch('/api/network'), fetch('/api/registry')
      ]);
      const dNet = await rNet.json();
      const dReg = await rReg.json();
      setNetwork(dNet);

      // Δικά μου αρχεία (published)
      const allMyFiles = Array.isArray(dReg.files) ? dReg.files : [];
      setMyFiles(allMyFiles.filter(f => f.published || (f.visibility && f.visibility !== 'none')));

      // Seen IDs from registry
      const seen = new Set(dReg.seenFiles || []);
      setSeenIds(seen);

      // Εισερχόμενα: για κάθε σύνδεση, φέρε τα δημοσιευμένα προς εμένα
      const conns = dNet.connections || [];
      const allIncoming = [];
      await Promise.all(conns.map(async (c) => {
        try {
          const r = await fetch(`/api/publish?email=${encodeURIComponent(c.email)}&visitor=${encodeURIComponent(myEmail)}`);
          if (!r.ok) return;
          const d = await r.json();
          (d.items || []).forEach(f => {
            allIncoming.push({ ...f, fromEmail: c.email, fromName: c.name || c.email });
          });
        } catch {}
      }));
      // Χρονολογική σειρά (νεότερα πρώτα)
      allIncoming.sort((a, b) => (b.publishedAt || b.addedAt || '').localeCompare(a.publishedAt || a.addedAt || ''));
      setIncoming(allIncoming);
    } catch {}
    setLoading(false);
  }, [myEmail]);

  useEffect(() => { loadAll(); const iv = setInterval(loadAll, 30000); return () => clearInterval(iv); }, [loadAll]);

  // Unseen count
  const unseenCount = useMemo(() => incoming.filter(f => !seenIds.has(f.id)).length, [incoming, seenIds]);

  // Unseen per user (for network badges)
  const unseenByUser = useMemo(() => {
    const m = {};
    incoming.forEach(f => { if (!seenIds.has(f.id)) m[f.fromEmail] = (m[f.fromEmail] || 0) + 1; });
    return m;
  }, [incoming, seenIds]);

  const markSeen = async (fileId) => {
    if (seenIds.has(fileId)) return;
    const next = new Set(seenIds); next.add(fileId);
    setSeenIds(next);
    try {
      await fetch('/api/registry', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seenFiles: [...next] }),
      });
    } catch {}
  };

  const openFile = (f) => {
    markSeen(f.id);
    const isHtml = /\.html?$/i.test(f.name);
    const isOffice = /\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    let url;
    if (isHtml) {
      url = `/api/student-file?id=${f.id}`;
    } else if (isOffice) {
      url = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent('https://drive.google.com/uc?id='+f.id+'&export=download')}`;
    } else {
      url = `https://drive.google.com/file/d/${f.id}/preview`;
    }
    if (isMobile) { window.open(url, '_blank'); return; }
    setViewing({ ...f, previewUrl: url });
  };

  const saveToMyDrive = async (f) => {
    if (savingId) return;
    setSavingId(f.id);
    try {
      const r = await fetch('/api/save-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: f.id, fileName: f.name, info: f.info || '' }),
      });
      const d = await r.json();
      if (d.ok) {
        alert('✅ Αποθηκεύτηκε στον φάκελο «' + (d.folder || 'Λήψεις') + '»!');
        loadAll(); // ανανέωση λίστας
      } else {
        alert('❌ Σφάλμα: ' + (d.error || 'Δοκίμασε ξανά'));
      }
    } catch { alert('❌ Σφάλμα σύνδεσης'); }
    setSavingId(null);
  };

  const downloadFile = (f) => {
    markSeen(f.id);
    window.open(`https://drive.google.com/uc?id=${f.id}&export=download`, '_blank');
  };

  const getFileUrl = (f) => {
    const isHtml = /\.html?$/i.test(f.name);
    if (isHtml) return `${window.location.origin}/api/student-file?id=${f.id}`;
    return `https://drive.google.com/file/d/${f.id}/view`;
  };

  const goHome = () => { setViewing(null); setTab('home'); };
  const goBack = () => router.push('/');

  // ── Δίκτυα: πρόσκληση ──
  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setNetLoading(true);
    try {
      await fetch('/api/network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', email }) });
      setInviteEmail('');
      const r = await fetch('/api/network'); setNetwork(await r.json());
    } catch {}
    setNetLoading(false);
  };
  const acceptInvite = async (email) => {
    setNetLoading(true);
    try {
      await fetch('/api/network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', email }) });
      const r = await fetch('/api/network'); setNetwork(await r.json());
    } catch {}
    setNetLoading(false);
  };

  // Φόρτωση αρχείων ενός χρήστη
  const loadUserFiles = async (email) => {
    setViewingUser(email);
    setTab('userFiles');
    try {
      const [rFrom, rTo] = await Promise.all([
        fetch(`/api/publish?email=${encodeURIComponent(email)}&visitor=${encodeURIComponent(myEmail)}`),
        fetch(`/api/publish?email=${encodeURIComponent(myEmail)}&visitor=${encodeURIComponent(email)}`),
      ]);
      const dFrom = await rFrom.json();
      const dTo = await rTo.json();
      setUserFilesFrom(dFrom.items || []);
      setUserFilesTo(dTo.items || []);
    } catch { setUserFilesFrom([]); setUserFilesTo([]); }
  };

  /* ── Desktop viewer ── */
  if (viewing && !isMobile) {
    const driveUrl = viewing.previewUrl || `https://drive.google.com/file/d/${viewing.id}/preview`;
    return (
      <div style={S.app}>
        <Head><title>{viewing.name} — Student</title></Head>
        <style>{css}</style>
        {!isMobile && <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="view" unseenCount={unseenCount} tab={tab} setTab={setTab} />}
        <div style={{ ...S.main, marginLeft: sidebarOpen ? 220 : 56 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff', gap:10 }}>
            <button onClick={goHome} style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444' }}>← Πίσω</button>
            <strong style={{ flex:1, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1a1a1a' }}>{viewing.name}</strong>
          </div>
          <iframe src={driveUrl} style={{ flex:1, border:'none', width:'100%', display:'block', height:'calc(100vh - 60px)' }} title={viewing.name} allow="fullscreen" />
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div style={S.app}>
      <Head><title>Student — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>

      {!isMobile && <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active={tab === 'home' ? 'home' : 'network'} unseenCount={unseenCount} tab={tab} setTab={setTab} />}

      <div className="student-main" style={{ ...S.main, marginLeft: !isMobile ? (sidebarOpen ? 220 : 56) : 0 }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff' }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>ΛΕΒΙΑΘΑΝ</span>
          </div>
        )}

        <div style={S.container}>

          {/* ═══ TAB: HOME — Δύο στήλες ═══ */}
          {tab === 'home' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h1 style={{ fontSize:20, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Καλώς ήρθες 📚</h1>
                <p style={{ fontSize:13, color:'#6b6b80', margin:0 }}>Εισερχόμενα και δημοσιεύσεις σου</p>
              </div>

              {loading && <div style={S.empty}>Φόρτωση…</div>}

              {!loading && (
                <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                  {/* Αριστερή στήλη: Εισερχόμενα */}
                  <div style={{ flex:'1 1 340px', minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                      📥 Εισερχόμενα
                      {unseenCount > 0 && <span style={S.badge}>{unseenCount}</span>}
                    </div>
                    {incoming.length === 0 && <div style={S.emptyCol}>Δεν υπάρχουν εισερχόμενα ακόμη.</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {incoming.map((f) => {
                        const isNew = !seenIds.has(f.id);
                        const isExp = expandedIn === (f.id + f.fromEmail);
                        return (
                          <div key={f.id + f.fromEmail} style={{
                            background: isNew ? '#fff9ed' : '#fff', border: isNew ? '1.5px solid '+PALETTE.cream.accent : '1px solid #ebebeb',
                            borderRadius:14, overflow:'hidden', transition:'all 0.15s ease',
                          }}>
                            {/* Compact row — tap ανοίγει κάρτα, click στο όνομα ανοίγει αρχείο */}
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer' }}
                              onClick={() => setExpandedIn(isExp ? null : f.id + f.fromEmail)}>
                              <div style={{ width:34, height:34, borderRadius:10, background:PALETTE.cream.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>📄</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name, 20)}</div>
                                <div style={{ fontSize:11, color:'#8a8a9a', marginTop:1 }}>από {trunc(f.fromName, 25)}</div>
                              </div>
                              {isNew && <span style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', flexShrink:0 }} />}
                              <span style={{ fontSize:11, color:'#aeaeb8', flexShrink:0, transition:'transform 0.15s', transform: isExp ? 'rotate(180deg)' : 'none' }}>▼</span>
                            </div>

                            {/* Expanded — πληροφορίες + κουμπιά */}
                            {isExp && (
                              <div style={{ padding:'0 14px 12px', borderTop:'1px solid rgba(0,0,0,0.04)' }}>
                                {f.info && <div style={{ fontSize:12, color:PALETTE.cream.deep, padding:'8px 0 6px', lineHeight:1.5 }}>ℹ️ {f.info}</div>}
                                <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                                  <button onClick={() => openFile(f)} style={S.openBtn}>Άνοιγμα</button>
                                  <button onClick={() => downloadFile(f)} style={S.miniBtn} title="Λήψη">⬇</button>
                                  <button onClick={() => saveToMyDrive(f)} disabled={savingId === f.id} style={{ ...S.miniBtn, opacity: savingId === f.id ? 0.4 : 1 }} title="Αποθήκευση στο Drive">💾</button>
                                  <button onClick={() => setQrFile(f)} style={S.miniBtn} title="QR Code">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="21" y1="14" x2="21" y2="17"/><line x1="14" y1="21" x2="17" y2="21"/><line x1="21" y1="21" x2="21" y2="21.01"/></svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Δεξιά στήλη: Δημοσιεύσεις μου */}
                  <div style={{ flex:'1 1 340px', minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>📤 Δημοσιεύσεις μου</div>
                    {myFiles.length === 0 && <div style={S.emptyCol}>Δεν έχεις δημοσιεύσει κάτι ακόμη.</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {myFiles.map((f) => {
                        const visLabel = f.visibility === 'public' ? '🌍 Όλοι' : f.visibility === 'connections' ? '👥 Συνδέσεις' : f.visibility?.startsWith('user') ? '👤 ' + f.visibility.replace(/^users?:/, '') : '';
                        return (
                          <div key={f.id} style={{
                            background:'#fff', border:'1px solid #ebebeb', borderRadius:14, padding:'12px 14px',
                            display:'flex', alignItems:'center', gap:10,
                          }}>
                            <div style={{ width:36, height:36, borderRadius:10, background:PALETTE.peach.bgSoft, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📄</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name, 20)}</div>
                              {visLabel && <div style={{ fontSize:11, color:'#8a8a9a', marginTop:2 }}>{visLabel}</div>}
                            </div>
                            <button onClick={() => openFile(f)} style={S.openBtn}>Άνοιγμα</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ TAB: ΔΙΚΤΥΑ ═══ */}
          {tab === 'network' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h1 style={{ fontSize:20, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Δίκτυα</h1>
                <p style={{ fontSize:13, color:'#6b6b80', margin:0 }}>Συνδέσεις, προσκλήσεις, αρχεία χρηστών</p>
              </div>

              {/* Πρόσκληση */}
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Πρόσκληση σύνδεσης</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com"
                    style={{ flex:1, padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:10, fontSize: isMobile ? 16 : 13, background:'#fff', boxSizing:'border-box' }} />
                  <button onClick={sendInvite} disabled={netLoading || !inviteEmail.trim()}
                    style={{ padding:'10px 18px', borderRadius:10, border:'none', background:PALETTE.cream.deep, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity: netLoading ? 0.5 : 1 }}>Αποστολή</button>
                </div>
              </div>

              {/* Εκκρεμείς προσκλήσεις */}
              {(network.inbox || []).length > 0 && (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ebebeb', padding:'14px 16px', marginBottom:20 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Εκκρεμείς προσκλήσεις</div>
                  {network.inbox.map((inv) => (
                    <div key={inv.email} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f0f0f0' }}>
                      <span style={{ flex:1, fontSize:13 }}>{inv.email}</span>
                      <button onClick={() => acceptInvite(inv.email)}
                        style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>Αποδοχή</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Συνδέσεις — κουμπιά χρηστών */}
              <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Συνδεδεμένοι χρήστες</div>
              {(network.connections || []).length === 0 && <div style={S.emptyCol}>Δεν υπάρχουν συνδέσεις ακόμη.</div>}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
                {(network.connections || []).map((c) => {
                  const badge = unseenByUser[c.email] || 0;
                  return (
                    <button key={c.email} onClick={() => loadUserFiles(c.email)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:12,
                        border:'1.5px solid '+PALETTE.cream.accent, background:PALETTE.cream.bgSoft,
                        cursor:'pointer', fontSize:13, fontWeight:600, color:PALETTE.cream.text, position:'relative' }}>
                      {c.name || c.email}
                      {badge > 0 && <span style={{ ...S.badge, position:'static', marginLeft:4 }}>{badge}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ TAB: FILES FROM/TO USER ═══ */}
          {tab === 'userFiles' && viewingUser && (
            <>
              <div style={{ marginBottom:20 }}>
                <button onClick={() => setTab('network')} style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444', marginBottom:10 }}>← Δίκτυα</button>
                <h1 style={{ fontSize:18, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Υλικό με {viewingUser}</h1>
              </div>

              {/* Αρχεία ΑΠΟ αυτόν */}
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>📥 Έλαβα από αυτόν</div>
              {userFilesFrom.length === 0 && <div style={{ ...S.emptyCol, marginBottom:16 }}>Κανένα αρχείο.</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
                {userFilesFrom.map((f) => (
                  <div key={f.id} style={{ background:'#fff', border:'1px solid #ebebeb', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:PALETTE.cream.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>📄</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name, 20)}</div>
                      {f.info && <div style={{ fontSize:11, color:PALETTE.cream.deep, marginTop:2 }}>ℹ️ {trunc(f.info, 40)}</div>}
                    </div>
                    <button onClick={() => openFile(f)} style={S.openBtn}>Άνοιγμα</button>
                  </div>
                ))}
              </div>

              {/* Αρχεία ΠΡΟΣ αυτόν */}
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:8 }}>📤 Έστειλα σε αυτόν</div>
              {userFilesTo.length === 0 && <div style={S.emptyCol}>Κανένα αρχείο.</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {userFilesTo.map((f) => (
                  <div key={f.id} style={{ background:'#fff', border:'1px solid #ebebeb', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:PALETTE.peach.bgSoft, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>📄</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trunc(f.name, 20)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>

      {/* QR Code popup */}
      {qrFile && (
        <div onClick={() => setQrFile(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'28px 24px', maxWidth:320, width:'100%', textAlign:'center', boxShadow:'0 12px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>QR Code</div>
            <div style={{ fontSize:12, color:'#6b6b80', marginBottom:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{qrFile.name}</div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getFileUrl(qrFile))}`}
              alt="QR Code" width={200} height={200}
              style={{ borderRadius:8, border:'1px solid #eee', margin:'0 auto', display:'block' }}
            />
            <p style={{ fontSize:11, color:'#aeaeb8', marginTop:12 }}>Σκανάρετε με κινητό για άνοιγμα</p>
            <button onClick={() => setQrFile(null)} style={{ marginTop:12, padding:'10px 28px', borderRadius:10, border:'none', background:'#1a1a1a', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Κλείσιμο</button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a1a', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'8px 0 max(8px, env(safe-area-inset-bottom))', zIndex:300, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <MobBtn icon={Ic.home} label="Αρχική" active={tab==='home'} onClick={() => { setTab('home'); setViewing(null); }} badge={tab !== 'home' ? unseenCount : 0} />
          <MobBtn icon={Ic.net} label="Δίκτυα" active={tab==='network' || tab==='userFiles'} onClick={() => setTab('network')} />
          <MobBtn icon={Ic.back} label="Επιστροφή" onClick={() => router.push('/')} />
        </nav>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   TEACHER VIEW — υπάρχον UI χωρίς αλλαγές
   ══════════════════════════════════════════════════════════════ */
function TeacherView({ teacher, myEmail, hasSession, isMobile, router }) {
  const visitorEmail = myEmail;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibilityInfo, setVisibilityInfo] = useState(null);
  const [activeTag, setActiveTag] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const targetEmail = teacher || myEmail;
      if (!targetEmail) { setLoading(false); return; }
      const params = new URLSearchParams({ email: targetEmail });
      if (visitorEmail) params.set('visitor', visitorEmail);
      const r = await fetch(`/api/publish?${params}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({ files: d.items || [] });
    } catch { setError('Δεν βρέθηκαν δημοσιευμένα αρχεία.'); }
    setLoading(false);
  }, [teacher, visitorEmail, myEmail]);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 30000); return () => clearInterval(iv); }, [loadData]);

  const files = data?.files || [];

  const allTags = useMemo(() => {
    const m = {};
    files.forEach(f => (f.tags||[]).forEach(t => { m[t] = (m[t]||0) + 1; }));
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [files]);

  const filtered = useMemo(() => {
    let result = [...files];
    if (activeTag) result = result.filter(f => (f.tags||[]).includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || (f.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }
    return result;
  }, [files, search, activeTag]);

  const openFile = (f) => {
    const isHtml = /\.html?$/i.test(f.name);
    const url = isHtml ? `/api/student-file?id=${f.id}` : `https://drive.google.com/file/d/${f.id}/preview`;
    if (isMobile) { window.open(url, '_blank'); return; }
    setViewing(f);
  };

  const goHome = () => { setViewing(null); setSearch(''); setActiveTag(null); loadData(); };
  const goBack = () => { if (hasSession) router.push('/'); else router.push('/login'); };

  /* Desktop viewer */
  if (viewing && !isMobile) {
    const isHtml = /\.html?$/i.test(viewing.name);
    const driveUrl = isHtml ? `/api/student-file?id=${viewing.id}` : `https://drive.google.com/file/d/${viewing.id}/preview`;
    return (
      <div style={S.app}>
        <Head><title>{viewing.name} — Student</title></Head>
        <style>{css}</style>
        <TeacherSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="view" />
        <div style={{ ...S.main, marginLeft: sidebarOpen ? 220 : 56 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff', gap:10 }}>
            <button onClick={goHome} style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444' }}>← Πίσω</button>
            <strong style={{ flex:1, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1a1a1a' }}>{viewing.name}</strong>
          </div>
          <iframe src={driveUrl} style={{ flex:1, border:'none', width:'100%', display:'block', height:'calc(100vh - 60px)' }} title={viewing.name} allow="fullscreen" />
        </div>
      </div>
    );
  }

  /* Main list */
  return (
    <div style={S.app}>
      <Head><title>Student — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>
      {!isMobile && <TeacherSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="home" />}
      <div className="student-main" style={{ ...S.main, marginLeft: !isMobile ? (sidebarOpen?220:56) : 0 }}>
        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff' }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>ΛΕΒΙΑΘΑΝ</span>
          </div>
        )}
        <div style={S.container}>
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontSize:22, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Δημοσιεύσεις μου 📤</h1>
            <p style={{ fontSize:14, color:'#6b6b80', margin:0 }}>Υλικό που έχεις δημοσιεύσει</p>
          </div>
          {loading && <div style={S.empty}>Φόρτωση…</div>}
          {error && <div style={{ textAlign:'center', padding:60, color:'#dc2626', fontSize:14 }}>{error}</div>}
          {data && !loading && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14, marginBottom:32 }}>
                <div style={{ borderRadius:18, padding:'16px 18px', background:PALETTE.cream.bg, color:PALETTE.cream.text, minHeight:100 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Δημοσιευμένο υλικό</div>
                      <div style={{ fontSize:32, fontWeight:700, lineHeight:1, letterSpacing:'-0.02em' }}>{files.length}</div>
                      <div style={{ fontSize:12, marginTop:6 }}>Αρχεία</div>
                    </div>
                    <div style={{ width:44, height:44, borderRadius:14, background:PALETTE.cream.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📤</div>
                  </div>
                </div>
              </div>
              {files.length > 0 && (
                <input type="search" placeholder="Αναζήτηση αρχείου ή ετικέτας…" value={search} onChange={e=>setSearch(e.target.value)}
                  style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize: isMobile?16:14, background:'#fff', marginBottom:12, boxSizing:'border-box' }} />
              )}
              {allTags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18 }}>
                  {activeTag && <button onClick={()=>setActiveTag(null)} style={{ padding:'5px 12px', borderRadius:10, border:'1px solid #ddd', background:'#fff', fontSize:12, cursor:'pointer', color:'#888' }}>✕ Όλα</button>}
                  {allTags.map(([tag, count]) => {
                    const c = tagColor(tag); const isActive = activeTag === tag;
                    return <button key={tag} onClick={()=>setActiveTag(isActive ? null : tag)} style={{ padding:'5px 12px', borderRadius:10, border: isActive ? '2px solid '+c.text : '1px solid #e0e0e0', background: isActive ? c.bg : '#fafafa', fontSize:12, cursor:'pointer', color: c.text, fontWeight: isActive ? 700 : 500 }}>#{tag} <span style={{ fontSize:10, opacity:0.6 }}>({count})</span></button>;
                  })}
                </div>
              )}
              {filtered.length > 0 && (
                <div style={{ background:'#fff', borderRadius:18, overflow:'hidden', border:'1px solid #f0f0f0' }}>
                  {filtered.map((f, i) => (
                    <div key={f.id} className="ri-h" onClick={()=>openFile(f)}
                      style={{ display:'flex', alignItems:'center', gap: isMobile?10:12, padding: isMobile?'14px 12px':'12px 14px', cursor:'pointer', borderBottom: i<filtered.length-1 ? '1px solid #f0f0f0' : 'none' }}>
                      <div style={{ width: isMobile?38:42, height: isMobile?38:42, borderRadius:12, background:PALETTE.cream.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize: isMobile?16:18 }}>📄</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize: isMobile?13:14, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                          {(f.tags||[]).slice(0,3).map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                          {(f.tags||[]).length > 3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{f.tags.length-3}</span>}
                        </div>
                      </div>
                      {isMobile
                        ? <span style={{ fontSize:13, color:PALETTE.cream.deep, fontWeight:700, flexShrink:0 }}>→</span>
                        : <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                            {f.visibility && f.visibility !== 'none' && myEmail && (teacher === myEmail || !teacher) && (
                              <button onClick={e=>{e.stopPropagation();setVisibilityInfo(f);}}
                                style={{ background:'transparent', border:'1.5px solid #e0e0e0', borderRadius:10, padding:'6px 10px', fontSize:13, cursor:'pointer', color:'#6b6b80' }}>
                                {f.visibility==='public'?'🌍':f.visibility==='connections'?'👥':'👤'}
                              </button>
                            )}
                            <button style={{ background:'transparent', border:'1.5px solid '+PALETTE.cream.deep, borderRadius:10, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:PALETTE.cream.deep }}>Άνοιγμα →</button>
                          </div>
                      }
                    </div>
                  ))}
                </div>
              )}
              {files.length === 0 && <div style={{ textAlign:'center', padding:60 }}><div style={{ fontSize:48, marginBottom:16 }}>📭</div><div style={{ fontSize:15, color:'#6b6b80' }}>Δεν έχεις δημοσιεύσει υλικό ακόμη.</div></div>}
              {search && filtered.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#aeaeb8', fontSize:13 }}>Κανένα αρχείο δεν ταιριάζει.</div>}
            </>
          )}
        </div>
      </div>
      {visibilityInfo && (
        <div onClick={()=>setVisibilityInfo(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px', width:'100%', maxWidth:420 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{visibilityInfo.name}</div>
            <div style={{ fontSize:13, color:'#6b6b80', marginBottom:16 }}>Δημοσιευμένο σε:</div>
            {visibilityInfo.visibility === 'public' && <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f0fdf4', borderRadius:12, marginBottom:8 }}><span style={{ fontSize:20 }}>🌍</span><div><div style={{ fontSize:13, fontWeight:600 }}>Όλοι</div><div style={{ fontSize:11, color:'#6b6b80' }}>Οποιοσδήποτε με τον σύνδεσμο</div></div></div>}
            {visibilityInfo.visibility === 'connections' && <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#eff6ff', borderRadius:12, marginBottom:8 }}><span style={{ fontSize:20 }}>👥</span><div><div style={{ fontSize:13, fontWeight:600 }}>Συνδέσεις</div><div style={{ fontSize:11, color:'#6b6b80' }}>Μόνο όσοι είναι στο δίκτυό σου</div></div></div>}
            {visibilityInfo.visibility?.startsWith('user:') && <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#faf5ff', borderRadius:12, marginBottom:8 }}><span style={{ fontSize:20 }}>👤</span><div><div style={{ fontSize:13, fontWeight:600 }}>Συγκεκριμένος χρήστης</div><div style={{ fontSize:11, color:'#6b6b80' }}>{visibilityInfo.visibility.replace('user:','')}</div></div></div>}
            <button onClick={()=>setVisibilityInfo(null)} style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:'#1a1a1a', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:8 }}>Κλείσιμο</button>
          </div>
        </div>
      )}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a1a', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'8px 0 max(8px, env(safe-area-inset-bottom))', zIndex:300, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <MobBtn icon={Ic.home} label="Αρχική" active onClick={()=>{ goHome(); loadData(); }} />
          <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')} />
          <MobBtn icon={Ic.back} label="Επιστροφή" disabled={!hasSession} onClick={goBack} />
        </nav>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* Sidebar for Student role */
function Sidebar({ open, setOpen, goHome, goBack, hasSession, active, unseenCount, tab, setTab }) {
  return (
    <div style={{ ...S.sidebar, width: open ? 220 : 56 }}>
      <div style={S.sidebarHeader}>
        {open && <span style={{ fontSize:15, fontWeight:500, color:'#ececec' }}>ΛΕΒΙΑΘΑΝ</span>}
        <button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open ? '◀' : '▶'}</button>
      </div>
      <nav style={S.nav}>
        <button onClick={goHome} style={{ ...S.navItem, ...(active==='home'?S.navActive:{}) }}>
          <span style={S.navIcon}>{Ic.home}</span>
          {open && <span style={{ flex:1 }}>Αρχική</span>}
          {open && unseenCount > 0 && tab !== 'home' && <span style={S.badge}>{unseenCount}</span>}
        </button>
        <div style={S.navDiv} />
        <button onClick={()=>window.open('/live','_blank')} style={S.navItem}>
          <span style={S.navIcon}>{Ic.live}</span>{open && 'Live'}
        </button>
        <div style={S.navDiv} />
        {hasSession && (
          <button onClick={goBack} style={S.navItem}>
            <span style={S.navIcon}>{Ic.back}</span>{open && 'Επιστροφή'}
          </button>
        )}
      </nav>
      <div style={S.sidebarFooter}>
        <div style={S.userCard}>
          <div style={{ ...S.userAvatar, background:'#b8d4e3' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          {open && <div style={{ fontSize:12, color:'#ececec' }}>Μαθητής</div>}
        </div>
      </div>
    </div>
  );
}

/* Sidebar for Teacher role (original) */
function TeacherSidebar({ open, setOpen, goHome, goBack, hasSession, active }) {
  return (
    <div style={{ ...S.sidebar, width: open ? 220 : 56 }}>
      <div style={S.sidebarHeader}>
        {open && <span style={{ fontSize:15, fontWeight:500, color:'#ececec' }}>ΛΕΒΙΑΘΑΝ</span>}
        <button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open ? '◀' : '▶'}</button>
      </div>
      <nav style={S.nav}>
        <button onClick={goHome} style={{ ...S.navItem, ...(active==='home'?S.navActive:{}) }}>
          <span style={S.navIcon}>{Ic.home}</span>{open && 'Αρχική'}
        </button>
        <div style={S.navDiv} />
        <button onClick={()=>window.open('/live','_blank')} style={S.navItem}>
          <span style={S.navIcon}>{Ic.live}</span>{open && 'Live'}
        </button>
        <div style={S.navDiv} />
        {hasSession && (
          <button onClick={goBack} style={S.navItem}>
            <span style={S.navIcon}>{Ic.back}</span>{open && 'Επιστροφή'}
          </button>
        )}
      </nav>
      <div style={S.sidebarFooter}>
        <div style={S.userCard}>
          <div style={{ ...S.userAvatar, background:'#b8d4e3' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          {open && <div style={{ fontSize:12, color:'#ececec' }}>Εκπαιδευτικός</div>}
        </div>
      </div>
    </div>
  );
}

/* Mobile nav button */
function MobBtn({ icon, label, active, disabled, onClick, badge }) {
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'transparent', border:'none', color: active ? '#ececec' : '#8e8ea0', fontSize:10, cursor: disabled ? 'default' : 'pointer', padding:'4px 8px', opacity: disabled ? 0.35 : 1, position:'relative' }}>
      {icon}<span>{label}</span>
      {badge > 0 && <span style={{ position:'absolute', top:-2, right:0, ...S.badgeStyle }}>{badge}</span>}
    </button>
  );
}


/* ── Styles ── */
const css = `
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  @media(max-width:767px){
    .student-main{padding-bottom:70px !important;margin-left:0 !important;max-width:100vw !important;overflow-x:hidden !important;}
    html,body{overflow-x:hidden !important;max-width:100vw !important;}
  }
  .ri-h:hover{background:#f9f6ed !important;}
`;

const S = {
  page:{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f0e1', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif" },
  app:{ display:'flex', minHeight:'100vh', maxWidth:'100vw', overflowX:'hidden', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif", background:'#fafafa' },
  sidebar:{ position:'fixed', top:0, left:0, height:'100vh', background:'#1a1a1a', display:'flex', flexDirection:'column', zIndex:200, transition:'width 0.2s ease', overflowX:'hidden' },
  sidebarHeader:{ padding:'16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  collapseBtn:{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#8e8ea0', width:28, height:28, borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  nav:{ flex:1, padding:8, overflowY:'auto' },
  navItem:{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'transparent', border:'none', borderRadius:8, color:'#8e8ea0', fontSize:13, cursor:'pointer', marginBottom:1, textAlign:'left' },
  navActive:{ background:'rgba(255,255,255,0.08)', color:'#ececec' },
  navIcon:{ flexShrink:0, width:18, display:'flex', alignItems:'center', justifyContent:'center' },
  navDiv:{ height:1, background:'rgba(255,255,255,0.06)', margin:'8px 4px' },
  sidebarFooter:{ padding:10, borderTop:'1px solid rgba(255,255,255,0.06)' },
  userCard:{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8 },
  userAvatar:{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  main:{ flex:1, transition:'margin-left 0.2s ease' },
  container:{ maxWidth:1280, margin:'0 auto', padding:'24px 16px' },
  empty:{ textAlign:'center', color:'#b0b0b0', padding:32, fontSize:14 },
  emptyCol:{ textAlign:'center', color:'#aeaeb8', padding:32, fontSize:13, background:'#fff', borderRadius:14, border:'1px dashed #e0e0e0' },
  openBtn:{ background:'transparent', border:'1.5px solid '+PALETTE.cream.deep, borderRadius:10, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:PALETTE.cream.deep, flexShrink:0 },
  miniBtn:{ background:PALETTE.cream.bg, border:'1.5px solid '+PALETTE.cream.accent, borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13, flexShrink:0, padding:0 },
  badge:{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:18, height:18, borderRadius:9, background:'#f59e0b', color:'#fff', fontSize:10, fontWeight:700, padding:'0 5px' },
  badgeStyle:{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:16, height:16, borderRadius:8, background:'#f59e0b', color:'#fff', fontSize:9, fontWeight:700, padding:'0 4px' },
};
