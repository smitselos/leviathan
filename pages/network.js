// pages/network.js — Σελίδα «Δίκτυο» μαθητή: διαχείριση συνδέσεων & ομάδων
import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const P = {
  cream: { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach: { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
};
const TAG_COLORS=[{bg:'#ede9fe',text:'#6d28d9'},{bg:'#dcfce7',text:'#15803d'},{bg:'#fef3c7',text:'#b45309'},{bg:'#dbeafe',text:'#1d4ed8'},{bg:'#fce7f3',text:'#9d174d'},{bg:'#e0f2fe',text:'#0369a1'},{bg:'#f3f4f6',text:'#374151'}];
const teacherColor=(email)=>TAG_COLORS[Math.abs([...(email||'')].reduce((a,c)=>a+c.charCodeAt(0),0))%TAG_COLORS.length];
const trunc=(s,n)=>s&&s.length>n?s.slice(0,n)+'…':s;

const Ic={
  dashboard:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  live:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M7.76 16.24a6 6 0 010-8.49"/><path d="M4.93 19.07a10 10 0 010-14.14"/></svg>,
  globe:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  out:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  net:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><line x1="12" y1="7.4" x2="5.8" y2="16.8"/><line x1="12" y1="7.4" x2="18.2" y2="16.8"/><line x1="7" y1="19" x2="17" y2="19"/></svg>,
};

export default function NetworkPage(){
  const router=useRouter();
  const {data:session,status}=useSession();
  const hasSession=!!session?.accessToken;
  const myEmail=session?.user?.email||null;

  const [isMobile,setIsMobile]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [network,setNetwork]=useState({connections:[],received:[],sent:[]});
  const [inviteEmail,setInviteEmail]=useState('');
  const [netLoading,setNetLoading]=useState(false);
  const [contacts,setContacts]=useState({});
  const [editEmail,setEditEmail]=useState(null);
  const [draft,setDraft]=useState({});
  const [groups,setGroups]=useState([]);
  const [showNewGroup,setShowNewGroup]=useState(false);
  const [newGroupName,setNewGroupName]=useState('');
  const [newGroupMembers,setNewGroupMembers]=useState([]);

  useEffect(()=>{const c=()=>setIsMobile(window.innerWidth<768);c();window.addEventListener('resize',c);return()=>window.removeEventListener('resize',c);},[]);
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status,router]);

  // ── Ομάδες (server· συγχρονισμός σε όλες τις συσκευές) ──
  const loadGroups=useCallback(async()=>{ try{ const r=await fetch('/api/student-groups'); const d=await r.json(); setGroups(Array.isArray(d.groups)?d.groups:[]); }catch{ setGroups([]); } },[]);
  const saveGroups=async(g)=>{
    setGroups(g);
    try{ await fetch('/api/student-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groups:g})}); }catch{}
  };

  const loadNetwork=useCallback(async()=>{ try{ const r=await fetch('/api/network'); setNetwork(await r.json()); }catch{} },[]);
  const loadContacts=useCallback(async()=>{ try{ const r=await fetch('/api/contact-info'); const d=await r.json(); setContacts(d.contacts||{}); }catch{} },[]);
  useEffect(()=>{ if(hasSession){ loadNetwork(); loadContacts(); loadGroups(); } },[hasSession,loadNetwork,loadContacts,loadGroups]);

  // ── Πρόσκληση / Αποδοχή / Αποσύνδεση ──
  const sendInvite=async()=>{
    if(!inviteEmail.trim())return; setNetLoading(true);
    try{ await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toEmail:inviteEmail.trim()})}); setInviteEmail(''); await loadNetwork(); }catch{}
    setNetLoading(false);
  };
  const acceptInvite=async(email)=>{
    setNetLoading(true);
    try{ await fetch('/api/network',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromEmail:email,action:'accept'})}); await loadNetwork(); }catch{}
    setNetLoading(false);
  };
  const disconnectUser=async(email)=>{
    if(!confirm(`Αποσύνδεση από ${email};`))return;
    try{ await fetch('/api/network',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); await loadNetwork();
      await saveGroups(groups.map(g=>({...g,members:(g.members||[]).filter(e=>e!==email)})));
    }catch{}
  };

  // ── Στοιχεία επικοινωνίας ──
  const openEdit=(email)=>{
    const e=contacts[email]||{};
    const conn=(network.connections||[]).find(c=>c.email===email);
    setDraft({ firstName:e.firstName||'', lastName:e.lastName||(conn?.name&&!conn.name.includes('@')?conn.name:''), email, school:e.school||'', roleTitle:e.roleTitle||'', phone:e.phone||'', note:e.note||'' });
    setEditEmail(email);
  };
  const saveContact=async()=>{
    const email=editEmail; if(!email)return;
    setContacts(p=>({...p,[email]:{...draft}}));
    try{ await fetch('/api/contact-info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,info:draft})}); }catch{}
    setEditEmail(null);
  };

  // ── Ομάδες: δημιουργία / διαγραφή ──
  const toggleMember=(email)=>setNewGroupMembers(p=>p.includes(email)?p.filter(e=>e!==email):[...p,email]);
  const createGroup=async()=>{
    if(!newGroupName.trim()||newGroupMembers.length===0)return;
    await saveGroups([{id:Date.now().toString(),name:newGroupName.trim(),members:newGroupMembers},...groups]);
    setNewGroupName(''); setNewGroupMembers([]); setShowNewGroup(false);
  };
  const deleteGroup=async(id)=>{ if(!confirm('Διαγραφή ομάδας;'))return; await saveGroups(groups.filter(g=>g.id!==id)); };

  if(status==='loading') return <div style={S.page}><div style={{color:'#6b6b80',fontSize:14}}>Φόρτωση…</div></div>;
  if(status==='unauthenticated') return <div style={S.page}><div style={{color:'#6b6b80',fontSize:14}}>Απαιτείται σύνδεση.</div></div>;

  const conns=network.connections||[];
  const received=network.received||[];
  const contactLine=(email)=>{
    const c=contacts[email]; if(!c)return null;
    const parts=[c.roleTitle,c.school,c.phone].filter(Boolean);
    return parts.length?parts.join(' · '):null;
  };

  return(
    <div style={S.app}><Head><title>Δίκτυο — ΛΕΒΙΑΘΑΝ</title></Head><style>{css}</style>

      {!isMobile&&(
        <div style={{...S.sidebar,width:sidebarOpen?220:56}}>
          <div style={S.sidebarHeader}>{sidebarOpen&&<span style={{fontSize:15,fontWeight:500,color:'#ececec'}}>ΛΕΒΙΑΘΑΝ</span>}<button onClick={()=>setSidebarOpen(p=>!p)} style={S.collapseBtn}>{sidebarOpen?'◀':'▶'}</button></div>
          <nav style={S.nav}>
            <button onClick={()=>{window.location.href='/student';}} style={S.navItem}><span style={S.navIcon}>{Ic.dashboard}</span>{sidebarOpen&&'Πίνακας ελέγχου'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>window.open('/live','_blank')} style={S.navItem}><span style={S.navIcon}>{Ic.live}</span>{sidebarOpen&&'Live session'}</button>
            <div style={S.navDiv}/>
            <button onClick={()=>{window.location.href='/student?view=public';}} style={S.navItem}><span style={S.navIcon}>{Ic.globe}</span>{sidebarOpen&&'Ανοιχτή πρόσβαση'}</button>
            <div style={S.navDiv}/>
            <button style={{...S.navItem,...S.navActive}}><span style={S.navIcon}>{Ic.net}</span>{sidebarOpen&&'Δίκτυο'}</button>
          </nav>
          <div style={S.sidebarFooter}>
            <div style={S.userCard}>
              <div style={{...S.userAvatar,background:'#b8d4e3'}}>{Ic.user}</div>
              {sidebarOpen&&<div style={{flex:1}}><div style={{fontSize:12,color:'#ececec'}}>Μαθητής</div><div style={{fontSize:10,color:'#8e8ea0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{myEmail}</div></div>}
            </div>
            <button onClick={()=>signOut({callbackUrl:'/login'})} style={{...S.navItem,marginTop:4,color:'#dc4a4a'}}><span style={S.navIcon}>{Ic.out}</span>{sidebarOpen&&'Αποσύνδεση'}</button>
          </div>
        </div>
      )}

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
            <button onClick={()=>{setShowNewGroup(v=>!v);setNewGroupName('');setNewGroupMembers([]);}} disabled={conns.length===0}
              style={{marginLeft:'auto',padding:'6px 14px',borderRadius:10,border:'1.5px solid '+P.peach.accent,background:P.peach.bgSoft,color:P.peach.deep,fontSize:12,fontWeight:600,cursor:conns.length===0?'default':'pointer',opacity:conns.length===0?0.5:1}}>+ Νέα ομάδα</button>
          </div>

          {showNewGroup&&(
            <div style={{background:'#fff',borderRadius:14,border:'1px solid '+P.peach.accent,padding:'14px 16px',marginBottom:16,maxWidth:560}}>
              <input autoFocus value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Όνομα ομάδας…"
                style={{width:'100%',padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box',marginBottom:10}}/>
              <div style={{fontSize:11,fontWeight:700,color:'#aeaeb8',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Μέλη {newGroupMembers.length>0&&`(${newGroupMembers.length})`}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
                {conns.map(c=>{
                  const sel=newGroupMembers.includes(c.email);
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
                        <button onClick={()=>openEdit(c.email)} style={{flex:1,padding:'7px 10px',borderRadius:9,border:'1px solid '+P.cream.accent,background:P.cream.bgSoft,color:P.cream.deep,fontSize:12,fontWeight:600,cursor:'pointer'}}>✎ Πληροφορίες</button>
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
                <input value={draft[k]||''} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box'}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#aeaeb8',marginBottom:4}}>Σημείωση</div>
              <textarea value={draft.note||''} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} rows={3}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e0e0e0',borderRadius:10,fontSize:isMobile?16:13,background:'#fff',boxSizing:'border-box',resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setEditEmail(null)} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #e0e0e0',background:'#fff',fontSize:13,cursor:'pointer',color:'#6b6b80'}}>Ακύρωση</button>
              <button onClick={saveContact} style={{flex:1,padding:'10px',borderRadius:10,border:'none',background:P.cream.deep,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>Αποθήκευση</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile&&(
        <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'8px 0 max(8px,env(safe-area-inset-bottom))',zIndex:300,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <MobBtn icon={Ic.dashboard} label="Πίνακας" onClick={()=>{window.location.href='/student';}}/>
          <MobBtn icon={Ic.live} label="Live" onClick={()=>window.open('/live','_blank')}/>
          <MobBtn icon={Ic.net} label="Δίκτυο" active onClick={()=>{}}/>
          <MobBtn icon={Ic.globe} label="Πρόσβαση" onClick={()=>{window.location.href='/student?view=public';}}/>
          <MobBtn icon={Ic.out} label="Έξοδος" onClick={()=>signOut({callbackUrl:'/login'})}/>
        </nav>
      )}
    </div>
  );
}

function MobBtn({icon,label,active,onClick}){
  return(<button onClick={onClick} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'transparent',border:'none',color:active?'#ececec':'#8e8ea0',fontSize:10,cursor:'pointer',padding:'4px 8px'}}>{icon}<span>{label}</span></button>);
}

const css=`*{box-sizing:border-box;}html,body{margin:0;padding:0;}@media(max-width:767px){.student-main{padding-bottom:70px !important;margin-left:0 !important;max-width:100vw !important;overflow-x:hidden !important;}html,body{overflow-x:hidden !important;max-width:100vw !important;}}`;

const S={
  page:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f0e1',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},
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
  emptyCol:{textAlign:'center',color:'#aeaeb8',padding:32,fontSize:13,background:'#fff',borderRadius:14,border:'1px dashed #e0e0e0'},
};

export async function getServerSideProps(){ return { props:{} }; }
