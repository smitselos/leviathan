// pages/student.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const PALETTE = {
  cream: { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach: { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
};
const TAG_COLORS = [
  {bg:'#ede9fe',text:'#6d28d9'},{bg:'#dcfce7',text:'#15803d'},
  {bg:'#fef3c7',text:'#b45309'},{bg:'#dbeafe',text:'#1d4ed8'},
  {bg:'#fce7f3',text:'#9d174d'},{bg:'#e0f2fe',text:'#0369a1'},
  {bg:'#f3f4f6',text:'#374151'},
];
const tagColor = (t) => TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

const Ic = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  live: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H19a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="8 17 3 12 8 7"/><line x1="3" y1="12" x2="15" y2="12"/></svg>,
};

/* ── Fetch files for one teacher (with visitor filtering) ── */
async function fetchTeacherFiles(teacherEmail, visitorEmail) {
  const params = new URLSearchParams({ email: teacherEmail });
  if (visitorEmail && visitorEmail !== teacherEmail) params.set('visitor', visitorEmail);
  const r = await fetch(`/api/publish?${params}`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.items || []).map(f => ({ ...f, _teacher: teacherEmail }));
}

export default function StudentPage() {
  const router = useRouter();
  const { teacher: teacherParam } = router.query;
  const { data: session } = useSession();
  const hasSession = !!session?.accessToken;
  const myEmail = session?.user?.email || null;

  const [tabs, setTabs] = useState([]);           // [{ email, name, files }]
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTagFilter] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadTabs = useCallback(async () => {
    setLoading(true);
    try {
      const newTabs = [];

      if (teacherParam) {
        // Άνοιξε απευθείας για συγκεκριμένο εκπαιδευτικό
        const files = await fetchTeacherFiles(teacherParam, myEmail);
        newTabs.push({ email: teacherParam, name: teacherParam.split('@')[0], files });
      } else if (myEmail) {
        // Δικά μου αρχεία
        const myFiles = await fetchTeacherFiles(myEmail, myEmail);
        if (myFiles.length > 0) newTabs.push({ email: myEmail, name: 'Δικά μου', files: myFiles, isMine: true });

        // Αρχεία συνδέσεων
        try {
          const nr = await fetch('/api/network');
          const nd = await nr.json();
          const conns = nd.connections || [];
          const connFiles = await Promise.all(
            conns.map(async c => {
              const files = await fetchTeacherFiles(c.email, myEmail);
              return { email: c.email, name: c.name || c.email.split('@')[0], files };
            })
          );
          connFiles.forEach(t => { if (t.files.length > 0) newTabs.push(t); });
        } catch(e) {}
      } else {
        // Ανώνυμος — χωρίς teacher param δεν ξέρουμε ποιον να φορτώσουμε
        newTabs.push({ email: '', name: '', files: [], empty: true });
      }

      setTabs(newTabs);
    } catch(e) {}
    setLoading(false);
  }, [teacherParam, myEmail]);

  useEffect(() => { if (router.isReady) loadTabs(); }, [router.isReady, loadTabs]);

  const currentTab = tabs[activeTab] || null;
  const files = currentTab?.files || [];

  const allTags = useMemo(() => {
    const m = {};
    files.forEach(f => (f.tags||[]).forEach(t => { m[t]=(m[t]||0)+1; }));
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [files]);

  const filtered = useMemo(() => {
    let r = [...files];
    if (activeTag) r = r.filter(f => (f.tags||[]).includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(f => f.name.toLowerCase().includes(q) || (f.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }
    return r;
  }, [files, search, activeTag]);

  const openFile = (f) => {
    const isHtml = /\.html?$/i.test(f.name);
    const url = isHtml ? `/api/student-file?id=${f.id}` : `/api/student-file?id=${f.id}`;
    if (isMobile) { window.open(url, '_blank'); return; }
    setViewing(f);
  };

  const goHome = () => { setViewing(null); setSearch(''); setActiveTagFilter(null); loadTabs(); };
  const goBack = () => { if (hasSession) router.push('/'); else router.push('/login'); };

  /* ── Desktop viewer ── */
  if (viewing && !isMobile) {
    const src = `/api/student-file?id=${viewing.id}`;
    return (
      <div style={S.app}>
        <Head><title>{viewing.name} — Student</title></Head>
        <style>{css}</style>
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="view" />
        <div style={{ ...S.main, marginLeft: sidebarOpen ? 220 : 56, display:'flex', flexDirection:'column', height:'100vh' }}>
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff', gap:10, flexShrink:0 }}>
            <button onClick={goHome} style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444' }}>← Πίσω</button>
            <strong style={{ flex:1, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1a1a1a' }}>{viewing.name}</strong>
            {viewing._teacher && viewing._teacher !== myEmail && (
              <span style={{ fontSize:11, color:'#aeaeb8', flexShrink:0 }}>από {viewing._teacher.split('@')[0]}</span>
            )}
          </div>
          <iframe src={src} style={{ flex:1, border:'none', width:'100%' }} title={viewing.name} allow="fullscreen" />
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div style={S.app}>
      <Head><title>Student — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>
      {!isMobile && <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="home" />}

      <div className="student-main" style={{ ...S.main, marginLeft: !isMobile ? (sidebarOpen?220:56) : 0 }}>
        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff' }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>ΛΕΒΙΑΘΑΝ · Student</span>
          </div>
        )}

        <div style={S.container}>
          {/* Tabs — εμφανίζονται μόνο αν >1 */}
          {tabs.length > 1 && (
            <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
              {tabs.map((tab, i) => (
                <button key={tab.email || i} onClick={() => { setActiveTab(i); setSearch(''); setActiveTagFilter(null); setViewing(null); }}
                  style={{
                    padding:'8px 18px', borderRadius:12, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background: activeTab===i ? '#1a1a1a' : '#fff',
                    color: activeTab===i ? '#fff' : '#5c4a1e',
                    boxShadow: activeTab===i ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                  {tab.isMine ? '📚 Δικά μου' : `👤 ${tab.name}`}
                  <span style={{ marginLeft:6, fontSize:11, opacity:0.7 }}>({tab.files.length})</span>
                </button>
              ))}
            </div>
          )}

          {loading && <div style={S.empty}>Φόρτωση…</div>}

          {!loading && tabs.length === 0 && (
            <div style={{ textAlign:'center', padding:60 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
              <div style={{ fontSize:15, color:'#6b6b80' }}>
                {myEmail ? 'Δεν υπάρχει διαθέσιμο υλικό.' : 'Χρειάζεται σύνδεσμος εκπαιδευτικού ή σύνδεση.'}
              </div>
            </div>
          )}

          {!loading && currentTab && (
            <>
              <div style={{ marginBottom:20 }}>
                <h1 style={{ fontSize:20, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>
                  {currentTab.isMine ? 'Τα αρχεία μου' : `Υλικό: ${currentTab.name}`}
                </h1>
                {!currentTab.isMine && <div style={{ fontSize:12, color:'#aeaeb8' }}>{currentTab.email}</div>}
              </div>

              {files.length > 0 && (
                <input type="search" placeholder="Αναζήτηση…" value={search} onChange={e=>setSearch(e.target.value)}
                  style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize:isMobile?16:14, background:'#fff', marginBottom:12, boxSizing:'border-box' }} />
              )}

              {allTags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18 }}>
                  {activeTag && <button onClick={()=>setActiveTagFilter(null)} style={{ padding:'5px 12px', borderRadius:10, border:'1px solid #ddd', background:'#fff', fontSize:12, cursor:'pointer', color:'#888' }}>✕ Όλα</button>}
                  {allTags.map(([tag, count]) => {
                    const c = tagColor(tag); const isActive = activeTag===tag;
                    return <button key={tag} onClick={()=>setActiveTagFilter(isActive?null:tag)}
                      style={{ padding:'5px 12px', borderRadius:10, border:isActive?'2px solid '+c.text:'1px solid #e0e0e0', background:isActive?c.bg:'#fafafa', fontSize:12, cursor:'pointer', color:c.text, fontWeight:isActive?700:500 }}>
                      #{tag} <span style={{ fontSize:10, opacity:0.6 }}>({count})</span>
                    </button>;
                  })}
                </div>
              )}

              {files.length === 0 && (
                <div style={{ textAlign:'center', padding:60 }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
                  <div style={{ fontSize:15, color:'#6b6b80' }}>Δεν υπάρχει διαθέσιμο υλικό.</div>
                </div>
              )}

              {filtered.length > 0 && (
                <div style={{ background:'#fff', borderRadius:18, overflow:'hidden', border:'1px solid #f0f0f0', marginBottom:40 }}>
                  {filtered.map((f, i) => (
                    <div key={f.id} className="ri-h" onClick={()=>openFile(f)}
                      style={{ display:'flex', alignItems:'center', gap:isMobile?10:12, padding:isMobile?'14px 12px':'12px 14px', cursor:'pointer', borderBottom:i<filtered.length-1?'1px solid #f0f0f0':'none' }}>
                      <div style={{ width:isMobile?38:42, height:isMobile?38:42, borderRadius:12, background:PALETTE.cream.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:isMobile?16:18 }}>📄</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:isMobile?13:14, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                          {(f.tags||[]).slice(0,3).map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                          {(f.tags||[]).length>3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{f.tags.length-3}</span>}
                        </div>
                      </div>
                      {isMobile
                        ? <span style={{ fontSize:15, color:PALETTE.cream.deep, fontWeight:700, flexShrink:0 }}>→</span>
                        : <button style={{ background:'transparent', border:'1.5px solid '+PALETTE.cream.deep, borderRadius:10, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:PALETTE.cream.deep, flexShrink:0 }}>Άνοιγμα →</button>}
                    </div>
                  ))}
                </div>
              )}
              {search && filtered.length===0 && <div style={{ textAlign:'center', padding:40, color:'#aeaeb8', fontSize:13 }}>Κανένα αποτέλεσμα.</div>}
            </>
          )}
        </div>
      </div>

      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a1a', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'8px 0 max(8px, env(safe-area-inset-bottom))', zIndex:300, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <MobBtn icon={Ic.home} label="Αρχική" active onClick={goHome} />
          <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')} />
          <MobBtn icon={Ic.back} label="Επιστροφή" disabled={!hasSession} onClick={goBack} />
        </nav>
      )}
    </div>
  );
}

function Sidebar({ open, setOpen, goHome, goBack, hasSession, active }) {
  return (
    <div style={{ ...S.sidebar, width:open?220:56 }}>
      <div style={S.sidebarHeader}>
        {open && <span style={{ fontSize:15, fontWeight:500, color:'#ececec' }}>ΛΕΒΙΑΘΑΝ</span>}
        <button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open?'◀':'▶'}</button>
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
        {hasSession && <button onClick={goBack} style={S.navItem}><span style={S.navIcon}>{Ic.back}</span>{open && 'Επιστροφή'}</button>}
      </nav>
      <div style={S.sidebarFooter}>
        <div style={S.userCard}>
          <div style={{ ...S.userAvatar, background:'#b8d4e3' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          {open && <div style={{ fontSize:12, color:'#ececec' }}>Student</div>}
        </div>
      </div>
    </div>
  );
}

function MobBtn({ icon, label, active, disabled, onClick }) {
  return (
    <button onClick={disabled?undefined:onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'transparent', border:'none', color:active?'#ececec':'#8e8ea0', fontSize:10, cursor:disabled?'default':'pointer', padding:'4px 8px', opacity:disabled?0.35:1 }}>
      {icon}<span>{label}</span>
    </button>
  );
}

const css = `
  *{box-sizing:border-box;}html,body{margin:0;padding:0;}
  @media(max-width:767px){.student-main{padding-bottom:70px !important;}}
  .ri-h:hover{background:#f9f6ed !important;}
`;
const S = {
  app:{ display:'flex', minHeight:'100vh', maxWidth:'100vw', overflowX:'hidden', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background:'#fafafa' },
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
};
