// pages/live.js — Δημόσια σελίδα live παρουσίασης
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
];
const tagColor = (t) => TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

export default function LivePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [entered, setEntered] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('pdf');
  const [splitTab, setSplitTab] = useState(0);

  useEffect(() => {
    if (router.query.code) { setCode(router.query.code); setEntered(true); }
  }, [router.query.code]);

  const fetchSession = useCallback(async () => {
    if (!code || !entered) return;
    try {
      const r = await fetch(`/api/live?code=${code}`);
      if (r.status === 404) { setError('Δεν βρέθηκε παρουσίαση με αυτόν τον κωδικό.'); return; }
      const data = await r.json();
      if (data.updatedAt !== lastUpdated) {
        setSession(data);
        setLastUpdated(data.updatedAt);
        setActiveTab('pdf');
        setSplitTab(0);
        setError(null);
      }
    } catch (e) {}
  }, [code, entered, lastUpdated]);

  useEffect(() => {
    if (!entered) return;
    fetchSession();
    const iv = setInterval(fetchSession, 3000);
    return () => clearInterval(iv);
  }, [entered, fetchSession]);

  /* ── Code entry ── */
  if (!entered) {
    return (
      <div style={S.entryWrap}>
        <Head><title>Live — ΛΕΒΙΑΘΑΝ</title></Head>
        <style>{css}</style>
        <div style={S.entryCard}>
          <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2, color:'#e8c96a', marginBottom:8 }}>ΛΕΒΙΑΘΑΝ</div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1a1a1a', margin:'0 0 8px' }}>Live</h1>
          <p style={{ fontSize:14, color:'#6b6b80', margin:'0 0 28px' }}>Εισάγετε τον κωδικό του εκπαιδευτικού</p>
          <input type="text" inputMode="numeric" maxLength={4} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g,''))}
            onKeyDown={e => { if (e.key==='Enter' && code.length===4) setEntered(true); }}
            placeholder="····" style={S.codeInput} autoFocus />
          <button onClick={()=>setEntered(true)} disabled={code.length<4}
            style={{ ...S.enterBtn, opacity:code.length<4?0.4:1 }}>
            Είσοδος →
          </button>
        </div>
      </div>
    );
  }

  /* ── Waiting / error ── */
  if (!session) {
    return (
      <div style={{ minHeight:'100vh', background:'#1a1a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
        <Head><title>Live {code} — ΛΕΒΙΑΘΑΝ</title></Head>
        <style>{css}</style>
        <div style={{ color:'#e8c96a', fontSize:48, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>{code}</div>
        <div style={{ color:'#8e8ea0', fontSize:14, marginBottom:32 }}>{error || 'Αναμονή παρουσίασης…'}</div>
        {!error && (
          <div style={{ display:'flex', gap:6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#e8c96a', opacity:0.4, animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        )}
        {error && <button onClick={()=>{setEntered(false);setError(null);setCode('');}} style={{ ...S.enterBtn, width:'auto', padding:'10px 24px', marginTop:10 }}>← Νέος κωδικός</button>}
        <style>{`@keyframes pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}`}</style>
      </div>
    );
  }

  /* ── Live presentation ── */
  const links = session.links || [];
  const hasLinks = links.length > 0;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column' }}>
      <Head><title>{session.title} — Live</title></Head>
      <style>{css}</style>

      {/* Tab bar */}
      {hasLinks && (
        <div style={{ display:'flex', background:'#1a1a1a', flexShrink:0, height:44 }}>
          <button onClick={()=>setActiveTab('pdf')}
            style={{ ...S.tabBtn, borderBottom: activeTab==='pdf'?'2px solid #e8c96a':'2px solid transparent', color: activeTab==='pdf'?'#e8c96a':'#8e8ea0', fontWeight: activeTab==='pdf'?700:400 }}>
            📄 {session.title.length>30?session.title.slice(0,30)+'…':session.title}
          </button>
          {links.map((lnk, i) => (
            <button key={i} onClick={()=>setActiveTab('link-'+i)}
              style={{ ...S.tabBtn, borderBottom: activeTab===('link-'+i)?'2px solid #e8c96a':'2px solid transparent', color: activeTab===('link-'+i)?'#e8c96a':'#8e8ea0', fontWeight: activeTab===('link-'+i)?700:400 }}>
              {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>25?lnk.name.slice(0,25)+'…':lnk.name}
            </button>
          ))}
          <button onClick={()=>setActiveTab('split')}
            style={{ width:60, ...S.tabBtn, borderBottom: activeTab==='split'?'2px solid #e8c96a':'2px solid transparent', color: activeTab==='split'?'#e8c96a':'#8e8ea0', fontSize:20 }}>
            ⊞
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        {activeTab==='pdf' && (
          <iframe src={session.src} style={{ flex:1, border:'none', width:'100%', height:'100%' }} title={session.title} allow="fullscreen" />
        )}
        {hasLinks && links.map((lnk, i) => (
          activeTab===('link-'+i) ? <LiveFrame key={i} lnk={lnk} /> : null
        ))}
        {activeTab==='split' && hasLinks && (
          <>
            <iframe src={session.src} style={{ flex:1, border:'none', width:'100%', height:'100%' }} title={session.title} allow="fullscreen" />
            <div style={{ width:3, background:'#333', flexShrink:0 }} />
            <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, height:'100%' }}>
              {links.length > 1 && (
                <div style={{ display:'flex', background:'#111', flexShrink:0 }}>
                  {links.map((lnk, i) => (
                    <button key={i} onClick={()=>setSplitTab(i)}
                      style={{ flex:1, background:'transparent', border:'none', borderBottom: splitTab===i?'2px solid #e8c96a':'2px solid transparent', color: splitTab===i?'#e8c96a':'#8e8ea0', fontSize:12, padding:'8px 4px', cursor:'pointer', fontFamily:'sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>20?lnk.name.slice(0,20)+'…':lnk.name}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex:1, overflow:'hidden', minHeight:0, display:'flex' }}>
                <LiveFrame lnk={links[splitTab]||links[0]} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom badge */}
      <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', borderRadius:20, padding:'5px 14px', color:'rgba(255,255,255,0.4)', fontSize:11, display:'flex', gap:8, alignItems:'center', fontFamily:'sans-serif' }}>
        <span style={{ color:'#e8c96a', fontWeight:600 }}>ΛΕΒΙΑΘΑΝ</span>
        <span>·</span>
        <span>{session.title}</span>
        <span>·</span>
        <span style={{ fontFamily:'monospace' }}>{code}</span>
      </div>
    </div>
  );
}

/* ── LiveFrame: iframe για Drive αρχεία, κάρτα για URL ── */
function LiveFrame({ lnk }) {
  if (!lnk) return null;
  if (lnk.type !== 'url') {
    return (
      <iframe src={lnk.src} style={{ flex:1, border:'none', width:'100%', height:'100%' }}
        title={lnk.name} allow="fullscreen" />
    );
  }
  /* URL: άνοιγμα σε νέα καρτέλα — αποφυγή freeze από frame-busting sites */
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f5f0e1', padding:24, textAlign:'center', height:'100%' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🌐</div>
      <div style={{ fontSize:16, fontWeight:600, color:'#1a1a1a', marginBottom:6, maxWidth:'80%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lnk.name}</div>
      <div style={{ fontSize:11, color:'#8a7d4a', marginBottom:24, wordBreak:'break-all', maxWidth:'80%', opacity:0.7 }}>{lnk.url}</div>
      <button onClick={() => window.open(lnk.url, '_blank', 'noopener')}
        style={{ padding:'14px 32px', borderRadius:14, border:'none', background:'#1a1a1a', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer' }}>
        Άνοιγμα σε νέα καρτέλα ↗
      </button>
    </div>
  );
}

const css = `*{box-sizing:border-box;margin:0;padding:0;}html,body{margin:0;padding:0;}`;
const S = {
  entryWrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a1a1a 0%,#2d2a1e 100%)', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding:20 },
  entryCard: { background:'#fff', borderRadius:24, padding:'48px 40px', textAlign:'center', maxWidth:380, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  codeInput: { width:'100%', textAlign:'center', fontSize:36, fontWeight:700, letterSpacing:12, padding:'16px 0', border:'2px solid #ebebeb', borderRadius:16, outline:'none', marginBottom:20, fontFamily:'monospace' },
  enterBtn: { width:'100%', padding:'14px 0', borderRadius:14, border:'none', background:'#1a1a1a', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer' },
  tabBtn: { flex:1, background:'transparent', border:'none', fontSize:13, cursor:'pointer', fontFamily:'sans-serif', padding:'0 8px' },
};
