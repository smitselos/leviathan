// pages/student.js
// Δημόσια σελίδα — δεν απαιτεί σύνδεση
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const PALETTE = {
  cream: { bg:'#faf8f1', deep:'#5c4a1e', accent:'#e8dcc8' },
  peach: { bg:'#fdf2ec', deep:'#8b4513', accent:'#e8c9a0' },
  mustard: { bg:'#fef9e7', deep:'#7a6c1a', accent:'#e8d44d' },
};
const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' }, { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' }, { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' }, { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];
const tagColor = (tag) => TAG_COLORS[Math.abs([...tag].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];

export default function StudentPage() {
  const router = useRouter();
  const { m } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [openFolder, setOpenFolder] = useState(null);

  useEffect(() => {
    if (!m) return;
    setLoading(true);
    fetch(`/api/student-manifest?m=${encodeURIComponent(m)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError('Δεν βρέθηκε ή δεν είναι διαθέσιμο.'); setLoading(false); });
  }, [m]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const folders = data?.folders || [];
  const files = data?.files || [];

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.tags||[]).some(t => t.toLowerCase().includes(q))
    );
  }, [files, search]);

  const filesByFolder = useMemo(() => {
    const m = {};
    filteredFiles.forEach(f => {
      const fid = f.folderId || '__none__';
      if (!m[fid]) m[fid] = [];
      m[fid].push(f);
    });
    return m;
  }, [filteredFiles]);

  const folderName = (fid) => folders.find(f=>f.id===fid)?.name || 'Αρχεία';

  /* ── Viewer ── */
  if (viewing) {
    const driveUrl = `https://drive.google.com/file/d/${viewing.id}/preview`;
    return (
      <>
        <Head><title>{viewing.name} — Student</title></Head>
        <div style={{ position:'fixed', inset:0, background:'#fff', display:'flex', flexDirection:'column', zIndex:100 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #ebebeb', gap:10, background:PALETTE.cream.bg, flexShrink:0 }}>
            <button onClick={()=>setViewing(null)}
              style={{ background:'none', border:'1px solid #ddd', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:'#444' }}>
              ← Πίσω
            </button>
            <strong style={{ flex:1, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:PALETTE.cream.deep }}>{viewing.name}</strong>
          </div>
          {/* Tags & Info */}
          {((viewing.tags||[]).length > 0 || (viewing.comment||'').trim() || (viewing.questions||'').trim()) && (
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #f0f0f0', background:'#fefdfb' }}>
              {(viewing.tags||[]).length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom: (viewing.comment||viewing.questions) ? 8 : 0 }}>
                  {viewing.tags.map(t => { const c = tagColor(t); return <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                </div>
              )}
              {(viewing.questions||'').trim() && (
                <div style={{ fontSize:13, color:'#4a3f1a', lineHeight:1.6, whiteSpace:'pre-wrap', padding:'8px 0' }}>
                  📝 {viewing.questions}
                </div>
              )}
            </div>
          )}
          <iframe src={driveUrl} style={{ flex:1, border:'none', width:'100%' }} title={viewing.name} allow="fullscreen" />
        </div>
      </>
    );
  }

  /* ── Main list ── */
  return (
    <>
      <Head><title>Student — Λεβιαθάν</title></Head>
      <div style={{ minHeight:'100vh', background:PALETTE.cream.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>

        {/* Header */}
        <div style={{ background:'#1a1a1a', padding:'20px 24px', color:'#fff' }}>
          <div style={{ maxWidth:900, margin:'0 auto' }}>
            <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2, color:'#e8c96a', marginBottom:4 }}>ΛΕΒΙΑΘΑΝ</div>
            <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Student</h1>
            <p style={{ fontSize:13, color:'#aaa', margin:'6px 0 0' }}>Δημοσιευμένα αρχεία του εκπαιδευτικού</p>
          </div>
        </div>

        <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px' }}>

          {loading && <div style={{ textAlign:'center', padding:60, color:'#aeaeb8', fontSize:14 }}>Φόρτωση…</div>}
          {error && <div style={{ textAlign:'center', padding:60, color:'#dc2626', fontSize:14 }}>{error}</div>}
          {!loading && !error && !m && <div style={{ textAlign:'center', padding:60, color:'#aeaeb8', fontSize:14 }}>Χρειάζεται σύνδεσμος (παράμετρος <code>m</code>).</div>}

          {data && (
            <>
              {/* Search */}
              <input type="search" placeholder="Αναζήτηση αρχείου ή ετικέτας…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:12, fontSize:14, background:'#fff', marginBottom:20, boxSizing:'border-box' }} />

              {files.length === 0 && (
                <div style={{ textAlign:'center', padding:60, color:'#aeaeb8', fontSize:14 }}>Δεν υπάρχουν δημοσιευμένα αρχεία.</div>
              )}

              {/* Folders */}
              {folders.filter(fld => filesByFolder[fld.id]?.length > 0).map(fld => {
                const fFiles = filesByFolder[fld.id] || [];
                const isOpen = openFolder === fld.id || !!search.trim();
                return (
                  <div key={fld.id} style={{ marginBottom:16 }}>
                    <button onClick={() => setOpenFolder(isOpen && !search ? null : fld.id)}
                      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'14px 16px', background:'#fff', border:'1px solid #ebebeb', borderRadius:14, cursor:'pointer', textAlign:'left' }}>
                      <span style={{ fontSize:20 }}>📁</span>
                      <span style={{ flex:1, fontSize:15, fontWeight:600, color:PALETTE.cream.deep }}>{fld.name}</span>
                      <span style={{ fontSize:12, color:'#aeaeb8' }}>{fFiles.length} αρχεία</span>
                      <span style={{ fontSize:12, color:'#ccc' }}>{isOpen ? '▾' : '▸'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'10px 0 0 0' }}>
                        {fFiles.map(f => (
                          <div key={f.id} onClick={()=>setViewing(f)}
                            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', border:'1px solid #ebebeb', borderRadius:12, cursor:'pointer', transition:'all 0.15s' }}>
                            <span style={{ fontSize:16 }}>📄</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                              {(f.tags||[]).length > 0 && (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                                  {f.tags.slice(0,3).map(t => { const c = tagColor(t); return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:c.bg, color:c.text }}>#{t}</span>; })}
                                  {f.tags.length > 3 && <span style={{ fontSize:10, color:'#aeaeb8' }}>+{f.tags.length-3}</span>}
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize:12, color:PALETTE.cream.deep, fontWeight:600, flexShrink:0 }}>Άνοιγμα →</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unfiled files */}
              {filesByFolder['__none__']?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#aeaeb8', padding:'8px 0', marginBottom:6 }}>Χωρίς φάκελο</div>
                  {filesByFolder['__none__'].map(f => (
                    <div key={f.id} onClick={()=>setViewing(f)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#fff', border:'1px solid #ebebeb', borderRadius:12, cursor:'pointer', marginBottom:6 }}>
                      <span style={{ fontSize:16 }}>📄</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:500, color:'#1a1a1a' }}>{f.name}</div>
                      </div>
                      <span style={{ fontSize:12, color:PALETTE.cream.deep, fontWeight:600 }}>Άνοιγμα →</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', padding:'30px 0', color:'#ccc', fontSize:11 }}>
          ΛΕΒΙΑΘΑΝ · Εκπαιδευτική πλατφόρμα
        </div>
      </div>
    </>
  );
}
