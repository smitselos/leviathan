// pages/live.js — Δημόσια σελίδα live (split-view)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const PALETTE = {
  cream: { bg:'#f5f0e1', bgSoft:'#faf6ea', deep:'#8a7d4a', accent:'#e8dfc4' },
  peach: { deep:'#c97b5a', accent:'#f0c9a8' },
};
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (t) => TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

export default function LivePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-load αν υπάρχει code στο URL
  useEffect(() => {
    if (router.query.code) { setCode(router.query.code); loadLive(router.query.code); }
  }, [router.query.code]);

  const loadLive = async (c) => {
    const useCode = c || code.trim();
    if (!useCode || useCode.length < 4) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/live?code=${encodeURIComponent(useCode)}`);
      if (!r.ok) { setError('Δεν βρέθηκε. Ελέγξτε τον κωδικό.'); setData(null); }
      else { const d = await r.json(); setData(d.data); setActiveTab(0); }
    } catch { setError('Σφάλμα σύνδεσης.'); }
    setLoading(false);
  };

  const file = data?.file;
  const links = data?.links || [];

  /* ── Code entry screen ── */
  if (!data) {
    return (
      <div style={S.entryWrap}>
        <Head><title>Live — ΛΕΒΙΑΘΑΝ</title></Head>
        <style>{css}</style>
        <div style={S.entryCard}>
          <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2, color:PALETTE.cream.deep, marginBottom:8 }}>ΛΕΒΙΑΘΑΝ</div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1a1a1a', margin:'0 0 8px' }}>Live</h1>
          <p style={{ fontSize:14, color:'#6b6b80', margin:'0 0 28px' }}>Εισάγετε τον κωδικό του εκπαιδευτικού</p>
          <input
            type="text" inputMode="numeric" maxLength={4}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))}
            onKeyDown={e => { if (e.key==='Enter') loadLive(); }}
            placeholder="····"
            style={S.codeInput}
            autoFocus
          />
          <button onClick={()=>loadLive()} disabled={code.length<4||loading}
            style={{ ...S.enterBtn, opacity: code.length<4?0.4:1 }}>
            {loading ? 'Φόρτωση…' : 'Είσοδος →'}
          </button>
          {error && <div style={{ marginTop:16, color:'#dc2626', fontSize:13 }}>{error}</div>}
        </div>
      </div>
    );
  }

  /* ── Mobile live view ── */
  if (isMobile) {
    const curLink = links[activeTab] || null;
    const curSrc = activeTab === -1
      ? `https://drive.google.com/file/d/${file.id}/preview`
      : (curLink?.type === 'url' ? curLink.url : `https://drive.google.com/file/d/${curLink?.targetId}/preview`);

    return (
      <div style={{ position:'fixed', inset:0, background:'#fff', display:'flex', flexDirection:'column' }}>
        <Head><title>{file.name} — Live</title></Head>
        <style>{css}</style>
        <div style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderBottom:'1px solid #ebebeb', gap:8, flexShrink:0, background:'#1a1a1a' }}>
          <button onClick={()=>setData(null)} style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'#fff', padding:'4px' }}>←</button>
          <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:1, color:'#e8c96a', flexShrink:0 }}>LIVE</div>
          <strong style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color:'#fff' }}>{file.name}</strong>
        </div>
        {/* Tags & questions */}
        {((file.tags||[]).length > 0 || (file.questions||'').trim()) && (
          <div style={{ padding:'8px 12px', borderBottom:'1px solid #f0f0f0', background:'#fefdfb', flexShrink:0 }}>
            {(file.tags||[]).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:(file.questions?6:0) }}>
                {file.tags.map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
              </div>
            )}
            {(file.questions||'').trim() && <div style={{ fontSize:12, color:'#4a3f1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>📝 {file.questions}</div>}
          </div>
        )}
        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, padding:'6px 10px', overflowX:'auto', borderBottom:'1px solid #f0f0f0', flexShrink:0, background:PALETTE.cream.bgSoft }}>
          <button onClick={()=>setActiveTab(-1)} style={{ ...S.tab, background:activeTab===-1?'#1a1a1a':'transparent', color:activeTab===-1?'#fff':PALETTE.cream.deep }}>📄 Αρχείο</button>
          {links.map((lnk, i) => (
            <button key={i} onClick={()=>setActiveTab(i)} style={{ ...S.tab, background:activeTab===i?'#1a1a1a':'transparent', color:activeTab===i?'#fff':PALETTE.cream.deep }}>
              {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>18?lnk.name.slice(0,18)+'…':lnk.name}
            </button>
          ))}
        </div>
        <div style={{ flex:1 }}>
          <iframe src={curSrc} style={{ border:'none', width:'100%', height:'100%', display:'block' }} title={activeTab===-1?file.name:(curLink?.name||'')} allow="fullscreen" />
        </div>
      </div>
    );
  }

  /* ── Desktop split-view ── */
  const curLink = links[activeTab] || null;
  const curSrc = curLink ? (curLink.type === 'url' ? curLink.url : `https://drive.google.com/file/d/${curLink.targetId}/preview`) : null;

  return (
    <div style={{ position:'fixed', inset:0, background:'#fff', display:'flex', flexDirection:'column' }}>
      <Head><title>{file.name} — Live</title></Head>
      <style>{css}</style>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'8px 16px', background:'#1a1a1a', gap:12, flexShrink:0 }}>
        <button onClick={()=>setData(null)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:12, color:'#fff' }}>← Πίσω</button>
        <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:2, color:'#e8c96a', flexShrink:0, fontWeight:700 }}>● LIVE</div>
        <strong style={{ flex:1, fontSize:14, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</strong>
        <span style={{ fontSize:12, color:'#aeaeb8' }}>by {data.teacher}</span>
      </div>

      {/* Tags & questions bar */}
      {((file.tags||[]).length > 0 || (file.questions||'').trim()) && (
        <div style={{ padding:'8px 16px', borderBottom:'1px solid #f0f0f0', background:'#fefdfb', flexShrink:0, display:'flex', gap:16, alignItems:'flex-start' }}>
          {(file.tags||[]).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {file.tags.map(t => { const c=tagColor(t); return <span key={t} style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
            </div>
          )}
          {(file.questions||'').trim() && <div style={{ fontSize:13, color:'#4a3f1a', lineHeight:1.5, whiteSpace:'pre-wrap', flex:1 }}>📝 {file.questions}</div>}
        </div>
      )}

      {/* Split content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Left: main file */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight: links.length ? '1px solid #ebebeb' : 'none', minWidth:0 }}>
          <iframe src={`https://drive.google.com/file/d/${file.id}/preview`} style={{ flex:1, border:'none', width:'100%' }} title={file.name} allow="fullscreen" />
        </div>
        {/* Right: linked items */}
        {links.length > 0 && (
          <div style={{ width:'42%', flexShrink:0, display:'flex', flexDirection:'column', background:PALETTE.cream.bgSoft }}>
            <div style={{ display:'flex', gap:4, padding:'8px 10px', flexWrap:'wrap', borderBottom:'1px solid #ebebeb', flexShrink:0 }}>
              {links.map((lnk, i) => (
                <button key={i} onClick={()=>setActiveTab(i)}
                  style={{ ...S.tab, background:activeTab===i?'#1a1a1a':'transparent', color:activeTab===i?'#fff':PALETTE.cream.deep }}>
                  {lnk.type==='url'?'🌐':'📄'} {lnk.name.length>25?lnk.name.slice(0,25)+'…':lnk.name}
                </button>
              ))}
            </div>
            <div style={{ flex:1, overflow:'hidden' }}>
              {curSrc ? (
                <iframe src={curSrc} style={{ width:'100%', height:'100%', border:'none' }} title={curLink?.name||''} allow="fullscreen" />
              ) : (
                <div style={{ padding:20, textAlign:'center', color:'#aeaeb8', fontSize:13 }}>Επίλεξε μια σύνδεση</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const css = `*{box-sizing:border-box;}html,body{margin:0;padding:0;}`;
const S = {
  entryWrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a1a1a 0%,#2d2a1e 100%)', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding:20 },
  entryCard: { background:'#fff', borderRadius:24, padding:'48px 40px', textAlign:'center', maxWidth:380, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  codeInput: { width:'100%', textAlign:'center', fontSize:36, fontWeight:700, letterSpacing:12, padding:'16px 0', border:'2px solid #ebebeb', borderRadius:16, outline:'none', marginBottom:20, fontFamily:'monospace' },
  enterBtn: { width:'100%', padding:'14px 0', borderRadius:14, border:'none', background:'#1a1a1a', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer' },
  tab: { padding:'5px 12px', borderRadius:10, border:'1px solid rgba(0,0,0,0.06)', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
};
