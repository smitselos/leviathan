// pages/viewer/[id].js
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const P = {
  cream:  { bgSoft:'#fcf9f0', accent:'#e9e0c8', deep:'#8a7d4a' },
  peach:  { bgSoft:'#fdf0e4', accent:'#f0c4a0', deep:'#c97b5a' },
};

export default function ViewerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [fileMeta, setFileMeta] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Φόρτωσε metadata αρχείου
  useEffect(() => {
    if (!id || !session) return;
    fetch('/api/registry')
      .then(r => r.json())
      .then(data => {
        const all = [...(data.folders||[]).flatMap(f => (f.files||[]).map(fi => ({ ...fi, folderId:f.id }))), ...(data.apps||[])];
        const found = all.find(f => f.id === id);
        if (found) setFileMeta(found);
        else setFileMeta({ id, name: 'Αρχείο' });
      })
      .catch(() => setFileMeta({ id, name: 'Αρχείο' }));
  }, [id, session]);

  if (status === 'loading' || !id) return <div style={S.loading}>Φόρτωση…</div>;
  if (!session) return null;

  const name = fileMeta?.name || 'Αρχείο';
  const tags = fileMeta?.tags || [];

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
        .act-btn { display:flex; flex-direction:column; align-items:center; gap:3px;
          background:none; border:none; cursor:pointer; padding:8px 12px;
          color:${P.peach.deep}; font-size:10px; font-weight:500; min-width:56px; border-radius:10px; }
        .act-btn:active { background:${P.peach.bgSoft}; }
        .act-btn[disabled] { opacity:0.30; pointer-events:none; }
      `}</style>

      <div style={S.wrapper}>
        {/* ── Top bar: back + filename ── */}
        <div style={S.topBar}>
          <button onClick={() => window.close()} style={S.backBtn}>←</button>
          <div style={S.titleWrap}>
            <div style={S.fileName}>{name}</div>
            {tags.length > 0 && (
              <div style={S.tagRow}>
                {tags.slice(0,3).map(t => <span key={t} style={S.tag}>#{t}</span>)}
                {tags.length > 3 && <span style={S.tagMore}>+{tags.length-3}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ── Action toolbar ── */}
        <div style={S.actionBar}>
          <button className="act-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span>Student</span>
          </button>
          <button className="act-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/>
            </svg>
            <span>Live</span>
          </button>
          <button className="act-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span>Σχόλια</span>
          </button>
          <button className="act-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            <span>Σύνδεση</span>
          </button>
          <button className="act-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Επεξεργασία</span>
          </button>
        </div>

        {/* ── File content — native browser rendering ── */}
        <iframe src={'/api/file/' + id} style={S.iframe} title={name} />
      </div>
    </>
  );
}

const S = {
  loading: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888', fontSize:14, fontFamily:'sans-serif' },
  wrapper: { display:'flex', flexDirection:'column', height:'100vh', width:'100vw', overflow:'hidden' },
  topBar: {
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 14px', borderBottom:'1px solid #ebebeb',
    background:'#fff', flexShrink:0,
  },
  backBtn: {
    background:'none', border:'none', fontSize:20, cursor:'pointer',
    color:'#444', padding:'4px 8px', flexShrink:0,
  },
  titleWrap: { flex:1, minWidth:0 },
  fileName: {
    fontSize:14, fontWeight:600, color:'#1a1a1a',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  tagRow: { display:'flex', gap:4, marginTop:3 },
  tag: { fontSize:10, padding:'1px 6px', borderRadius:999, background:'#ede9fe', color:'#6d28d9' },
  tagMore: { fontSize:10, color:'#aeaeb8' },
  actionBar: {
    display:'flex', alignItems:'center', justifyContent:'space-around',
    padding:'4px 4px', borderBottom:'1px solid #f0f0f0',
    background:P.cream.bgSoft, flexShrink:0,
  },
  iframe: { flex:1, border:'none', width:'100%' },
};
