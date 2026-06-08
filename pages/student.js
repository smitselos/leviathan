// pages/student.js — Δημόσια σελίδα μαθητών (χωρίς login)
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const PALETTE = {
  cream:   { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach:   { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
};
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (t) => TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

/* ── Icons ── */
const Ic = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  live: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H19a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="8 17 3 12 8 7"/><line x1="3" y1="12" x2="15" y2="12"/></svg>,
};

export default function StudentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const hasSession = !!session?.accessToken;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/publish');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({ files: d.items || [] });
    } catch { setError('Δεν βρέθηκαν δημοσιευμένα αρχεία.'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 30000); return () => clearInterval(iv); }, [loadData]);

  const files = data?.files || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q) || (f.tags||[]).some(t=>t.toLowerCase().includes(q)));
  }, [files, search]);

  const openFile = (f) => {
    if (isMobile) { window.open(`https://drive.google.com/file/d/${f.id}/preview`, '_blank'); return; }
    setViewing(f);
  };

  const goHome = () => { setViewing(null); setSearch(''); loadData(); };
  const goBack = () => { if (hasSession) router.push('/'); else router.push('/login'); };

  /* ── Desktop viewer ── */
  if (viewing && !isMobile) {
    const driveUrl = `https://drive.google.com/file/d/${viewing.id}/preview`;
    return (
      <div style={S.app}>
        <Head><title>{viewing.name} — Student</title></Head>
        <style>{css}</style>
        {/* Sidebar stays */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="view" />
        <div style={{ ...S.main, marginLeft: sidebarOpen ? 220 : 56 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff', gap:10 }}>
            <button onClick={goHome} style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444' }}>← Πίσω</button>
            <strong style={{ flex:1, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1a1a1a' }}>{viewing.name}</strong>
          </div>
          {((viewing.tags||[]).length > 0 || (viewing.questions||'').trim()) && (
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #f0f0f0', background:'#fefdfb' }}>
              {(viewing.tags||[]).length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:(viewing.questions?8:0) }}>
                  {viewing.tags.map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                </div>
              )}
              {(viewing.questions||'').trim() && (
                <div style={{ fontSize:13, color:'#4a3f1a', lineHeight:1.6, whiteSpace:'pre-wrap' }}>📝 {viewing.questions}</div>
              )}
            </div>
          )}
          <iframe src={driveUrl} style={{ flex:1, border:'none', width:'100%', display:'block', height:'calc(100vh - 100px)' }} title={viewing.name} allow="fullscreen" />
        </div>
      </div>
    );
  }

  /* ── Main list ── */
  return (
    <div style={S.app}>
      <Head><title>Student — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession} active="home" />}

      <div className="student-main" style={{ ...S.main, marginLeft: !isMobile ? (sidebarOpen?220:56) : 0 }}>

        {/* Mobile top bar */}
        {isMobile && !viewing && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px', borderBottom:'1px solid #eee', background:'#fff' }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>ΛΕΒΙΑΘΑΝ</span>
          </div>
        )}

        <div style={S.container}>
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontSize:22, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Καλώς ήρθες 📚</h1>
            <p style={{ fontSize:14, color:'#6b6b80', margin:0 }}>Υλικό που έχει δημοσιεύσει ο εκπαιδευτικός</p>
          </div>

          {loading && <div style={S.empty}>Φόρτωση…</div>}
          {error && <div style={{ textAlign:'center', padding:60, color:'#dc2626', fontSize:14 }}>{error}</div>}

          {data && !loading && (
            <>
              {/* Stat card */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14, marginBottom:32 }}>
                <div style={{ borderRadius:18, padding:'16px 18px', background:PALETTE.cream.bg, color:PALETTE.cream.text, minHeight:100 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Διαθέσιμο υλικό</div>
                      <div style={{ fontSize:32, fontWeight:700, lineHeight:1, letterSpacing:'-0.02em' }}>{files.length}</div>
                      <div style={{ fontSize:12, marginTop:6 }}>Αρχεία</div>
                    </div>
                    <div style={{ width:44, height:44, borderRadius:14, background:PALETTE.cream.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📚</div>
                  </div>
                </div>
              </div>

              {/* Search */}
              {files.length > 0 && (
                <input type="search" placeholder="Αναζήτηση αρχείου ή ετικέτας…" value={search} onChange={e=>setSearch(e.target.value)}
                  style={{ width:'100%', padding:'11px 16px', border:'1px solid #ebebeb', borderRadius:14, fontSize: isMobile?16:14, background:'#fff', marginBottom:18, boxSizing:'border-box' }} />
              )}

              {files.length === 0 && (
                <div style={{ textAlign:'center', padding:60 }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
                  <div style={{ fontSize:15, color:'#6b6b80' }}>Δεν υπάρχει διαθέσιμο υλικό αυτή τη στιγμή.</div>
                  <div style={{ fontSize:13, color:'#aeaeb8', marginTop:8 }}>Ο εκπαιδευτικός θα δημοσιεύσει υλικό κατά τη διάρκεια του μαθήματος.</div>
                </div>
              )}

              {/* File list */}
              {filtered.length > 0 && (
                <div style={{ marginBottom:40 }}>
                  <div style={{ fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:14 }}>Υλικό μαθήματος</div>
                  <div style={{ background:'#fff', borderRadius:18, overflow:'hidden', border:'1px solid #f0f0f0' }}>
                    {filtered.map((f, i) => (
                      <div key={f.id} className="ri-h" onClick={()=>openFile(f)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', borderBottom: i<filtered.length-1 ? '1px solid #f0f0f0' : 'none', transition:'background 0.1s' }}>
                        <div style={{ width:42, height:42, borderRadius:12, background:PALETTE.cream.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>📄</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                            {(f.tags||[]).slice(0,3).map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                            {(f.tags||[]).length > 3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{f.tags.length-3}</span>}
                          </div>
                        </div>
                        {!isMobile && <button style={{ background:'transparent', border:'1.5px solid '+PALETTE.cream.deep, borderRadius:10, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:PALETTE.cream.deep, flexShrink:0 }}>Άνοιγμα →</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {search && filtered.length === 0 && (
                <div style={{ textAlign:'center', padding:40, color:'#aeaeb8', fontSize:13 }}>Κανένα αρχείο δεν ταιριάζει.</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a1a', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'8px 0 max(8px, env(safe-area-inset-bottom))', zIndex:300, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <MobBtn icon={Ic.home} label="Αρχική" active onClick={()=>{ goHome(); loadData(); }} />
          <MobBtn icon={Ic.live} label="Live" disabled />
          <MobBtn icon={Ic.back} label="Επιστροφή" disabled={!hasSession} onClick={goBack} />
        </nav>
      )}
    </div>
  );
}

/* ── Sidebar component ── */
function Sidebar({ open, setOpen, goHome, goBack, hasSession, active }) {
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
        <button style={{ ...S.navItem, opacity:0.35, cursor:'default' }} disabled>
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

/* ── Mobile nav button ── */
function MobBtn({ icon, label, active, disabled, onClick }) {
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'transparent', border:'none', color: active ? '#ececec' : '#8e8ea0', fontSize:10, cursor: disabled ? 'default' : 'pointer', padding:'4px 8px', opacity: disabled ? 0.35 : 1 }}>
      {icon}<span>{label}</span>
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
};
