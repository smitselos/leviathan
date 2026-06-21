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

const Ic={
  home:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  live:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  out:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  book:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  login:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
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
    const url=isHtml
      ?`/api/student-file?id=${f.id}`
      :`https://drive.google.com/file/d/${f.id}/preview`;
    window.open(url,'_blank');
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
            <button onClick={()=>window.open('/live','_blank')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{sidebarOpen&&'Live'}</button>
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
          <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')}/>
          <MobBtn icon={Ic.login} label="Σύνδεση" onClick={()=>window.location.href='/login'}/>
        </nav>
      )}
    </div>
  );
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

  const myName=myEmail;

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

      // Seen IDs
      setSeenIds(prev => {
        const merged = new Set(dReg.seenFiles || []);
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

  const unseenCount=useMemo(()=>incoming.filter(f=>!seenIds.has(f.id)).length,[incoming,seenIds]);

  const markSeen=async(fileId)=>{
    if(seenIds.has(fileId))return;
    const next=new Set(seenIds);next.add(fileId);setSeenIds(next);
    try{await fetch('/api/registry',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({seenFiles:[...next]})});}catch{}
  };

  const openFile=(f)=>{
    markSeen(f.id);
    const isHtml=/\.html?$/i.test(f.name);
    const isOffice=/\.(docx?|pptx?|xlsx?)$/i.test(f.name);
    let url;
    if(isHtml) url=`/api/student-file?id=${f.id}`;
    else if(isOffice) url=`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin+'/api/doc-proxy?id='+f.id)}`;
    else url=`https://drive.google.com/file/d/${f.id}/preview`;
    if(isMobile){window.open(url,'_blank');return;}
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
    try{await fetch('/api/network',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const r=await fetch('/api/network');setNetwork(await r.json());}catch{}
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

  // Desktop viewer
  if(viewing&&!isMobile){
    const url=viewing.previewUrl||`https://drive.google.com/file/d/${viewing.id}/preview`;
    return(
      <div style={S.app}><Head><title>{viewing.name}</title></Head><style>{css}</style>
        {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>setViewing(null)} isMobile={isMobile} myEmail={myEmail}/>}
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
      {!isMobile&&<StudentSidebar open={sidebarOpen} setOpen={setSidebarOpen} goHome={()=>setViewing(null)} isMobile={isMobile} myEmail={myEmail}/>}
      <div className="student-main" style={{...S.main,marginLeft:!isMobile?(sidebarOpen?220:56):0}}>
        {isMobile&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 16px',borderBottom:'1px solid #eee',background:'#fff'}}><span style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>ΛΕΒΙΑΘΑΝ</span></div>}

        <div style={S.container}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:20,fontWeight:600,color:'#1a1a1a',marginBottom:4}}>Καλώς ήρθες 📚</h1>
            <p style={{fontSize:13,color:'#6b6b80',margin:0}}>{myEmail}</p>
          </div>

          {loading&&<div style={S.empty}>Φόρτωση…</div>}

          {!loading&&(
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>

              {/* ══ ΑΡΙΣΤΕΡΗ ΣΤΗΛΗ ══ */}
              <div style={{flex:'1 1 340px',minWidth:0}}>

                {/* Πρόσκληση / Αποδοχή */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #ebebeb',padding:'14px 16px',marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>📧 Σύνδεση με εκπαιδευτικό</div>
                  <div style={{display:'flex',gap:8}}>
                    <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@example.com"
                      style={{flex:1,padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box'}}/>
                    <button onClick={sendInvite} disabled={netLoading||!inviteEmail.trim()}
                      style={{padding:'10px 16px',borderRadius:10,border:'none',background:P.cream.deep,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',opacity:netLoading?0.5:1}}>Αποστολή</button>
                  </div>
                  {(network.received||[]).length>0&&(
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:12,fontWeight:600,color:'#dc2626',marginBottom:6}}>🔔 Εκκρεμείς προσκλήσεις</div>
                      {network.received.map(inv=>(
                        <div key={inv.email} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:'1px solid #f0f0f0'}}>
                          <span style={{flex:1,fontSize:12,color:'#6b6b80'}}>{inv.name||inv.email}</span>
                          <button onClick={()=>acceptInvite(inv.email)} style={{padding:'5px 12px',borderRadius:8,border:'none',background:'#16a34a',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}>Αποδοχή</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(network.connections||[]).length>0&&(
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:11,color:'#aeaeb8',marginBottom:4}}>Συνδέσεις:</div>
                      {network.connections.map(c=>(
                        <div key={c.email} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                          <span style={{flex:1,fontSize:12,color:'#1a1a1a'}}>{c.name||c.email}</span>
                          <button onClick={()=>disconnectUser(c.email)} style={{background:'none',border:'none',color:'#aeaeb8',cursor:'pointer',fontSize:11,padding:'2px 6px'}}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Εισερχόμενα */}
                <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  📥 Εισερχόμενα {unseenCount>0&&<span style={S.badge}>{unseenCount}</span>}
                </div>
                {incoming.length===0&&<div style={S.emptyCol}>Δεν υπάρχουν εισερχόμενα ακόμη.</div>}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {incoming.map(f=>{
                    const isNew=!seenIds.has(f.id);
                    const isExp=expandedIn===(f.id+f.fromEmail);
                    return(
                      <div key={f.id+f.fromEmail} style={{background:isNew?'#fff9ed':'#fff',border:isNew?'1.5px solid '+P.cream.accent:'1px solid #ebebeb',borderRadius:14,overflow:'hidden',transition:'all 0.15s ease'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpandedIn(isExp?null:f.id+f.fromEmail)}>
                          <div style={{width:34,height:34,borderRadius:10,background:P.cream.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trunc(f.name,20)}</div>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                              {(()=>{const tc=teacherColor(f.fromEmail);return <span style={{fontSize:10,fontWeight:600,padding:'1px 8px',borderRadius:999,background:tc.bg,color:tc.text,whiteSpace:'nowrap'}}>📚 {trunc(f.fromName,20)}</span>;})()}
                            </div>
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
                              <button onClick={()=>saveToMyDrive(f)} disabled={savingId===f.id} style={{...S.miniBtn,opacity:savingId===f.id?0.4:1}} title="Αποθήκευση στο Drive">💾</button>
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
              </div>

              {/* ══ ΔΕΞΙΑ ΣΤΗΛΗ ══ */}
              <div style={{flex:'1 1 340px',minWidth:0}}>

                {/* Upload / Αποστολή */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #ebebeb',padding:'14px 16px',marginBottom:16,textAlign:'center'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>📤 Ανέβασμα & Αποστολή</div>
                  <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:12,background:P.peach.bg,color:P.peach.deep,fontSize:13,fontWeight:600,cursor:uploading?'wait':'pointer',opacity:uploading?0.5:1,border:'1.5px solid '+P.peach.accent}}>
                    {uploading?'Αποστολή…':'Επιλογή αρχείου'}
                    <input type="file" style={{display:'none'}} onChange={handleFileSelect} disabled={uploading}/>
                  </label>
                  <p style={{fontSize:11,color:'#aeaeb8',marginTop:8}}>Φωτογραφία, PDF, DOCX — στέλνεται στις συνδέσεις σου</p>
                </div>

                {/* Αποστολές μου */}
                <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:10}}>📤 Αποστολές μου</div>
                {sentFiles.length===0&&<div style={S.emptyCol}>Δεν έχεις στείλει κάτι ακόμη.</div>}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {sentFiles.map(f=>(
                    <div key={f.id} style={{background:'#fff',border:'1px solid #ebebeb',borderRadius:14,padding:'11px 14px',display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:10,background:P.peach.bgSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📄</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trunc(f.name,20)}</div>
                        <div style={{fontSize:11,color:'#8a8a9a',marginTop:1}}>{f.sentAt?new Date(f.sentAt).toLocaleDateString('el-GR'):''}</div>
                      </div>
                      <button onClick={()=>setQrFile(f)} style={S.miniBtn} title="QR Code">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
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
          <MobBtn icon={Ic.home} label="Αρχική" active onClick={()=>setViewing(null)}/>
          <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')}/>
          <MobBtn icon={Ic.book} label="Βιβλιοθήκη" onClick={()=>window.open('/s/smitselos','_blank')}/>
          <MobBtn icon={Ic.out} label="Αποσύνδεση" onClick={()=>signOut({callbackUrl:'/login'})}/>
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
    const url=isHtml?`/api/student-file?id=${f.id}`:`https://drive.google.com/file/d/${f.id}/preview`;
    if(isMobile){window.open(url,'_blank');return;}
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
        <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')}/>
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
function StudentSidebar({open,setOpen,goHome,isMobile,myEmail}){
  return(
    <div style={{...S.sidebar,width:open?220:56}}>
      <div style={S.sidebarHeader}>{open&&<span style={{fontSize:15,fontWeight:500,color:'#ececec'}}>ΛΕΒΙΑΘΑΝ</span>}<button onClick={()=>setOpen(p=>!p)} style={S.collapseBtn}>{open?'◀':'▶'}</button></div>
      <nav style={S.nav}>
        <button onClick={goHome} style={{...S.navItem,...S.navActive}}><span style={S.navIcon}>{Ic.home}</span>{open&&'Αρχική'}</button>
        <div style={S.navDiv}/>
        <button onClick={()=>window.open('/live','_blank')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{open&&'Live'}</button>
        <div style={S.navDiv}/>
        <button onClick={()=>window.open('/s/smitselos','_blank')} style={S.navItem}><span style={S.navIcon}>{Ic.book}</span>{open&&'Βιβλιοθήκη'}</button>
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
        <button onClick={()=>window.open('/live','_blank')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{open&&'Live'}</button>
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
  badge:{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,borderRadius:9,background:'#f59e0b',color:'#fff',fontSize:10,fontWeight:700,padding:'0 5px'},
  badgeStyle:{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:16,height:16,borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:9,fontWeight:700,padding:'0 4px'},
};

// Η σελίδα πρέπει να φορτώνει ΧΩΡΙΣ auth (δημόσια πρόσβαση)
export async function getServerSideProps(ctx) {
  return { props: { teacher: ctx.query.teacher || null } };
}
