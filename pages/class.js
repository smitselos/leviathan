// pages/class.js — Δημόσια σελίδα μαθητή (πλαίσιο ονόματος καθηγητή + υλικό)
// 1. Δημόσια (χωρίς auth ή ?teacher=email) → μόνο δημόσια αρχεία
// 2. Μαθητής (logged in, role=student) → dashboard μαθητή
// 3. Εκπαιδευτικός (logged in, role=teacher) → δημοσιεύσεις του
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const P = {
  cream: { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach: { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
};
const TAG_COLORS=[{bg:'#ede9fe',text:'#6d28d9'},{bg:'#dcfce7',text:'#15803d'},{bg:'#fef3c7',text:'#b45309'},{bg:'#dbeafe',text:'#1d4ed8'},{bg:'#fce7f3',text:'#9d174d'},{bg:'#e0f2fe',text:'#0369a1'},{bg:'#f3f4f6',text:'#374151'}];
const tagColor=t=>TAG_COLORS[Math.abs([...t].reduce((a,c)=>a+c.charCodeAt(0),0))%TAG_COLORS.length];
const trunc=(s,n)=>s&&s.length>n?s.slice(0,n)+'…':s;

// «Πίσω» με δίχτυ ασφαλείας: αν το history.back() δεν οδηγήσει πουθενά
// (π.χ. η σελίδα άνοιξε απευθείας από σύνδεσμο/QR), πάμε στο fallback.
const goBack=(fallback='/class')=>{
  if(typeof window==='undefined')return;
  let moved=false;
  const mark=()=>{moved=true;};
  window.addEventListener('popstate',mark,{once:true});
  window.addEventListener('pagehide',mark,{once:true});
  setTimeout(()=>{ if(!moved) window.location.href=fallback; },500);
  try{window.history.back();}catch{window.location.href=fallback;}
};
const teacherColor=(email)=>TAG_COLORS[Math.abs([...(email||'')].reduce((a,c)=>a+c.charCodeAt(0),0))%TAG_COLORS.length];

// PWA-safe άνοιγμα: σε εγκατεστημένο PWA (standalone) χρήση location.href ώστε το iOS
// να δίνει μονοβηματική επιστροφή «◀» χωρίς ενδιάμεση λευκή σελίδα· στον Safari νέα καρτέλα.
function openExternal(url){
  const standalone = typeof window!=='undefined' && (
    window.navigator.standalone===true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
  if(standalone){ window.location.href=url; }
  else { window.open(url,'_blank'); }
}

const Ic={
  home:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  live:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  out:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  book:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  dashboard:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  globe:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  login:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
  net:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><line x1="12" y1="7.4" x2="5.8" y2="16.8"/><line x1="12" y1="7.4" x2="18.2" y2="16.8"/><line x1="7" y1="19" x2="17" y2="19"/></svg>,
  back:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  fwd:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

export default function StudentPage({ teacher: ssrTeacher }){
  const router=useRouter();
  const teacher = router.query.teacher || ssrTeacher || null;
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const c=()=>setIsMobile(window.innerWidth<768);c();window.addEventListener("resize",c);return()=>window.removeEventListener("resize",c);},[]);
  if(!teacher) return <ClassEntry isMobile={isMobile} />;
  return <PublicView teacher={teacher} isMobile={isMobile} hasSession={false} />;
}

function ClassEntry({isMobile}){
  const router=useRouter();
  const [name,setName]=useState('');
  const go=()=>{ const v=name.trim(); if(v) router.push('/class?teacher='+encodeURIComponent(v)); };
  return (
    <div style={S.page}>
      <button onClick={()=>goBack('/')} title="Πίσω"
        style={{position:'fixed',top:14,left:14,width:38,height:38,background:'#fff',border:'1px solid #e0e0e0',borderRadius:12,cursor:'pointer',fontSize:17,color:'#6b6b80',display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
      <div style={{...S.card,maxWidth:420}}>
        <img src="/logo.png" alt="Leviathan" style={{height:80,objectFit:'contain',marginBottom:12}}/>
        <div style={{fontSize:18,fontWeight:700,color:'#1a1a1a',marginBottom:8}}>Δημόσιο υλικό</div>
        <p style={{fontSize:13,color:'#6b6b80',lineHeight:1.6,marginBottom:18}}>Γράψε το όνομα ή το email του εκπαιδευτικού σου για να δεις το υλικό του.</p>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')go();}}
          placeholder="π.χ. smitselos ή email"
          style={{width:'100%',padding:'12px 14px',border:'1px solid #e0e0e0',borderRadius:12,fontSize:isMobile?16:14,marginBottom:10,boxSizing:'border-box',textAlign:'center'}}/>
        <button onClick={go} disabled={!name.trim()}
          style={{width:'100%',padding:'12px',borderRadius:12,border:'none',background:name.trim()?'#5c7a3a':'#e0e0e0',color:'#fff',fontSize:15,fontWeight:600,cursor:name.trim()?'pointer':'default'}}>Δες το υλικό</button>
        <p style={{fontSize:12,color:'#aeaeb8',marginTop:16}}>leviathan-cloud</p>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ — αρχεία δημοσιευμένα ως «Όλοι»
   ══════════════════════════════════════════════════════════════ */
function PublicView({teacher,isMobile,hasSession}){
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [expandedPub,setExpandedPub]=useState(null);
  const [msgOpen,setMsgOpen]=useState(null); // id αρχείου του οποίου το μήνυμα είναι ανοιχτό
  const [msgRead,setMsgRead]=useState({}); // ποια μηνύματα έχουν ανοιχτεί — χάνεται η προειδοποίηση
  useEffect(()=>{try{setMsgRead(JSON.parse(localStorage.getItem('leviathanMsgRead')||'{}'));}catch{}},[]);
  const markMsgRead=(key)=>setMsgRead(p=>{const n={...p,[key]:1};try{localStorage.setItem('leviathanMsgRead',JSON.stringify(n));}catch{}return n;});
  const [qrFile,setQrFile]=useState(null);

  const [sidebarOpen,setSidebarOpen]=useState(!isMobile);
  const [visitor,setVisitor]=useState('');
  const [visitorInput,setVisitorInput]=useState('');
  // Ομαλοποίηση: πεζά + @gmail.com αν λείπει — ώστε να ταιριάζει με το user:<email> του καθηγητή
  const applyVisitor=()=>{let v=visitorInput.trim().toLowerCase();if(!v)return;if(!v.includes('@'))v+='@gmail.com';setVisitor(v);};

  // Teacher email: αν δεν έχει @ δοκίμασε @gmail.com
  const teacherEmail = teacher && !teacher.includes('@') ? teacher+'@gmail.com' : teacher;

  useEffect(()=>{
    if(!teacherEmail)return;
    setLoading(true);
    (async()=>{
      try{
        // noreal=1: αν το email ανήκει σε ΣΥΝΔΕΔΕΜΕΝΟ (πραγματικό) μαθητή, ο server το αγνοεί —
        // η σελίδα της τάξης δείχνει μόνο υλικό ψευδομέιλ (κωδικών τάξης), ποτέ προσωπικό υλικό
        // πραγματικών λογαριασμών, ώστε να μην το «ψαρεύει» όποιος τυχαία ξέρει ένα gmail.
        const q=`/api/publish?email=${encodeURIComponent(teacherEmail)}`+(visitor?`&visitor=${encodeURIComponent(visitor)}&noreal=1`:'');
        const r=await fetch(q);
        const d=await r.json();
        setFiles((d.items||[]).sort((a,b)=>(b.publishedAt||b.addedAt||'').localeCompare(a.publishedAt||a.addedAt||'')));
      }catch{}
      setLoading(false);
    })();
  },[teacherEmail,visitor]);

  const filtered=useMemo(()=>{
    if(!search.trim())return files;
    const q=search.toLowerCase();
    return files.filter(f=>f.name.toLowerCase().includes(q));
  },[files,search]);

  const openFile=(f)=>{
    const isHtml=/\.html?$/i.test(f.name);
    const isOffice=/\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    if(isHtml){ openExternal(`/api/student-file?id=${f.id}`); return; }
    if(isOffice){
      // Αν υπάρχει PDF αντίγραφο (από τη δημοσίευση) → προβολή· αλλιώς λήψη
      if(f.pdfId){ openExternal(`https://drive.google.com/file/d/${f.pdfId}/preview`); return; }
      window.open(`https://drive.google.com/uc?id=${f.id}&export=download`,'_blank'); return;
    }
    openExternal(`https://drive.google.com/file/d/${f.id}/preview`);
  };

  const getFileUrl=(f)=>{
    if(/\.html?$/i.test(f.name))return `${typeof window!=='undefined'?window.location.origin:''}/api/student-file?id=${f.id}`;
    return `https://drive.google.com/file/d/${f.id}/view`;
  };

  if(!teacher) return(
    <div style={S.page}>
      <div style={{...S.card,maxWidth:420}}>
        <img src="/logo.png" alt="Leviathan" style={{height:80,objectFit:'contain',marginBottom:12}}/>
        <div style={{fontSize:18,fontWeight:700,color:'#1a1a1a',marginBottom:8}}>ΛΕΒΙΑΘΑΝ</div>
        <p style={{fontSize:13,color:'#6b6b80',lineHeight:1.6}}>Για να δείτε δημοσιευμένο υλικό, χρειάζεστε σύνδεσμο από εκπαιδευτικό.</p>
        <p style={{fontSize:12,color:'#aeaeb8',marginTop:16}}>leviathan-cloud</p>
      </div>
    </div>
  );

  return(
    <div style={S.app}>
      <Head><title>Βιβλιοθήκη — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>

      {/* Sidebar */}
      {!isMobile && (
        <div style={{...S.sidebar,width:sidebarOpen?220:56}}>
          <div style={S.sidebarHeader}>{sidebarOpen&&<img src="/logo-white.png" alt="Leviathan" style={{height:86,objectFit:'contain'}}/>}<button onClick={()=>setSidebarOpen(p=>!p)} style={S.collapseBtn}>{sidebarOpen?'◀':'▶'}</button></div>
          <nav style={S.nav}>
            <button onClick={()=>goBack()} style={S.navItem} title="Πίσω"><span style={S.navIcon}>{Ic.back}</span>{sidebarOpen&&'Πίσω'}</button>
            <button onClick={()=>window.history.forward()} style={S.navItem} title="Μπροστά"><span style={S.navIcon}>{Ic.fwd}</span>{sidebarOpen&&'Μπροστά'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>window.location.reload()} style={{...S.navItem,...S.navActive}}><span style={S.navIcon}>{Ic.book}</span>{sidebarOpen&&'Βιβλιοθήκη'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>{window.location.href='/live';}} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{sidebarOpen&&'Live'}</button>
          </nav>
          <div style={S.sidebarFooter}><div style={S.userCard}><div style={{...S.userAvatar,background:'#b8d4e3'}}>{Ic.user}</div>{sidebarOpen&&<div style={{fontSize:12,color:'#ececec'}}>Επισκέπτης</div>}</div></div>
        </div>
      )}

      <div style={{flex:1,maxWidth:800,margin:'0 auto',padding:isMobile?'24px 16px 110px':'24px 16px'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <img src="/logo.png" alt="Leviathan" style={{height:110,objectFit:'contain',marginBottom:8}}/>
          <p style={{fontSize:13,color:'#6b6b80'}}>{files.length} αρχεία</p>
        </div>
        <div style={{background:'#fff',border:'1px solid #ebebeb',borderRadius:14,padding:'14px 16px',marginBottom:16}}>
          {!visitor ? (
            <>
              <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',marginBottom:6}}>Υλικό τάξης / ομάδας</div>
              <div style={{fontSize:12,color:'#6b6b80',marginBottom:10}}>Βάλε το ψευδομέιλ (κωδικό) που σου έδωσε ο εκπαιδευτικός για να δεις το υλικό της τάξης ή της ομάδας σου.</div>
              <div style={{display:'flex',gap:8}}>
                <input value={visitorInput} onChange={e=>setVisitorInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')applyVisitor();}} placeholder="π.χ. b2-2026 ή κωδικός@gmail.com" type="text"
                  style={{flex:1,padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,boxSizing:'border-box'}}/>
                <button onClick={applyVisitor} disabled={!visitorInput.trim()}
                  style={{padding:'10px 16px',borderRadius:10,border:'none',background:visitorInput.trim()?'#5c7a3a':'#e0e0e0',color:'#fff',fontSize:13,fontWeight:600,cursor:visitorInput.trim()?'pointer':'default',whiteSpace:'nowrap'}}>Δες</button>
              </div>
            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:'#1a7f37',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✓ {visitor}</span>
              <button onClick={()=>{setVisitor('');setVisitorInput('');}} style={{marginLeft:'auto',background:'none',border:'none',color:'#6b6b80',fontSize:12,cursor:'pointer',textDecoration:'underline',flexShrink:0}}>Αλλαγή</button>
            </div>
          )}
        </div>
        {loading&&<div style={S.empty}>Φόρτωση…</div>}
        {!loading&&files.length>3&&(
          <input type="search" placeholder="Αναζήτηση…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'11px 16px',border:'1px solid #ebebeb',borderRadius:14,fontSize:isMobile?16:14,background:'#fff',marginBottom:12,boxSizing:'border-box'}}/>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {filtered.map(f=>{
            const isExp=expandedPub===f.id;
            const msgKey=f.id+':'+(f.shareMessage||'').slice(0,40);
            const msgUnread=!!f.shareMessage&&!msgRead[msgKey];
            return(
              <div key={f.id} style={{background:'#fff',border:'1px solid #ebebeb',borderRadius:14,overflow:'hidden',transition:'all 0.15s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpandedPub(isExp?null:f.id)}>
                  <div style={{width:34,height:34,borderRadius:10,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trunc(f.name,25)}</div>
                  </div>
                  {f.shareMessage&&(
                    <button onClick={e=>{e.stopPropagation();const opening=msgOpen!==f.id;setMsgOpen(opening?f.id:null);if(opening)markMsgRead(msgKey);}}
                      title={msgUnread?'Νέο μήνυμα από τον εκπαιδευτικό':'Μήνυμα από τον εκπαιδευτικό'}
                      style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:8,flexShrink:0,cursor:'pointer',
                        border:msgUnread?'1.5px solid #f59e0b':'1px solid #e0e0e0',
                        background:msgUnread?'#fff7ed':(msgOpen===f.id?'#f0fdf4':'#fafafa'),
                        color:msgUnread?'#b45309':(msgOpen===f.id?'#16a34a':'#6b6b80')}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>
                      {msgUnread&&<span style={{position:'absolute',top:-3,right:-3,width:9,height:9,borderRadius:'50%',background:'#dc2626',border:'1.5px solid #fff'}}/>}
                    </button>
                  )}
                  <span style={{fontSize:11,color:'#aeaeb8',flexShrink:0,transition:'transform 0.15s',transform:isExp?'rotate(180deg)':'none'}}>▼</span>
                </div>
                {f.shareMessage&&msgOpen===f.id&&(
                  <div style={{margin:'0 14px 10px',fontSize:13,color:'#1a7f37',background:'#f0fdf4',border:'1px solid #dcfce7',padding:'9px 11px',borderRadius:8,lineHeight:1.5}}>✉️ {f.shareMessage}</div>
                )}
                {isExp&&(
                  <div style={{padding:'0 14px 12px',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
                    {f.info&&<div style={{fontSize:12,color:P.cream.deep,padding:'8px 0 6px',lineHeight:1.5}}>ℹ️ {f.info}</div>}
                    <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap',alignItems:'center'}}>
                      <button onClick={()=>openFile(f)} style={S.openBtn}>Άνοιγμα</button>
                      <button onClick={()=>window.open(`https://drive.google.com/uc?id=${f.id}&export=download`,'_blank')} style={S.miniBtn} title="Λήψη">⬇</button>
                      <button onClick={()=>setQrFile(f)} style={S.miniBtn} title="QR Code">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!loading&&files.length===0&&<div style={{textAlign:'center',padding:60}}><div style={{fontSize:48,marginBottom:16}}>📭</div><div style={{fontSize:14,color:'#6b6b80'}}>{visitor?'Δεν υπάρχει υλικό για αυτόν τον κωδικό ακόμη.':'Βάλε τον κωδικό της τάξης σου παραπάνω για να δεις το υλικό.'}</div></div>}
      </div>

      {/* QR popup */}
      {qrFile&&(
        <div onClick={()=>setQrFile(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'28px 24px',maxWidth:320,width:'100%',textAlign:'center',boxShadow:'0 12px 40px rgba(0,0,0,0.15)'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:4}}>QR Code</div>
            <div style={{fontSize:12,color:'#6b6b80',marginBottom:16,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{qrFile.name}</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getFileUrl(qrFile))}`}
              alt="QR" width={200} height={200} style={{borderRadius:8,border:'1px solid #eee',margin:'0 auto',display:'block'}}/>
            <p style={{fontSize:11,color:'#aeaeb8',marginTop:12}}>Σκανάρετε με κινητό</p>
            <button onClick={()=>setQrFile(null)} style={{marginTop:12,padding:'10px 28px',borderRadius:10,border:'none',background:'#1a1a1a',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>Κλείσιμο</button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile&&(
        <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'14px 0 max(14px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <MobBtn icon={Ic.back} label="Πίσω" onClick={()=>goBack()}/>
          <MobBtn icon={Ic.fwd} label="Μπροστά" onClick={()=>window.history.forward()}/>
          <MobBtn icon={Ic.book} label="Βιβλιοθήκη" active onClick={()=>window.location.reload()}/>
          <MobBtn icon={Ic.live} label="Live" onClick={()=>{window.location.href='/live';}}/>
        </nav>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ΜΑΘΗΤΗΣ — μία σελίδα: invite + εισερχόμενα | upload + αποστολές
   ══════════════════════════════════════════════════════════════ */
function MobBtn({icon,label,active,disabled,onClick,badge}){
  return(<button onClick={disabled?undefined:onClick} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'transparent',border:'none',color:active?'#ececec':'#8e8ea0',fontSize:11,cursor:disabled?'default':'pointer',padding:'6px 10px',opacity:disabled?0.35:1,position:'relative'}}>
    {icon}<span>{label}</span>
    {badge>0&&<span style={{position:'absolute',top:-2,right:0,...S.badgeStyle}}>{badge}</span>}
  </button>);
}

const css=`*{box-sizing:border-box;}html,body{margin:0;padding:0;}@media(max-width:767px){.student-main{padding-bottom:70px !important;margin-left:0 !important;max-width:100vw !important;overflow-x:hidden !important;}html,body{overflow-x:hidden !important;max-width:100vw !important;}}.ri-h:hover{background:#f9f6ed !important;}`;

const S={
  page:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f0e1',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},
  card:{background:'#fff',borderRadius:20,padding:'40px 32px',maxWidth:380,width:'100%',textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,0.08)'},
  app:{display:'flex',minHeight:'100vh',maxWidth:'100vw',overflowX:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:'#fafafa'},
  sidebar:{position:'fixed',top:0,left:0,height:'100vh',background:'#1a1a1a',display:'flex',flexDirection:'column',zIndex:200,transition:'width 0.2s ease',overflowX:'hidden'},
  sidebarHeader:{padding:'16px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)'},
  collapseBtn:{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#8e8ea0',width:28,height:28,borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  nav:{flex:1,padding:8,overflowY:'auto'},
  navItem:{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'transparent',border:'none',borderRadius:8,color:'#8e8ea0',fontSize:13,cursor:'pointer',marginBottom:1,textAlign:'left'},
  navActive:{background:'rgba(255,255,255,0.08)',color:'#ececec'},
  navIcon:{flexShrink:0,width:18,display:'flex',alignItems:'center',justifyContent:'center'},
  navDiv:{height:1,background:'rgba(255,255,255,0.06)',margin:'8px 4px'},
  sidebarFooter:{padding:10,borderTop:'1px solid rgba(255,255,255,0.06)'},
  userCard:{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'rgba(255,255,255,0.04)',borderRadius:8},
  userAvatar:{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  main:{flex:1,transition:'margin-left 0.2s ease'},
  container:{maxWidth:1280,margin:'0 auto',padding:'24px 16px'},
  empty:{textAlign:'center',color:'#b0b0b0',padding:32,fontSize:14},
  emptyCol:{textAlign:'center',color:'#aeaeb8',padding:32,fontSize:13,background:'#fff',borderRadius:14,border:'1px dashed #e0e0e0'},
  openBtn:{background:'transparent',border:'1.5px solid '+P.cream.deep,borderRadius:10,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',color:P.cream.deep,flexShrink:0},
  miniBtn:{background:P.cream.bg,border:'1.5px solid '+P.cream.accent,borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13,flexShrink:0,padding:0},
  badge:{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,borderRadius:9,background:'#dc2626',color:'#fff',fontSize:10,fontWeight:700,padding:'0 5px'},
  badgeStyle:{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:16,height:16,borderRadius:8,background:'#dc2626',color:'#fff',fontSize:9,fontWeight:700,padding:'0 4px'},
};

// Η σελίδα πρέπει να φορτώνει ΧΩΡΙΣ auth (δημόσια πρόσβαση)
export async function getServerSideProps(ctx) {
  return { props: { teacher: ctx.query.teacher || null } };
}
