// pages/student.js — Τρεις όψεις:
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
};

export default function StudentPage({ teacher: ssrTeacher }){
  const router=useRouter();
  const teacher = router.query.teacher || ssrTeacher || null;
  const {data:session,status}=useSession();
  const hasSession=!!session?.accessToken;
  const myEmail=session?.user?.email||null;
  const [role,setRole]=useState(null);
  const [isMobile,setIsMobile]=useState(false);
  const [roleLoading,setRoleLoading]=useState(true);

  useEffect(()=>{const c=()=>setIsMobile(window.innerWidth<768);c();window.addEventListener('resize',c);return()=>window.removeEventListener('resize',c);},[]);

  useEffect(()=>{
    if(status==='loading')return;
    if(status==='unauthenticated'||!hasSession){setRoleLoading(false);setRole(null);return;}
    fetch('/api/role').then(r=>r.json()).then(d=>{setRole(d.role||'teacher');setRoleLoading(false);}).catch(()=>{setRole('teacher');setRoleLoading(false);});
  },[hasSession,status]);

  // Χωρίς σύνδεση → δημόσια σελίδα ΑΜΕΣΩΣ (χωρίς αναμονή role)
  if(status==='unauthenticated'||(!hasSession&&status!=='loading')) return <PublicView teacher={teacher} isMobile={isMobile} hasSession={false} />;

  if(status==='loading'||roleLoading) return <div style={S.page}><div style={{color:'#6b6b80',fontSize:14}}>Φόρτωση…</div></div>;

  // Δημόσια σελίδα: χωρίς session ή με ?teacher= parameter
  if(!hasSession || teacher) return <PublicView teacher={teacher} isMobile={isMobile} hasSession={hasSession} />;

  // Μαθητής
  if(role==='student') return <StudentView myEmail={myEmail} isMobile={isMobile} router={router} />;

  // Εκπαιδευτικός
  return <TeacherView teacher={teacher} myEmail={myEmail} hasSession={hasSession} isMobile={isMobile} router={router} />;
}


/* ══════════════════════════════════════════════════════════════
   ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ — αρχεία δημοσιευμένα ως «Όλοι»
   ══════════════════════════════════════════════════════════════ */
function PublicView({teacher,isMobile,hasSession}){
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [expandedPub,setExpandedPub]=useState(null);
  const [qrFile,setQrFile]=useState(null);

  const [sidebarOpen,setSidebarOpen]=useState(!isMobile);

  // Teacher email: αν δεν έχει @ δοκίμασε @gmail.com
  const teacherEmail = teacher && !teacher.includes('@') ? teacher+'@gmail.com' : teacher;

  useEffect(()=>{
    if(!teacherEmail)return;
    (async()=>{
      try{
        const r=await fetch(`/api/publish?email=${encodeURIComponent(teacherEmail)}`);
        const d=await r.json();
        setFiles((d.items||[]).filter(f=>f.visibility==='public').sort((a,b)=>(b.publishedAt||b.addedAt||'').localeCompare(a.publishedAt||a.addedAt||'')));
      }catch{}
      setLoading(false);
    })();
  },[teacherEmail]);

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
          <div style={S.sidebarHeader}>{sidebarOpen&&<span style={{fontSize:15,fontWeight:500,color:'#ececec'}}>ΛΕΒΙΑΘΑΝ</span>}<button onClick={()=>setSidebarOpen(p=>!p)} style={S.collapseBtn}>{sidebarOpen?'◀':'▶'}</button></div>
          <nav style={S.nav}>
            <button onClick={()=>window.location.reload()} style={{...S.navItem,...S.navActive}}><span style={S.navIcon}>{Ic.book}</span>{sidebarOpen&&'Βιβλιοθήκη'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>openExternal('/live')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{sidebarOpen&&'Live'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>window.location.href='/login'} style={S.navItem}><span style={S.navIcon}>{Ic.login}</span>{sidebarOpen&&'Σύνδεση'}</button>
          </nav>
          <div style={S.sidebarFooter}><div style={S.userCard}><div style={{...S.userAvatar,background:'#b8d4e3'}}>{Ic.user}</div>{sidebarOpen&&<div style={{fontSize:12,color:'#ececec'}}>Επισκέπτης</div>}</div></div>
        </div>
      )}

      <div style={{flex:1,maxWidth:800,margin:'0 auto',padding:'24px 16px'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <img src="/logo.png" alt="Leviathan" style={{height:60,objectFit:'contain',marginBottom:8}}/>
          <p style={{fontSize:13,color:'#6b6b80'}}>{files.length} αρχεία</p>
        </div>
        {loading&&<div style={S.empty}>Φόρτωση…</div>}
        {!loading&&files.length>3&&(
          <input type="search" placeholder="Αναζήτηση…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'11px 16px',border:'1px solid #ebebeb',borderRadius:14,fontSize:isMobile?16:14,background:'#fff',marginBottom:12,boxSizing:'border-box'}}/>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {filtered.map(f=>{
            const isExp=expandedPub===f.id;
            return(
              <div key={f.id} style={{background:'#fff',border:'1px solid #ebebeb',borderRadius:14,overflow:'hidden',transition:'all 0.15s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpandedPub(isExp?null:f.id)}>
                  <div style={{width:34,height:34,borderRadius:10,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trunc(f.name,25)}</div>
                  </div>
                  <span style={{fontSize:11,color:'#aeaeb8',flexShrink:0,transition:'transform 0.15s',transform:isExp?'rotate(180deg)':'none'}}>▼</span>
                </div>
                {isExp&&(
                  <div style={{padding:'0 14px 12px',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
                    {f.shareMessage&&<div style={{fontSize:12,color:'#1a7f37',background:'#f0fdf4',padding:'8px 10px',borderRadius:8,marginTop:8,lineHeight:1.5}}>💬 {f.shareMessage}</div>}
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
        {!loading&&files.length===0&&<div style={{textAlign:'center',padding:60}}><div style={{fontSize:48,marginBottom:16}}>📭</div><div style={{fontSize:14,color:'#6b6b80'}}>Δεν υπάρχει δημοσιευμένο υλικό.</div></div>}
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
        <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <MobBtn icon={Ic.book} label="Βιβλιοθήκη" active onClick={()=>window.location.reload()}/>
          <MobBtn icon={Ic.live} label="Live" onClick={()=>openExternal('/live')}/>
          <MobBtn icon={Ic.login} label="Σύνδεση" onClick={()=>window.location.href='/login'}/>
        </nav>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ΦΩΤΟΓΡΑΦΙΕΣ → PDF (client-side, χωρίς εξωτερική βιβλιοθήκη)
   Χωρίς όριο φωτογραφιών — κάθε φωτογραφία γίνεται μία σελίδα A4
   ══════════════════════════════════════════════════════════════ */

// Εικόνα (File) → JPEG bytes + διαστάσεις (με σμίκρυνση έως 1600px για μικρό μέγεθος)
const fileToJpeg=(file)=>new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    const MAX=1600;
    let w=img.naturalWidth,h=img.naturalHeight;
    const sc=Math.min(1,MAX/Math.max(w,h));
    w=Math.max(1,Math.round(w*sc)); h=Math.max(1,Math.round(h*sc));
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
    URL.revokeObjectURL(url);
    cv.toBlob(async b=>{
      if(!b){reject(new Error('jpeg fail'));return;}
      resolve({data:new Uint8Array(await b.arrayBuffer()),w,h});
    },'image/jpeg',0.85);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('img load fail'));};
  img.src=url;
});

// Ελάχιστο έγκυρο PDF με τις JPEG εικόνες ως σελίδες A4
const buildPdfFromJpegs=(images)=>{
  const enc=new TextEncoder();
  const chunks=[]; let offset=0; const xref=[];
  const push=(s)=>{const b=typeof s==='string'?enc.encode(s):s;chunks.push(b);offset+=b.length;};
  push('%PDF-1.4\n');
  const objCount=2+images.length*3;
  const addObj=(num,body)=>{xref[num]=offset;push(`${num} 0 obj\n${body}\nendobj\n`);};
  const pageNums=images.map((_,i)=>3+i*3);
  addObj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2,`<< /Type /Pages /Kids [${pageNums.map(n=>n+' 0 R').join(' ')}] /Count ${images.length} >>`);
  images.forEach((im,i)=>{
    const pn=3+i*3, cn=pn+1, xn=pn+2;
    const A4W=595,A4H=842;
    const scale=Math.min(A4W/im.w,A4H/im.h);
    const w=im.w*scale,h=im.h*scale,x=(A4W-w)/2,y=(A4H-h)/2;
    addObj(pn,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources << /XObject << /Im${i} ${xn} 0 R >> >> /Contents ${cn} 0 R >>`);
    const content=`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    addObj(cn,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    xref[xn]=offset;
    push(`${xn} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
    push(im.data);
    push('\nendstream\nendobj\n');
  });
  const xrefStart=offset;
  let xr=`xref\n0 ${objCount+1}\n0000000000 65535 f \n`;
  for(let n=1;n<=objCount;n++)xr+=String(xref[n]).padStart(10,'0')+' 00000 n \n';
  xr+=`trailer\n<< /Size ${objCount+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  push(xr);
  return new Blob(chunks,{type:'application/pdf'});
};

async function photosToPdfFile(files){
  const jpegs=[];
  for(const f of files) jpegs.push(await fileToJpeg(f));
  const blob=buildPdfFromJpegs(jpegs);
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const name=`Φωτογραφίες_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
  return new File([blob],name,{type:'application/pdf'});
}


/* ══════════════════════════════════════════════════════════════
   ΜΑΘΗΤΗΣ — μία σελίδα: invite + εισερχόμενα | upload + αποστολές
   ══════════════════════════════════════════════════════════════ */
function StudentView({myEmail,isMobile,router}){
  const [incoming,setIncoming]=useState([]);
  const [sentFiles,setSentFiles]=useState([]);
  const [network,setNetwork]=useState({connections:[],received:[],sent:[],inbox:[]});
  const [seenIds,setSeenIds]=useState(new Set());
  const [loading,setLoading]=useState(true);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [inviteEmail,setInviteEmail]=useState('');
  const [netLoading,setNetLoading]=useState(false);
  const [expandedIn,setExpandedIn]=useState(null);
  const [qrFile,setQrFile]=useState(null);
  const [savingId,setSavingId]=useState(null);
  const [uploading,setUploading]=useState(false);
  const [viewing,setViewing]=useState(null);
  const [pendingFile,setPendingFile]=useState(null);
  const [sendRecipients,setSendRecipients]=useState([]);
  const [photoMode,setPhotoMode]=useState(false);   // modal «Φωτογραφίες → PDF»
  const [photos,setPhotos]=useState([]);            // [{file,url}]
  const [photoBusy,setPhotoBusy]=useState(false);
  const [inboxFrom,setInboxFrom]=useState('__all__'); // φίλτρο εισερχομένων ανά αποστολέα
  const [publicView,setPublicView]=useState(false); // προβολή «Ανοιχτή πρόσβαση» (δημόσιο υλικό όλων των εκπαιδευτικών)
  const [publicFiles,setPublicFiles]=useState([]);
  const [publicFrom,setPublicFrom]=useState('__all__'); // φίλτρο δημόσιου υλικού ανά εκπαιδευτικό
  const [loadingPublic,setLoadingPublic]=useState(false);
  const [expandedPub,setExpandedPub]=useState(null);
  // ── Νέος πίνακας ελέγχου με κάρτες-φακέλους ──
  const [openFolder,setOpenFolder]=useState(null); // {type:'inbox'|'sent'|'search'|'user'|'group', email?, group?, name}
  const [groups,setGroups]=useState([]);           // χειροκίνητες ομάδες (από localStorage)
  const [expandedCard,setExpandedCard]=useState(null);
  const [detailSearch,setDetailSearch]=useState('');
  const [walletActive,setWalletActive]=useState(null); // κινητό: ποια κάρτα-φάκελος είναι ανοιχτή (wallet)
  // ── Όψη «Δίκτυο» (εσωτερική, όχι ξεχωριστή σελίδα) ──
  const [netView,setNetView]=useState(false);
  const [contacts,setContacts]=useState({});
  const [editEmail,setEditEmail]=useState(null);
  const [contactDraft,setContactDraft]=useState({});
  const [showNewGroup,setShowNewGroup]=useState(false);
  const [newGroupName,setNewGroupName]=useState('');
  const [newGroupMembers,setNewGroupMembers]=useState([]);
  const [groupMsg,setGroupMsg]=useState('');

  const myName=myEmail;

  // Φόρτωση ομάδων: άμεσα από localStorage (για να δείχνει πάντα) + συγχρονισμός με τον server
  useEffect(()=>{
    const LS='lev_groups_'+(myEmail||'');
    try{ const r=localStorage.getItem(LS); const loc=r?JSON.parse(r)||[]:[]; if(loc.length) setGroups(loc); }catch{}
    (async()=>{
      try{
        const r=await fetch('/api/student-groups'); const d=await r.json();
        if(Array.isArray(d.groups)&&d.groups.length){ setGroups(d.groups); try{localStorage.setItem(LS,JSON.stringify(d.groups));}catch{} }
      }catch{}
    })();
  },[myEmail]);

  const loadAll=useCallback(async()=>{
    setLoading(true);
    try{
      const [rNet,rReg]=await Promise.all([fetch('/api/network'),fetch('/api/registry')]);
      const dNet=await rNet.json();
      const dReg=await rReg.json();
      setNetwork(dNet);

      // Sent files
      const allFiles=Array.isArray(dReg.files)?dReg.files:[];
      setSentFiles(allFiles.filter(f=>f.sent));

      // Seen IDs (localStorage + server + προηγούμενα — ώστε να ΜΗΝ ξαναεμφανίζονται ως νέα)
      setSeenIds(prev => {
        const merged = new Set(dReg.seenFiles || []);
        try { (JSON.parse(localStorage.getItem('lev_seen_'+(myEmail||''))||'[]')||[]).forEach(id=>merged.add(id)); } catch {}
        prev.forEach(id => merged.add(id));
        return merged;
      });

      // Εισερχόμενα
      const conns=dNet.connections||[];
      const allIn=[];
      await Promise.all(conns.map(async c=>{
        try{
          const r=await fetch(`/api/publish?email=${encodeURIComponent(c.email)}&visitor=${encodeURIComponent(myEmail)}`);
          if(!r.ok)return;
          const d=await r.json();
          (d.items||[]).filter(f=>f.visibility!=='public').forEach(f=>allIn.push({...f,fromEmail:c.email,fromName:c.name||c.email}));
        }catch{}
      }));
      allIn.sort((a,b)=>(b.publishedAt||b.addedAt||'').localeCompare(a.publishedAt||a.addedAt||''));
      setIncoming(allIn);
    }catch{}
    setLoading(false);
  },[myEmail]);

  useEffect(()=>{loadAll();const iv=setInterval(loadAll,30000);return()=>clearInterval(iv);},[loadAll]);

  // Φόρτωση δημόσιου υλικού ΟΛΩΝ των συνδεδεμένων εκπαιδευτικών
  const loadPublicFiles=useCallback(async()=>{
    setLoadingPublic(true);
    try{
      const conns=network.connections||[];
      const all=[];
      await Promise.all(conns.map(async c=>{
        try{
          const r=await fetch(`/api/publish?email=${encodeURIComponent(c.email)}&visitor=${encodeURIComponent(myEmail)}`);
          if(!r.ok)return;
          const d=await r.json();
          (d.items||[]).filter(f=>f.visibility==='public').forEach(f=>all.push({...f,fromEmail:c.email,fromName:c.name||c.email}));
        }catch{}
      }));
      all.sort((a,b)=>(b.publishedAt||b.addedAt||'').localeCompare(a.publishedAt||a.addedAt||''));
      setPublicFiles(all);
    }catch{}
    setLoadingPublic(false);
  },[network.connections,myEmail]);

  const openPublicView=()=>{ setViewing(null); setPublicView(true); loadPublicFiles(); };

  const unseenCount=useMemo(()=>incoming.filter(f=>!seenIds.has(f.id)).length,[incoming,seenIds]);

  // Κόκκινο σήμα στο εικονίδιο της εφαρμογής (PWA badge) — κινητό & desktop
  useEffect(()=>{ try{ if('setAppBadge' in navigator){ if(unseenCount>0) navigator.setAppBadge(unseenCount); else navigator.clearAppBadge(); } }catch{} },[unseenCount]);

  const markSeen=async(fileId)=>{
    if(seenIds.has(fileId))return;
    const next=new Set(seenIds);next.add(fileId);setSeenIds(next);
    try{ localStorage.setItem('lev_seen_'+(myEmail||''), JSON.stringify([...next])); }catch{}
    try{await fetch('/api/registry',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({seenFiles:[...next]})});}catch{}
  };

  const openFile=(f)=>{
    markSeen(f.id);
    const isHtml=/\.html?$/i.test(f.name);
    const isOffice=/\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    let url;
    if(isHtml) url=`/api/student-file?id=${f.id}`;
    else if(isOffice) url = f.pdfId
      ? `https://drive.google.com/file/d/${f.pdfId}/preview`   // έτοιμο PDF αντίγραφο
      : `/api/inbox-pdf?id=${f.id}&name=${encodeURIComponent(f.name)}`; // fallback on-the-fly
    else url=`https://drive.google.com/file/d/${f.id}/preview`;
    if(isMobile){openExternal(url);return;}
    setViewing({...f,previewUrl:url});
  };

  const downloadFile=(f)=>{markSeen(f.id);window.open(`https://drive.google.com/uc?id=${f.id}&export=download`,'_blank');};

  const saveToMyDrive=async(f)=>{
    if(savingId)return;setSavingId(f.id);
    try{
      const r=await fetch('/api/save-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:f.id,fileName:f.name,info:f.info||''})});
      const d=await r.json();
      if(d.ok)alert('✅ Αποθηκεύτηκε στον φάκελο «'+(d.folder||'Λήψεις')+'»!');
      else alert('❌ '+(d.error||'Σφάλμα'));
    }catch{alert('❌ Σφάλμα σύνδεσης');}
    setSavingId(null);
  };

  const getFileUrl=(f)=>{
    if(/\.html?$/i.test(f.name))return `${window.location.origin}/api/student-file?id=${f.id}`;
    return `https://drive.google.com/file/d/${f.id}/view`;
  };

  // Πρόσκληση / αποδοχή
  const sendInvite=async()=>{
    if(!inviteEmail.trim())return;setNetLoading(true);
    try{await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toEmail:inviteEmail.trim()})});setInviteEmail('');const r=await fetch('/api/network');setNetwork(await r.json());}catch{}
    setNetLoading(false);
  };
  const acceptInvite=async(email)=>{
    setNetLoading(true);
    try{await fetch('/api/network',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromEmail:email,action:'accept'})});const r=await fetch('/api/network');setNetwork(await r.json());}catch{}
    setNetLoading(false);
  };
  const disconnectUser=async(email)=>{
    if(!confirm(`Αποσύνδεση από ${email};`))return;
    try{await fetch('/api/network',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const r=await fetch('/api/network');setNetwork(await r.json());
      saveGroups(groups.map(g=>({...g,members:(g.members||[]).filter(e=>e!==email)})));
    }catch{}
  };

  // ── Όψη «Δίκτυο» (εσωτερική) ──
  const openNetwork=()=>{ setViewing(null); setPublicView(false); setOpenFolder(null); setNetView(true); loadContacts(); };
  const loadContacts=async()=>{ try{ const r=await fetch('/api/contact-info'); const d=await r.json(); setContacts(d.contacts||{}); }catch{} };

  // Αποθήκευση ομάδων (hybrid: server + localStorage)
  const LSKEY='lev_groups_'+(myEmail||'');
  const saveGroups=async(g)=>{
    setGroups(g);
    try{ localStorage.setItem(LSKEY,JSON.stringify(g)); }catch{}
    setGroupMsg('Αποθήκευση…');
    try{
      const r=await fetch('/api/student-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groups:g})});
      setGroupMsg(r.ok?'✓ Αποθηκεύτηκε (συγχρονίζεται σε όλες τις συσκευές)':'✗ Ο server απάντησε '+r.status);
    }catch{ setGroupMsg('✗ Χωρίς server — αποθηκεύτηκε μόνο τοπικά'); }
    setTimeout(()=>setGroupMsg(''),6000);
  };
  const toggleMember=(email)=>setNewGroupMembers(p=>p.includes(email)?p.filter(e=>e!==email):[...p,email]);
  const createGroup=()=>{
    if(!newGroupName.trim()||newGroupMembers.length===0)return;
    saveGroups([{id:Date.now().toString(),name:newGroupName.trim(),members:newGroupMembers},...groups]);
    setNewGroupName(''); setNewGroupMembers([]); setShowNewGroup(false);
  };
  const deleteGroup=(id)=>{ if(!confirm('Διαγραφή ομάδας;'))return; saveGroups(groups.filter(g=>g.id!==id)); };

  // Στοιχεία επικοινωνίας
  const openEditContact=(email)=>{
    const e=contacts[email]||{};
    const conn=(network.connections||[]).find(c=>c.email===email);
    setContactDraft({ firstName:e.firstName||'', lastName:e.lastName||(conn?.name&&!conn.name.includes('@')?conn.name:''), email, school:e.school||'', roleTitle:e.roleTitle||'', phone:e.phone||'', note:e.note||'' });
    setEditEmail(email);
  };
  const saveContact=async()=>{
    const email=editEmail; if(!email)return;
    setContacts(p=>({...p,[email]:{...contactDraft}}));
    try{ await fetch('/api/contact-info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,info:contactDraft})}); }catch{}
    setEditEmail(null);
  };

  // Upload & Send
  // Step 1: Capture file, open recipient picker
  const handleFileSelect=(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const conns=network.connections||[];
    if(conns.length===0){alert('Δεν έχεις συνδέσεις.');return;}
    setPendingFile(file);
    setSendRecipients(conns.length===1?[conns[0].email]:conns.map(c=>c.email));
    e.target.value='';
  };

  // Step 2: Actual send
  const doSend=async(file,recipients)=>{
    if(!file||recipients.length===0)return;
    setUploading(true);
    try{
      const form=new FormData();
      form.append('file',file||pendingFile);
      form.append('recipients',JSON.stringify(recipients));
      const r=await fetch('/api/student-send',{method:'POST',body:form});
      const d=await r.json();
      if(d.ok){alert('✅ Εστάλη: '+d.name);loadAll();}
      else alert('❌ '+(d.error||'Σφάλμα'));
    }catch{alert('❌ Σφάλμα αποστολής');}
    setUploading(false);
    setPendingFile(null);
    setSendRecipients([]);
  };

  const toggleRecipient=(email)=>{
    setSendRecipients(prev=>prev.includes(email)?prev.filter(e=>e!==email):[...prev,email]);
  };

  // ── Βοηθητικά για κάρτες-φακέλους (εισερχόμενα/απεσταλμένα ανά χρήστη ή ομάδα) ──
  const recipientsOfSent=(f)=>{
    if(Array.isArray(f.recipients))return f.recipients;
    if(Array.isArray(f.sentTo))return f.sentTo;
    if(typeof f.sentTo==='string')return [f.sentTo];
    if(Array.isArray(f.to))return f.to;
    if(typeof f.to==='string')return [f.to];
    return [];
  };
  const inboxFromUser=(email)=>incoming.filter(f=>f.fromEmail===email);
  const sentToUser=(email)=>sentFiles.filter(f=>recipientsOfSent(f).includes(email));
  const inboxFromGroup=(g)=>incoming.filter(f=>(g.members||[]).includes(f.fromEmail));
  const sentToGroup=(g)=>sentFiles.filter(f=>recipientsOfSent(f).some(e=>(g.members||[]).includes(e)));
  const unseenFor=(list)=>list.filter(f=>!seenIds.has(f.id)).length;

  const folderRecipients=()=>{
    if(openFolder?.type==='user')return [openFolder.email];
    if(openFolder?.type==='group')return (openFolder.group?.members)||[];
    return [];
  };
  const handleFolderFileSelect=(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    const rcp=folderRecipients();
    if(rcp.length===0){alert('Ο φάκελος δεν έχει παραλήπτες.');e.target.value='';return;}
    doSend(file,rcp);
    e.target.value='';
  };

  // ── Φωτογραφίες → PDF (χωρίς όριο πλήθους) ──
  const addPhoto=(e)=>{
    const fs=Array.from(e.target.files||[]);
    if(fs.length)setPhotos(p=>[...p,...fs.map(f=>({file:f,url:URL.createObjectURL(f)}))]);
    e.target.value='';
  };
  const removePhoto=(i)=>setPhotos(p=>{try{URL.revokeObjectURL(p[i].url);}catch{}return p.filter((_,j)=>j!==i);});
  const closePhotos=()=>{photos.forEach(p=>{try{URL.revokeObjectURL(p.url);}catch{}});setPhotos([]);setPhotoMode(false);};
  const sendPhotosPdf=async()=>{
    if(photos.length===0||photoBusy)return;
    const rcp=folderRecipients();
    if(rcp.length===0){alert('Ο φάκελος δεν έχει παραλήπτες.');return;}
    setPhotoBusy(true);
    try{
      const pdf=await photosToPdfFile(photos.map(p=>p.file));
      await doSend(pdf,rcp);
      closePhotos();
    }catch{alert('❌ Σφάλμα δημιουργίας PDF');}
    setPhotoBusy(false);
  };

  // ── Μικρή κάρτα αρχείου (άνοιγμα/λήψη/αποθήκευση/QR) ──
  const renderMiniCard=(f,keyBase,{showSave=true}={})=>{
    const isNew=!seenIds.has(f.id);
    const k=keyBase;
    const isExp=expandedCard===k;
    return(
      <div key={k} style={{background:isNew?'#fff9ed':'#fff',border:isNew?'1.5px solid '+P.cream.accent:'1px solid #ebebeb',borderRadius:14,overflow:'hidden',transition:'all 0.15s ease'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpandedCard(isExp?null:k)}>
          <div style={{width:34,height:34,borderRadius:10,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trunc(f.name,22)}</div>
            {f.sentAt&&<div style={{fontSize:11,color:'#8a8a9a',marginTop:1}}>{new Date(f.sentAt).toLocaleDateString('el-GR')}</div>}
          </div>
          {isNew&&<span style={{width:8,height:8,borderRadius:'50%',background:'#f59e0b',flexShrink:0}}/>}
          <span style={{fontSize:11,color:'#aeaeb8',flexShrink:0,transition:'transform 0.15s',transform:isExp?'rotate(180deg)':'none'}}>▼</span>
        </div>
        {isExp&&(
          <div style={{padding:'0 14px 12px',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
            {f.shareMessage&&<div style={{fontSize:12,color:'#1a7f37',background:'#f0fdf4',padding:'8px 10px',borderRadius:8,marginTop:8,lineHeight:1.5}}>💬 {f.shareMessage}</div>}
            {f.info&&<div style={{fontSize:12,color:P.cream.deep,padding:'8px 0 6px',lineHeight:1.5}}>ℹ️ {f.info}</div>}
            <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={()=>openFile(f)} style={S.openBtn}>Άνοιγμα</button>
              <button onClick={()=>downloadFile(f)} style={S.miniBtn} title="Λήψη">⬇</button>
              {showSave&&<button onClick={()=>saveToMyDrive(f)} disabled={savingId===f.id} style={{...S.miniBtn,opacity:savingId===f.id?0.4:1}} title="Αποθήκευση στο Drive">💾</button>}
              <button onClick={()=>setQrFile(f)} style={S.miniBtn} title="QR Code">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Wallet renderer (κινητό): στοιβαγμένες κάρτες-φάκελοι, όπως του καθηγητή ──
  // items: [{ view, name, sub, icon, tone:'cream'|'peach', badge, open() }]
  const renderWallet=(items,activeId,onTap)=>{
    const expandedIdx=items.findIndex(i=>i.view===activeId);
    const hasExpanded=expandedIdx>=0;
    return items.map((item,idx)=>{
      const t=P[item.tone]||P.cream;
      const isExpanded=activeId===item.view;
      const isBefore=hasExpanded&&idx<expandedIdx;
      const isAfter=hasExpanded&&idx>expandedIdx;
      let mt=idx===0?0:-24, ty=0;
      if(isExpanded){mt=idx===0?0:18;ty=-6;}
      else if(isBefore){mt=idx===0?0:-32;ty=-3;}
      else if(isAfter){mt=-32;ty=20;}
      return(
        <div key={item.view} onClick={()=>onTap(item,isExpanded)}
          style={{position:'relative',zIndex:isExpanded?50:(isBefore?idx:hasExpanded?idx:idx+1),marginTop:mt,borderRadius:22,cursor:'pointer',padding:'20px 22px',minHeight:96,
            background:`linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 55%, transparent 70%), ${t.bg}`,
            boxShadow:isExpanded?'0 14px 44px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.12)':hasExpanded&&!isExpanded?'0 1px 4px rgba(0,0,0,0.06)':'0 2px 8px rgba(0,0,0,0.06)',
            transition:'all 0.4s cubic-bezier(0.34,1.4,0.64,1)',transform:`translateY(${ty}px) scale(${isExpanded?1.03:hasExpanded?0.96:1})`,opacity:hasExpanded&&!isExpanded?0.65:1,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:46,height:46,borderRadius:14,background:t.accent,color:t.deep,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
              <div style={{fontSize:12,color:t.text,opacity:0.65,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.sub}</div>
            </div>
            {item.badge>0&&<span style={S.badge}>{item.badge}</span>}
            {isExpanded&&<span style={{fontSize:13,fontWeight:600,color:t.deep,flexShrink:0}}>Άνοιγμα →</span>}
          </div>
        </div>
      );
    });
  };

  // ── Όψη «Δίκτυο» (εσωτερική — όπως «Ανοιχτή πρόσβαση») ──
  if(netView && !viewing){
    const conns=network.connections||[];
    const received=network.received||[];
    const contactLine=(email)=>{ const c=contacts[email]; if(!c)return null; const parts=[c.roleTitle,c.school,c.phone].filter(Boolean); return parts.length?parts.join(' · '):null; };
    return(
      <div style={S.app}><Head><title>Δίκτυο — ΛΕΒΙΑΘΑΝ</title></Head><style>{css}</style>
        {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>{setNetView(false);setViewing(null);setPublicView(false);setOpenFolder(null);}} isMobile={isMobile} myEmail={myEmail} openPublic={openPublicView} openNetwork={openNetwork} dashBadge={unseenCount} activeNetwork/>}
        <div className="student-main" style={{...S.main,marginLeft:!isMobile?(sidebarOpen?220:56):0}}>
          {isMobile&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff'}}><span style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>ΛΕΒΙΑΘΑΝ</span></div>}
          <div style={S.container}>
            <div style={{marginBottom:18}}>
              <h1 style={{fontSize:20,fontWeight:600,color:'#1a1a1a',marginBottom:4,display:'flex',alignItems:'center',gap:8}}>{Ic.net} Δίκτυο</h1>
              <p style={{fontSize:13,color:'#6b6b80',margin:0}}>Διαχείριση συνδέσεων & ομάδων</p>
            </div>

            {/* Πρόσκληση / Αποδοχή */}
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #ebebeb',padding:'16px 18px',marginBottom:18,maxWidth:560}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>📧 Πρόσκληση χρήστη</div>
              <div style={{display:'flex',gap:8}}>
                <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@example.com"
                  onKeyDown={e=>{if(e.key==='Enter')sendInvite();}}
                  style={{flex:1,padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box'}}/>
                <button onClick={sendInvite} disabled={netLoading||!inviteEmail.trim()}
                  style={{padding:'10px 18px',borderRadius:10,border:'none',background:P.cream.deep,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',opacity:(netLoading||!inviteEmail.trim())?0.5:1}}>Αποστολή</button>
              </div>
              {received.length>0&&(
                <div style={{marginTop:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#dc2626',marginBottom:6}}>🔔 Εκκρεμείς προσκλήσεις</div>
                  {received.map(inv=>(
                    <div key={inv.email} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:'1px solid #f0f0f0'}}>
                      <span style={{flex:1,fontSize:12,color:'#6b6b80'}}>{inv.name||inv.email}</span>
                      <button onClick={()=>acceptInvite(inv.email)} style={{padding:'5px 14px',borderRadius:8,border:'none',background:'#16a34a',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}>Αποδοχή</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ομάδες */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>👥 Ομάδες</div>
              {groupMsg&&<span style={{fontSize:11,color:groupMsg.startsWith('✓')?'#15803d':groupMsg.startsWith('✗')?'#dc2626':'#8a8a9a'}}>{groupMsg}</span>}
              <button onClick={()=>{setShowNewGroup(v=>!v);setNewGroupName('');setNewGroupMembers([]);}} disabled={conns.length===0}
                style={{marginLeft:'auto',padding:'6px 14px',borderRadius:10,border:'1.5px solid '+P.peach.accent,background:P.peach.bgSoft,color:P.peach.deep,fontSize:12,fontWeight:600,cursor:conns.length===0?'default':'pointer',opacity:conns.length===0?0.5:1}}>+ Νέα ομάδα</button>
            </div>

            {showNewGroup&&(
              <div style={{background:'#fff',borderRadius:14,border:'1px solid '+P.peach.accent,padding:'14px 16px',marginBottom:16,maxWidth:560}}>
                <input autoFocus value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Όνομα ομάδας…"
                  style={{width:'100%',padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box',marginBottom:10}}/>
                <div style={{fontSize:11,fontWeight:700,color:'#aeaeb8',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Μέλη {newGroupMembers.length>0&&`(${newGroupMembers.length})`}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
                  {conns.map(c=>{ const sel=newGroupMembers.includes(c.email);
                    return(
                      <button key={c.email} onClick={()=>toggleMember(c.email)}
                        style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',borderRadius:10,border:sel?'2px solid #16a34a':'1px solid #ebebeb',background:sel?'#f0fdf4':'#fafafa',cursor:'pointer',textAlign:'left'}}>
                        <span style={{flex:1,fontSize:13,color:'#1a1a1a'}}>{c.name||c.email}</span>
                        {sel&&<span style={{color:'#16a34a',fontSize:15}}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button onClick={()=>setShowNewGroup(false)} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #e0e0e0',background:'#fff',fontSize:13,cursor:'pointer',color:'#6b6b80'}}>Ακύρωση</button>
                  <button onClick={createGroup} disabled={!newGroupName.trim()||newGroupMembers.length===0}
                    style={{flex:1,padding:'10px',borderRadius:10,border:'none',background:(newGroupName.trim()&&newGroupMembers.length>0)?P.peach.deep:'#ccc',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>Δημιουργία</button>
                </div>
              </div>
            )}

            {groups.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(240px,1fr))',gap:12,marginBottom:24}}>
                {groups.map(g=>(
                  <div key={g.id} style={{background:'#fff',borderRadius:14,border:'1px solid #ebebeb',padding:'14px 16px',display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:P.peach.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👥</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.name}</div>
                        <div style={{fontSize:11,color:'#8a8a9a'}}>{(g.members||[]).length} μέλη</div>
                      </div>
                      <button onClick={()=>deleteGroup(g.id)} title="Διαγραφή" style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:14,padding:'2px 6px'}}>✕</button>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {(g.members||[]).map(m=>{const tc=teacherColor(m);return <span key={m} style={{fontSize:10,padding:'2px 8px',borderRadius:999,background:tc.bg,color:tc.text}}>{(conns.find(c=>c.email===m)?.name||m).split('@')[0]}</span>;})}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Συνδέσεις */}
            <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>🔗 Συνδέσεις {conns.length>0&&<span style={{fontSize:12,color:'#aeaeb8',fontWeight:500}}>({conns.length})</span>}</div>
            {conns.length===0
              ? <div style={S.emptyCol}>Δεν έχεις συνδέσεις ακόμη. Στείλε μια πρόσκληση παραπάνω.</div>
              : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                  {conns.map(c=>{
                    const nm=c.name||c.email.split('@')[0];
                    const tc=teacherColor(c.email);
                    const line=contactLine(c.email);
                    return(
                      <div key={c.email} style={{background:'#fff',borderRadius:14,border:'1px solid #ebebeb',padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{width:38,height:38,borderRadius:10,background:tc.bg,color:tc.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{(nm.charAt(0)||'?').toUpperCase()}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nm}</div>
                            <div style={{fontSize:11,color:'#8a8a9a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.email}</div>
                          </div>
                        </div>
                        {line&&<div style={{fontSize:11,color:P.cream.deep,lineHeight:1.4}}>ℹ️ {trunc(line,60)}</div>}
                        <div style={{display:'flex',gap:8,marginTop:2}}>
                          <button onClick={()=>openEditContact(c.email)} style={{flex:1,padding:'7px 10px',borderRadius:9,border:'1px solid '+P.cream.accent,background:P.cream.bgSoft,color:P.cream.deep,fontSize:12,fontWeight:600,cursor:'pointer'}}>✎ Πληροφορίες</button>
                          <button onClick={()=>disconnectUser(c.email)} title="Διαγραφή σύνδεσης" style={{padding:'7px 12px',borderRadius:9,border:'1px solid #fca5a5',background:'#fff',color:'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer'}}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        </div>

        {/* Modal επεξεργασίας στοιχείων επικοινωνίας */}
        {editEmail&&(
          <div onClick={()=>setEditEmail(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'24px 22px',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',maxHeight:'85vh',overflowY:'auto'}}>
              <div style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:2}}>Στοιχεία επικοινωνίας</div>
              <div style={{fontSize:12,color:'#6b6b80',marginBottom:14}}>{editEmail}</div>
              {[['firstName','Όνομα'],['lastName','Επώνυμο'],['roleTitle','Ιδιότητα'],['school','Σχολείο/Φορέας'],['phone','Τηλέφωνο']].map(([k,label])=>(
                <div key={k} style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#aeaeb8',marginBottom:4}}>{label}</div>
                  <input value={contactDraft[k]||''} onChange={e=>setContactDraft(p=>({...p,[k]:e.target.value}))}
                    style={{width:'100%',padding:'9px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:'#aeaeb8',marginBottom:4}}>Σημείωση</div>
                <textarea value={contactDraft.note||''} onChange={e=>setContactDraft(p=>({...p,note:e.target.value}))} rows={3}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box',resize:'vertical'}}/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setEditEmail(null)} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #e0e0e0',background:'#fff',fontSize:13,cursor:'pointer',color:'#6b6b80'}}>Ακύρωση</button>
                <button onClick={saveContact} style={{flex:1,padding:'10px',borderRadius:10,border:'none',background:P.cream.deep,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>Αποθήκευση</button>
              </div>
            </div>
          </div>
        )}

        {isMobile&&(
          <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            <MobBtn icon={Ic.dashboard} label="Πίνακας" badge={unseenCount} onClick={()=>{setNetView(false);setViewing(null);setPublicView(false);setOpenFolder(null);}}/>
            <MobBtn icon={Ic.live} label="Live" onClick={()=>openExternal('/live')}/>
            <MobBtn icon={Ic.net} label="Δίκτυο" active onClick={openNetwork}/>
            <MobBtn icon={Ic.globe} label="Πρόσβαση" onClick={openPublicView}/>
            <MobBtn icon={Ic.out} label="Έξοδος" onClick={()=>signOut({callbackUrl:'/login'})}/>
          </nav>
        )}
      </div>
    );
  }

  // ── Προβολή «Ανοιχτή πρόσβαση»: δημόσιο υλικό όλων των εκπαιδευτικών ──
  if(publicView && !viewing){
    const teacherList=(network.connections||[]).filter(c=>publicFiles.some(f=>f.fromEmail===c.email));
    const shown=publicFiles.filter(f=>publicFrom==='__all__'||f.fromEmail===publicFrom);
    return(
      <div style={S.app}><Head><title>Ανοιχτή πρόσβαση — ΛΕΒΙΑΘΑΝ</title></Head><style>{css}</style>
        {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>{setPublicView(false);setViewing(null);setNetView(false);}} isMobile={isMobile} myEmail={myEmail} openPublic={openPublicView} openNetwork={openNetwork} dashBadge={unseenCount} activePublic/>}
        <div className="student-main" style={{...S.main,marginLeft:!isMobile?(sidebarOpen?220:56):0}}>
          {isMobile&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff'}}><span style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>ΛΕΒΙΑΘΑΝ</span></div>}
          <div style={S.container}>
            <div style={{marginBottom:18}}>
              <h1 style={{fontSize:20,fontWeight:600,color:'#1a1a1a',marginBottom:4}}>🌐 Ανοιχτή πρόσβαση</h1>
              <p style={{fontSize:13,color:'#6b6b80',margin:0}}>Δημόσιο υλικό από τους εκπαιδευτικούς σου</p>
            </div>

            {/* Φίλτρο ανά εκπαιδευτικό */}
            {teacherList.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:P.cream.deep,textTransform:'uppercase',letterSpacing:0.4,marginBottom:6}}>Εμφάνιση υλικού</div>
                <select value={publicFrom} onChange={e=>setPublicFrom(e.target.value)}
                  style={{width:'100%',maxWidth:420,padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',color:'#1a1a1a',cursor:'pointer'}}>
                  <option value="__all__">Όλοι οι εκπαιδευτικοί</option>
                  {teacherList.map(c=>(
                    <option key={c.email} value={c.email}>{c.name||c.email.split('@')[0]}</option>
                  ))}
                </select>
              </div>
            )}

            {loadingPublic&&<div style={S.empty}>Φόρτωση…</div>}
            {!loadingPublic&&(network.connections||[]).length===0&&<div style={S.empty}>Δεν είσαι συνδεδεμένος με κανέναν εκπαιδευτικό ακόμη.</div>}
            {!loadingPublic&&(network.connections||[]).length>0&&shown.length===0&&<div style={S.empty}>Δεν υπάρχει δημόσιο υλικό προς εμφάνιση.</div>}

            {!loadingPublic&&shown.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:6,maxWidth:560}}>
                {shown.map((f,i)=>{
                  const isExp=expandedPub===(f.id+f.fromEmail+i);
                  const tc=tagColor(f.fromEmail||'');
                  return(
                    <div key={f.id+f.fromEmail+i} style={{background:'#fff',border:'1px solid #ebebeb',borderRadius:14,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpandedPub(isExp?null:f.id+f.fromEmail+i)}>
                        <div style={{width:34,height:34,borderRadius:10,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                          <div style={{marginTop:2}}>
                            <span style={{fontSize:10,fontWeight:600,padding:'1px 8px',borderRadius:999,background:tc.bg,color:tc.text,whiteSpace:'nowrap',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',display:'inline-block'}} title={(f.fromName||f.fromEmail||'').split('@')[0]}>📚 {trunc((f.fromName||f.fromEmail||'').split('@')[0],20)}</span>
                          </div>
                        </div>
                        <span style={{fontSize:11,color:'#aeaeb8',flexShrink:0,transition:'transform 0.15s',transform:isExp?'rotate(180deg)':'none'}}>▼</span>
                      </div>
                      {isExp&&(
                        <div style={{padding:'0 14px 12px',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
                          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
                            <button onClick={()=>openFile(f)} style={{padding:'7px 16px',borderRadius:10,border:'1.5px solid #8a7d4a',background:'transparent',color:'#5c4a1e',fontSize:12,fontWeight:600,cursor:'pointer'}}>Άνοιγμα →</button>
                            <button onClick={()=>window.open(`https://drive.google.com/uc?id=${f.id}&export=download`,'_blank')} style={{padding:'7px 12px',borderRadius:10,border:'1px solid #e0e0e0',background:'#f9f6ed',color:'#5c4a1e',fontSize:12,cursor:'pointer'}}>⬇ Λήψη</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {isMobile&&(
          <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            <MobBtn icon={Ic.dashboard} label="Πίνακας" badge={unseenCount} onClick={()=>{setPublicView(false);setViewing(null);setOpenFolder(null);}}/>
            <MobBtn icon={Ic.live} label="Live" onClick={()=>openExternal('/live')}/>
            <MobBtn icon={Ic.net} label="Δίκτυο" onClick={openNetwork}/>
            <MobBtn icon={Ic.globe} label="Πρόσβαση" active onClick={openPublicView}/>
            <MobBtn icon={Ic.out} label="Έξοδος" onClick={()=>signOut({callbackUrl:'/login'})}/>
          </nav>
        )}
      </div>
    );
  }

  // Desktop viewer
  if(viewing&&!isMobile){
    const url=viewing.previewUrl||`https://drive.google.com/file/d/${viewing.id}/preview`;
    return(
      <div style={S.app}><Head><title>{viewing.name}</title></Head><style>{css}</style>
        {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>{setViewing(null);setPublicView(false);setNetView(false);setOpenFolder(null);}} isMobile={isMobile} myEmail={myEmail} openPublic={openPublicView} openNetwork={openNetwork} dashBadge={unseenCount}/>}
        <div style={{...S.main,marginLeft:sidebarOpen?220:56}}>
          <div style={{display:'flex',alignItems:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff',gap:10}}>
            <button onClick={()=>setViewing(null)} style={{background:'none',border:'1px solid #ddd',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:13,color:'#444'}}>← Πίσω</button>
            <strong style={{flex:1,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#1a1a1a'}}>{viewing.name}</strong>
          </div>
          <iframe src={url} style={{flex:1,border:'none',width:'100%',display:'block',height:'calc(100vh - 60px)'}} title={viewing.name} allow="fullscreen"/>
        </div>
      </div>
    );
  }

  // Main
  return(
    <div style={S.app}><Head><title>ΛΕΒΙΑΘΑΝ — Μαθητής</title></Head><style>{css}</style>
      {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>{setViewing(null);setPublicView(false);setNetView(false);setOpenFolder(null);}} isMobile={isMobile} myEmail={myEmail} openPublic={openPublicView} openNetwork={openNetwork}/>}
      <div className="student-main" style={{...S.main,marginLeft:!isMobile?(sidebarOpen?220:56):0}}>
        {isMobile&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff'}}><span style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>ΛΕΒΙΑΘΑΝ</span></div>}

        <div style={S.container}>

          {loading&&<div style={S.empty}>Φόρτωση…</div>}

          {/* ═══════════ ΠΙΝΑΚΑΣ ΕΛΕΓΧΟΥ — ΚΑΡΤΕΣ-ΦΑΚΕΛΟΙ (μεγάλες, όπως του καθηγητή) ═══════════ */}
          {!loading&&!openFolder&&(()=>{
            const conns=network.connections||[];
            const fixed=[
              {key:'inbox', type:'inbox', name:'Εισερχόμενα', icon:'📥', tone:'cream', sub:`${incoming.length} αρχεία`, badge:unseenCount},
              {key:'sent', type:'sent', name:'Απεσταλμένα', icon:'📤', tone:'peach', sub:`${sentFiles.length} αρχεία`},
              {key:'search', type:'search', name:'Αναζήτηση', icon:'🔍', tone:'cream', sub:'εισερχόμενα & απεσταλμένα'},
            ];
            const card=(o,onClick)=>{
              const t=P[o.tone];
              return(
                <div key={o.key} className="ch" onClick={onClick}
                  style={{background:`linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 55%, transparent 70%), ${t.bg}`,borderRadius:22,padding:'22px 24px',cursor:'pointer',minHeight:170,display:'flex',flexDirection:'column',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',transition:'transform 0.15s,box-shadow 0.15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                    <div style={{width:48,height:48,borderRadius:14,background:t.accent,color:t.deep,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,flexShrink:0}}>{o.icon}</div>
                    {o.badge>0&&<span style={S.badge}>{o.badge}</span>}
                  </div>
                  <h3 style={{fontSize:18,fontWeight:700,color:t.text,margin:'0 0 6px',letterSpacing:'-0.015em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.name}</h3>
                  <p style={{fontSize:13,lineHeight:1.55,color:t.text,opacity:0.65,margin:0,flex:1}}>{o.sub}</p>
                  <div style={{display:'flex',justifyContent:'flex-end',paddingTop:14,marginTop:14,borderTop:'1px solid '+t.accent}}>
                    <button style={{background:'transparent',border:'none',fontSize:13,fontWeight:600,cursor:'pointer',color:t.deep}}>Άνοιγμα →</button>
                  </div>
                </div>
              );
            };
            const openOf=(o)=>()=>{setExpandedCard(null);setDetailSearch('');setOpenFolder({type:o.type,name:o.name});};
            // Στοιχεία για wallet (κινητό)
            const fixedItems=fixed.map(o=>({view:o.key,name:o.name,sub:o.sub,icon:o.icon,tone:o.tone,badge:o.badge,open:openOf(o)}));
            const contactItems=[
              ...groups.map(g=>{const ic=inboxFromGroup(g),st=sentToGroup(g);return {view:'g_'+g.id,name:g.name,icon:'👥',tone:'peach',sub:`📥 ${ic.length} · 📤 ${st.length}`,badge:unseenFor(ic),open:()=>{setExpandedCard(null);setOpenFolder({type:'group',group:g,name:g.name});}};}),
              ...conns.map(c=>{const nm=c.name||c.email.split('@')[0];const ic=inboxFromUser(c.email),st=sentToUser(c.email);return {view:'u_'+c.email,name:nm,icon:(nm.charAt(0)||'?').toUpperCase(),tone:'cream',sub:`📥 ${ic.length} · 📤 ${st.length}`,badge:unseenFor(ic),open:()=>{setExpandedCard(null);setOpenFolder({type:'user',email:c.email,name:nm});}};}),
            ];
            const walletTap=(item,isExpanded)=>{ if(isExpanded){setWalletActive(null);item.open();} else setWalletActive(item.view); };
            return(
              <>
                <div style={{marginBottom:18}}>
                  <h1 style={{fontSize:20,fontWeight:600,color:'#1a1a1a',marginBottom:4}}>Καλώς ήρθες 📚</h1>
                  <p style={{fontSize:13,color:'#6b6b80',margin:0}}>{myEmail}</p>
                </div>

                {isMobile
                  ? <div style={{position:'relative',marginBottom:28,paddingBottom:8}}>{renderWallet(fixedItems,walletActive,walletTap)}</div>
                  : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18,marginBottom:32}}>
                      {fixed.map(o=>card(o,openOf(o)))}
                    </div>}

                <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  Οι επαφές μου
                  <button onClick={openNetwork} style={{marginLeft:'auto',padding:'6px 14px',borderRadius:10,border:'1.5px solid '+P.cream.accent,background:P.cream.bgSoft,color:P.cream.deep,fontSize:12,fontWeight:600,cursor:'pointer'}}>⚙ Διαχείριση δικτύου</button>
                </div>

                {conns.length===0&&groups.length===0
                  ? <div style={S.emptyCol}>Δεν έχεις συνδέσεις ακόμη. Πήγαινε στο «Δίκτυο» για να προσκαλέσεις χρήστες.</div>
                  : isMobile
                    ? <div style={{position:'relative',paddingBottom:8}}>{renderWallet(contactItems,walletActive,walletTap)}</div>
                    : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18}}>
                        {groups.map(g=>{
                          const ic=inboxFromGroup(g), st=sentToGroup(g);
                          return card({key:'g_'+g.id,name:g.name,icon:'👥',tone:'peach',sub:`📥 ${ic.length} εισερχόμενα · 📤 ${st.length} απεσταλμένα`,badge:unseenFor(ic)},
                            ()=>{setExpandedCard(null);setOpenFolder({type:'group',group:g,name:g.name});});
                        })}
                        {conns.map(c=>{
                          const nm=c.name||c.email.split('@')[0];
                          const ic=inboxFromUser(c.email), st=sentToUser(c.email);
                          return card({key:'u_'+c.email,name:nm,icon:(nm.charAt(0)||'?').toUpperCase(),tone:'cream',sub:`📥 ${ic.length} εισερχόμενα · 📤 ${st.length} απεσταλμένα`,badge:unseenFor(ic)},
                            ()=>{setExpandedCard(null);setOpenFolder({type:'user',email:c.email,name:nm});});
                        })}
                      </div>
                }
              </>
            );
          })()}

          {/* ═══════════ ΑΝΟΙΓΜΑ ΦΑΚΕΛΟΥ — ΔΙΠΛΗ ΣΤΗΛΗ ═══════════ */}
          {!loading&&openFolder&&(()=>{
            const f=openFolder;
            const isUserOrGroup=f.type==='user'||f.type==='group';
            let leftList=[], rightList=[];
            if(f.type==='inbox') leftList=incoming;
            else if(f.type==='sent') rightList=sentFiles;
            else if(f.type==='user'){leftList=inboxFromUser(f.email); rightList=sentToUser(f.email);}
            else if(f.type==='group'){leftList=inboxFromGroup(f.group); rightList=sentToGroup(f.group);}
            else if(f.type==='search'){
              const q=detailSearch.trim().toLowerCase();
              leftList=q?incoming.filter(x=>x.name.toLowerCase().includes(q)):[];
              rightList=q?sentFiles.filter(x=>x.name.toLowerCase().includes(q)):[];
            }
            const showLeft=f.type==='inbox'||f.type==='search'||isUserOrGroup;
            const showRight=f.type==='sent'||f.type==='search'||isUserOrGroup;
            return(
              <>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
                  <button onClick={()=>{setOpenFolder(null);setDetailSearch('');setExpandedCard(null);}} style={{background:'none',border:'1px solid #ddd',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:13,color:'#444'}}>← Πίσω</button>
                  <h1 style={{fontSize:19,fontWeight:600,color:'#1a1a1a',margin:0,display:'flex',alignItems:'center',gap:8}}>
                    {f.type==='group'?'👥':f.type==='user'?'👤':f.type==='sent'?'📤':f.type==='search'?'🔍':'📥'} {f.name}
                  </h1>
                </div>

                {isUserOrGroup&&(
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid '+P.peach.accent,padding:'14px 16px',marginBottom:18,textAlign:'center'}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4,color:'#1a1a1a'}}>📤 Αποστολή σε «{f.name}»</div>
                    <div style={{fontSize:11,color:'#aeaeb8',marginBottom:10}}>
                      {f.type==='group'?`Στέλνεται αυτόματα σε ${(f.group?.members||[]).length} μέλη`:'Στέλνεται αυτόματα στον χρήστη του φακέλου'}
                    </div>
                    <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
                      <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:12,background:P.peach.bg,color:P.peach.deep,fontSize:13,fontWeight:600,cursor:uploading?'wait':'pointer',opacity:uploading?0.5:1,border:'1.5px solid '+P.peach.accent}}>
                        {uploading?'Αποστολή…':'Επιλογή αρχείου'}
                        <input type="file" style={{display:'none'}} onChange={handleFolderFileSelect} disabled={uploading}/>
                      </label>
                      <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:12,background:P.cream.bgSoft,color:P.cream.deep,fontSize:13,fontWeight:600,cursor:uploading?'wait':'pointer',opacity:uploading?0.5:1,border:'1.5px solid '+P.cream.accent}}>
                        📷 Φωτογραφία → PDF
                        <input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{setPhotoMode(true);addPhoto(e);}} disabled={uploading}/>
                      </label>
                    </div>
                  </div>
                )}

                {f.type==='search'&&(
                  <input autoFocus type="search" placeholder="Αναζήτηση σε εισερχόμενα & απεσταλμένα…" value={detailSearch} onChange={e=>setDetailSearch(e.target.value)}
                    style={{width:'100%',padding:'11px 16px',border:'1px solid #ebebeb',borderRadius:14,fontSize:isMobile?16:14,background:'#fff',marginBottom:16,boxSizing:'border-box'}}/>
                )}

                <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'flex-start'}}>
                  {showLeft&&(
                    <div style={{flex:'1 1 320px',minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>📥 Εισερχόμενα {unseenFor(leftList)>0&&<span style={S.badge}>{unseenFor(leftList)}</span>}</div>
                      {leftList.length===0
                        ? <div style={S.emptyCol}>{f.type==='search'?'Πληκτρολόγησε για αναζήτηση.':'Κανένα εισερχόμενο.'}</div>
                        : <div style={{display:'flex',flexDirection:'column',gap:6}}>{leftList.map((x,i)=>renderMiniCard(x,'in_'+x.id+'_'+(x.fromEmail||'')+'_'+i,{showSave:true}))}</div>}
                    </div>
                  )}
                  {showRight&&(
                    <div style={{flex:'1 1 320px',minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a',marginBottom:10}}>📤 Απεσταλμένα</div>
                      {rightList.length===0
                        ? <div style={S.emptyCol}>{f.type==='search'?'Πληκτρολόγησε για αναζήτηση.':'Κανένα απεσταλμένο.'}</div>
                        : <div style={{display:'flex',flexDirection:'column',gap:6}}>{rightList.map((x,i)=>renderMiniCard(x,'out_'+x.id+'_'+i,{showSave:false}))}</div>}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

        </div>
      </div>

      {/* Φωτογραφίες → PDF modal */}
      {photoMode&&(
        <div onClick={photoBusy?undefined:closePhotos} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'24px 20px',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:4}}>📷 Φωτογραφίες → PDF</div>
            <div style={{fontSize:12,color:'#6b6b80',marginBottom:14}}>Τράβηξε όσες φωτογραφίες θέλεις — ενώνονται σε ένα PDF (μία σελίδα η καθεμία) και στέλνονται σε «{openFolder?.name}».</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14,justifyContent:'center'}}>
              {photos.map((p,i)=>(
                <div key={p.url} style={{position:'relative',width:110,height:140,borderRadius:12,overflow:'hidden',border:'1px solid #ebebeb'}}>
                  <img src={p.url} alt={'Φωτογραφία '+(i+1)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={()=>removePhoto(i)} disabled={photoBusy} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:12,cursor:'pointer',lineHeight:'22px',padding:0}}>✕</button>
                  <span style={{position:'absolute',bottom:4,left:4,background:'rgba(0,0,0,0.55)',color:'#fff',fontSize:10,padding:'1px 7px',borderRadius:999}}>Σελίδα {i+1}</span>
                </div>
              ))}
              {!photoBusy&&(
                <label style={{width:110,height:140,borderRadius:12,border:'2px dashed '+P.peach.accent,background:P.peach.bgSoft,color:P.peach.deep,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer',fontSize:12,fontWeight:600,boxSizing:'border-box',textAlign:'center'}}>
                  <span style={{fontSize:22}}>📷</span>{photos.length===0?'Λήψη φωτογραφίας':'+ φωτογραφία'}
                  <input type="file" accept="image/*" capture="environment" multiple style={{display:'none'}} onChange={addPhoto}/>
                </label>
              )}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={closePhotos} disabled={photoBusy} style={{flex:1,padding:'10px',borderRadius:12,border:'1px solid #e0e0e0',background:'#fff',fontSize:13,cursor:'pointer',color:'#6b6b80',opacity:photoBusy?0.5:1}}>Ακύρωση</button>
              <button onClick={sendPhotosPdf} disabled={photos.length===0||photoBusy}
                style={{flex:1,padding:'10px',borderRadius:12,border:'none',background:photos.length>0?P.peach.deep:'#ccc',color:'#fff',fontSize:13,fontWeight:600,cursor:photos.length>0&&!photoBusy?'pointer':'not-allowed',opacity:photoBusy?0.6:1}}>
                {photoBusy?'Δημιουργία PDF…':`Αποστολή ως PDF${photos.length>0?` (${photos.length} σελ.)`:''}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <MobBtn icon={Ic.dashboard} label="Πίνακας" active badge={unseenCount} onClick={()=>{setViewing(null);setPublicView(false);setOpenFolder(null);}}/>
          <MobBtn icon={Ic.live} label="Live" onClick={()=>openExternal('/live')}/>
          <MobBtn icon={Ic.net} label="Δίκτυο" onClick={openNetwork}/>
          <MobBtn icon={Ic.globe} label="Πρόσβαση" onClick={openPublicView}/>
          <MobBtn icon={Ic.out} label="Έξοδος" onClick={()=>signOut({callbackUrl:'/login'})}/>
        </nav>
      )}

      {/* Recipient picker modal */}
      {pendingFile&&(network.connections||[]).length>0&&(
        <div onClick={()=>{setPendingFile(null);setSendRecipients([]);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:'24px 20px',maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',maxHeight:'80vh',overflowY:'auto'}}>
            <div style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:4}}>Αποστολή σε…</div>
            <div style={{fontSize:12,color:'#6b6b80',marginBottom:12}}>📎 {pendingFile.name}</div>
            <div style={{fontSize:11,color:'#aeaeb8',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,marginBottom:8}}>
              Παραλήπτες {sendRecipients.length>0&&<span style={{background:'#1a1a1a',color:'#fff',borderRadius:999,padding:'1px 7px',fontSize:10}}>{sendRecipients.length}</span>}
            </div>
            {(network.connections||[]).map(c=>{
              const isSel=sendRecipients.includes(c.email);
              const tc=teacherColor(c.email);
              return(
                <button key={c.email} onClick={()=>toggleRecipient(c.email)}
                  style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',borderRadius:12,
                    border:isSel?'2px solid #16a34a':'1px solid #ebebeb',
                    background:isSel?'#f0fdf4':'#fafafa',cursor:'pointer',marginBottom:6,textAlign:'left'}}>
                  <span style={{width:28,height:28,borderRadius:8,background:tc.bg,color:tc.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>
                    {(c.name||c.email).charAt(0).toUpperCase()}
                  </span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:'#1a1a1a'}}>{c.name||c.email}</div>
                    <div style={{fontSize:11,color:'#6b6b80'}}>{c.email}</div>
                  </div>
                  {isSel&&<span style={{fontSize:16,color:'#16a34a',flexShrink:0}}>✓</span>}
                </button>
              );
            })}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={()=>{setPendingFile(null);setSendRecipients([]);}}
                style={{flex:1,padding:'10px',borderRadius:12,border:'1px solid #e0e0e0',background:'#fff',fontSize:13,cursor:'pointer',color:'#6b6b80'}}>Ακύρωση</button>
              <button onClick={()=>doSend(pendingFile,sendRecipients)} disabled={sendRecipients.length===0||uploading}
                style={{flex:1,padding:'10px',borderRadius:12,border:'none',background:sendRecipients.length>0?P.peach.deep:'#ccc',color:'#fff',fontSize:13,fontWeight:600,cursor:sendRecipients.length>0?'pointer':'not-allowed',opacity:uploading?0.5:1}}>
                {uploading?'Αποστολή…':'Αποστολή'} {sendRecipients.length>0&&`(${sendRecipients.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ΕΚΠΑΙΔΕΥΤΙΚΟΣ — υπάρχον UI χωρίς αλλαγές (συντόμευση)
   ══════════════════════════════════════════════════════════════ */
function TeacherView({teacher,myEmail,hasSession,isMobile,router}){
  const visitorEmail=myEmail;
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [viewing,setViewing]=useState(null);
  const [search,setSearch]=useState('');
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [visibilityInfo,setVisibilityInfo]=useState(null);
  const [activeTag,setActiveTag]=useState(null);
  const [qrFile,setQrFile]=useState(null);
  const getFileUrl=f=>`https://drive.google.com/file/d/${f.id}/view`;
  const getVisLabel=(v)=>{
    if(!v||v==='none')return null;
    if(v==='public')return '🌐 Δημόσιο';
    if(v==='connections')return '👥 Συνδέσεις';
    if(v.startsWith('user:'))return '👤 '+v.slice(5).split('@')[0];
    if(v.startsWith('users:')){
      try{const arr=JSON.parse(v.slice(6));return '👥 '+arr.map(e=>e.split('@')[0]).join(', ');}catch{return '👥 Πολλοί';}
    }
    return null;
  };

  const loadData=useCallback(async()=>{
    setLoading(true);
    try{
      const tEmail=teacher||myEmail;if(!tEmail){setLoading(false);return;}
      const p=new URLSearchParams({email:tEmail});if(visitorEmail)p.set('visitor',visitorEmail);
      const r=await fetch(`/api/publish?${p}`);if(!r.ok)throw new Error();
      setData({files:(await r.json()).items||[]});
    }catch{setError('Δεν βρέθηκαν δημοσιευμένα αρχεία.');}
    setLoading(false);
  },[teacher,visitorEmail,myEmail]);

  useEffect(()=>{loadData();const iv=setInterval(loadData,30000);return()=>clearInterval(iv);},[loadData]);

  const files=data?.files||[];
  const allTags=useMemo(()=>{const m={};files.forEach(f=>(f.tags||[]).forEach(t=>{m[t]=(m[t]||0)+1;}));return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[files]);
  const filtered=useMemo(()=>{let r=[...files];if(activeTag)r=r.filter(f=>(f.tags||[]).includes(activeTag));if(search.trim()){const q=search.toLowerCase();r=r.filter(f=>f.name.toLowerCase().includes(q)||(f.tags||[]).some(t=>t.toLowerCase().includes(q)));}return r;},[files,search,activeTag]);

  const openFile=f=>{
    const isHtml=/\.html?$/i.test(f.name);
    const isOffice=/\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    let url;
    if(isHtml) url=`/api/student-file?id=${f.id}`;
    else if(isOffice) url = f.pdfId
      ? `https://drive.google.com/file/d/${f.pdfId}/preview`   // έτοιμο PDF αντίγραφο — χωρίς νέα μετατροπή
      : `/api/inbox-pdf?id=${f.id}&name=${encodeURIComponent(f.name)}`; // fallback on-the-fly
    else url=`https://drive.google.com/file/d/${f.id}/preview`;
    if(isMobile){openExternal(url);return;}
    setViewing({...f, previewUrl:url});
  };
  const goHome=()=>{setViewing(null);setSearch('');setActiveTag(null);loadData();};
  const goBack=()=>{if(hasSession)router.push('/');else router.push('/login');};

  if(viewing&&!isMobile){
    const driveUrl=viewing.previewUrl||'/api/file/'+viewing.id;
    return(
      <div style={S.app}><Head><title>{viewing.name}</title></Head><style>{css}</style>
        <TeacherSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession}/>
        <div style={{...S.main,marginLeft:sidebarOpen?220:56}}>
          <div style={{display:'flex',alignItems:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff',gap:10}}>
            <button onClick={goHome} style={{background:'none',border:'1px solid #ddd',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:13,color:'#444'}}>← Πίσω</button>
            <strong style={{flex:1,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#1a1a1a'}}>{viewing.name}</strong>
          </div>
          <iframe src={driveUrl} style={{flex:1,border:'none',width:'100%',display:'block',height:'calc(100vh - 60px)'}} title={viewing.name} allow="fullscreen"/>
        </div>
      </div>
    );
  }

  return(
    <div style={S.app}><Head><title>Student — ΛΕΒΙΑΘΑΝ</title></Head><style>{css}</style>
      {!isMobile&&<TeacherSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={goHome} goBack={goBack} hasSession={hasSession}/>}
      <div className="student-main" style={{...S.main,marginLeft:!isMobile?(sidebarOpen?220:56):0}}>
        {isMobile&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff'}}><span style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>ΛΕΒΙΑΘΑΝ</span></div>}
        <div style={S.container}>
          <div style={{marginBottom:28}}><h1 style={{fontSize:22,fontWeight:600,color:'#1a1a1a',marginBottom:6}}>Δημοσιεύσεις μου 📤</h1><p style={{fontSize:14,color:'#6b6b80',margin:0}}>Υλικό που έχεις δημοσιεύσει</p>
            <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <button onClick={()=>{const short=myEmail.split('@')[0];const url=`${window.location.origin}/s/${short}`;navigator.clipboard.writeText(url).then(()=>alert('Αντιγράφηκε!\n'+url)).catch(()=>prompt('Σύνδεσμος:',url));}} style={{padding:'8px 16px',borderRadius:10,border:'1.5px solid '+P.cream.accent,background:P.cream.bgSoft,color:P.cream.deep,fontSize:12,fontWeight:600,cursor:'pointer'}}>📋 Αντιγραφή συνδέσμου</button>
              <span style={{fontSize:11,color:'#aeaeb8'}}>leviathan…/s/{myEmail?myEmail.split('@')[0]:'…'}</span>
            </div>
          </div>
          {loading&&<div style={S.empty}>Φόρτωση…</div>}
          {error&&<div style={{textAlign:'center',padding:60,color:'#dc2626',fontSize:14}}>{error}</div>}
          {data&&!loading&&<>
            <div style={{borderRadius:18,padding:'16px 18px',background:P.cream.bg,color:P.cream.text,marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>Δημοσιευμένο υλικό</div>
              <div style={{fontSize:32,fontWeight:700}}>{files.length}</div>
            </div>
            {files.length>0&&<input type="search" placeholder="Αναζήτηση…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:'11px 16px',border:'1px solid #ebebeb',borderRadius:14,fontSize:isMobile?16:14,background:'#fff',marginBottom:12,boxSizing:'border-box'}}/>}
            {allTags.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:18}}>
              {activeTag&&<button onClick={()=>setActiveTag(null)} style={{padding:'5px 12px',borderRadius:10,border:'1px solid #ddd',background:'#fff',fontSize:12,cursor:'pointer',color:'#888'}}>✕ Όλα</button>}
              {allTags.map(([tag,count])=>{const c=tagColor(tag);const isA=activeTag===tag;return<button key={tag} onClick={()=>setActiveTag(isA?null:tag)} style={{padding:'5px 12px',borderRadius:10,border:isA?'2px solid '+c.text:'1px solid #e0e0e0',background:isA?c.bg:'#fafafa',fontSize:12,cursor:'pointer',color:c.text,fontWeight:isA?700:500}}>#{tag} ({count})</button>;})}
            </div>}
            {filtered.length>0&&<div style={{background:'#fff',borderRadius:18,overflow:'hidden',border:'1px solid #f0f0f0'}}>
              {filtered.map((f,i)=>(
                <div key={f.id} className="ri-h" onClick={()=>openFile(f)} style={{display:'flex',alignItems:'center',gap:isMobile?10:12,padding:isMobile?'14px 12px':'12px 14px',cursor:'pointer',borderBottom:i<filtered.length-1?'1px solid #f0f0f0':'none'}}>
                  <div style={{width:isMobile?38:42,height:isMobile?38:42,borderRadius:12,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:isMobile?16:18}}>📄</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:isMobile?13:14,fontWeight:600,color:'#1a1a1a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{trunc(f.name,isMobile?15:30)}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4,alignItems:'center'}}>
                      {f.visibility&&getVisLabel(f.visibility)&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:999,background:'#f0f0f0',color:'#6b6b80'}}>{getVisLabel(f.visibility)}</span>}
                      {(f.tags||[]).slice(0,3).map(t=>{const c=tagColor(t);return<span key={t} style={{fontSize:10,padding:'1px 6px',borderRadius:999,background:c.bg,color:c.text}}>#{t}</span>;})}
                    </div>
                    {f.info&&<div style={{fontSize:11,color:P.cream.deep,marginTop:4,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>ℹ️ {trunc(f.info,isMobile?40:60)}</div>}
                    {f.shareMessage&&<div style={{fontSize:11,color:'#1a7f37',marginTop:3,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💬 {trunc(f.shareMessage,isMobile?40:60)}</div>}
                  </div>
                  <button onClick={e=>{e.stopPropagation();setQrFile(f);}} style={{background:'none',border:'1px solid #e0e0e0',borderRadius:8,padding:'5px 7px',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}} title="QR Code">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b80" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                  </button>
                  {isMobile?<span style={{fontSize:13,color:P.cream.deep,fontWeight:700,flexShrink:0}}>→</span>
                    :<button style={{background:'transparent',border:'1.5px solid '+P.cream.deep,borderRadius:10,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',color:P.cream.deep}}>Άνοιγμα →</button>}
                </div>
              ))}
            </div>}
            {files.length===0&&<div style={{textAlign:'center',padding:60}}><div style={{fontSize:48,marginBottom:16}}>📭</div><div style={{fontSize:15,color:'#6b6b80'}}>Δεν έχεις δημοσιεύσει υλικό ακόμη.</div></div>}
          </>}
        </div>
      </div>
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
      {isMobile&&<nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <MobBtn icon={Ic.book} label="Βιβλιοθήκη" active onClick={()=>{goHome();loadData();}}/>
        <MobBtn icon={Ic.live} label="Live" onClick={()=>openExternal('/live')}/>
        {hasSession
          ? <MobBtn icon={Ic.out} label="Επιστροφή" onClick={goBack}/>
          : <MobBtn icon={Ic.login} label="Σύνδεση" onClick={()=>window.location.href='/login'}/>
        }
      </nav>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════ */
function StudentSidebar({open,setOpen,goHome,isMobile,myEmail,openPublic,openNetwork,activePublic,activeNetwork,dashBadge}){
  return(
    <div style={{...S.sidebar,width:open?220:56}}>
      <div style={S.sidebarHeader}>{open&&<span style={{fontSize:15,fontWeight:500,color:'#ececec'}}>ΛΕΒΙΑΘΑΝ</span>}<button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open?'◀':'▶'}</button></div>
      <nav style={S.nav}>
        <button onClick={goHome} style={{...S.navItem,...((activePublic||activeNetwork)?{}:S.navActive),position:'relative'}}><span style={S.navIcon}>{Ic.dashboard}</span>{open&&'Πίνακας ελέγχου'}{dashBadge>0&&<span style={{ position:'absolute', top:6, ...(open?{right:10}:{left:26}), background:'#dc2626', color:'#fff', borderRadius:999, minWidth:16, height:16, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{dashBadge}</span>}</button>
        <div style={S.navDiv}/>
        <button onClick={()=>openExternal('/live')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{open&&'Live session'}</button>
        <div style={S.navDiv}/>
        <button onClick={openPublic?openPublic:()=>window.open('/s/smitselos','_blank')} style={{...S.navItem,...(activePublic?S.navActive:{})}}><span style={S.navIcon}>{Ic.globe}</span>{open&&'Ανοιχτή πρόσβαση'}</button>
        <div style={S.navDiv}/>
        <button onClick={openNetwork?openNetwork:()=>{window.location.href='/network';}} style={{...S.navItem,...(activeNetwork?S.navActive:{})}}><span style={S.navIcon}>{Ic.net}</span>{open&&'Δίκτυο'}</button>
      </nav>
      <div style={S.sidebarFooter}>
        <div style={S.userCard}>
          <div style={{...S.userAvatar,background:'#b8d4e3'}}>{Ic.user}</div>
          {open&&<div style={{flex:1}}><div style={{fontSize:12,color:'#ececec'}}>Μαθητής</div><div style={{fontSize:10,color:'#8e8ea0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{myEmail}</div></div>}
        </div>
        <button onClick={()=>signOut({callbackUrl:'/login'})} style={{...S.navItem,marginTop:4,color:'#dc4a4a'}}>
          <span style={S.navIcon}>{Ic.out}</span>{open&&'Αποσύνδεση'}
        </button>
      </div>
    </div>
  );
}

function TeacherSidebar({open,setOpen,goHome,goBack,hasSession}){
  return(
    <div style={{...S.sidebar,width:open?220:56}}>
      <div style={S.sidebarHeader}>{open&&<span style={{fontSize:15,fontWeight:500,color:'#ececec'}}>ΛΕΒΙΑΘΑΝ</span>}<button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open?'◀':'▶'}</button></div>
      <nav style={S.nav}>
        <button onClick={goHome} style={{...S.navItem,...S.navActive}}><span style={S.navIcon}>{Ic.book}</span>{open&&'Βιβλιοθήκη'}</button>
        <div style={S.navDiv}/>
        <button onClick={()=>openExternal('/live')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{open&&'Live'}</button>
        <div style={S.navDiv}/>
        {hasSession
          ? <button onClick={goBack} style={S.navItem}><span style={S.navIcon}>{Ic.out}</span>{open&&'Επιστροφή'}</button>
          : <button onClick={()=>window.location.href='/login'} style={S.navItem}><span style={S.navIcon}>{Ic.login}</span>{open&&'Σύνδεση'}</button>
        }
      </nav>
      <div style={S.sidebarFooter}><div style={S.userCard}><div style={{...S.userAvatar,background:'#b8d4e3'}}>{Ic.user}</div>{open&&<div style={{fontSize:12,color:'#ececec'}}>{hasSession?'Εκπαιδευτικός':'Επισκέπτης'}</div>}</div></div>
    </div>
  );
}

function MobBtn({icon,label,active,disabled,onClick,badge}){
  return(<button onClick={disabled?undefined:onClick} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'transparent',border:'none',color:active?'#ececec':'#8e8ea0',fontSize:10,cursor:disabled?'default':'pointer',padding:'4px 8px',opacity:disabled?0.35:1,position:'relative'}}>
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
