// pages/viewer/[id].js
import React from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function ViewerPage() {
  var ref = useSession();
  var session = ref.data;
  var status = ref.status;
  var router = useRouter();
  var id = router.query.id;
  var _fm = useState(null);
  var fileMeta = _fm[0];
  var setFileMeta = _fm[1];

  useEffect(function() {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(function() {
    if (!id || !session) return;
    fetch('/api/registry')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var all = [].concat(
          (data.folders || []).reduce(function(acc, f) {
            return acc.concat((f.files || []).map(function(fi) { return Object.assign({}, fi, { folderId: f.id }); }));
          }, []),
          data.apps || []
        );
        var found = all.find(function(f) { return f.id === id; });
        setFileMeta(found || { id: id, name: 'Αρχείο' });
      })
      .catch(function() { setFileMeta({ id: id, name: 'Αρχείο' }); });
  }, [id, session]);

  if (status === 'loading' || !id) {
    return React.createElement('div', {
      style: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888', fontSize:14 }
    }, 'Φόρτωση…');
  }
  if (!session) return null;

  var name = (fileMeta && fileMeta.name) || 'Αρχείο';
  var tags = (fileMeta && fileMeta.tags) || [];
  var mime = (fileMeta && fileMeta.mimeType) || '';
  var fname = name.toLowerCase();

  // Google Drive preview URLs — mobile-optimized, με zoom + pagination
  var previewUrl;
  if (mime === 'application/vnd.google-apps.document') {
    previewUrl = 'https://docs.google.com/document/d/' + id + '/preview';
  } else if (mime === 'application/vnd.google-apps.presentation') {
    previewUrl = 'https://docs.google.com/presentation/d/' + id + '/preview';
  } else if (mime === 'application/vnd.google-apps.spreadsheet') {
    previewUrl = 'https://docs.google.com/spreadsheets/d/' + id + '/preview';
  } else {
    // PDF, DOCX, images κ.λπ. — ο Drive previewer τα χειρίζεται όλα
    previewUrl = 'https://drive.google.com/file/d/' + id + '/preview';
  }

  var abtn = {
    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    background:'none', border:'none', padding:'8px 10px',
    color:'#c97b5a', fontSize:10, fontWeight:500, minWidth:48,
    borderRadius:10, opacity:0.30,
  };
  var ibtn = {
    background:'#f4f4f4', color:'#444', border:'1px solid #e0e0e0',
    width:30, height:30, borderRadius:8, fontSize:14,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', overflow:'hidden' }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <title>{name}</title>
      </Head>

      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid #ebebeb', background:'#fff', flexShrink:0 }}>
        <button onClick={function() { window.close(); }} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#444', padding:'2px 6px', flexShrink:0 }}>{'←'}</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
          {tags.length > 0 && (
            <div style={{ display:'flex', gap:4, marginTop:2 }}>
              {tags.slice(0,3).map(function(t) { return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:999, background:'#ede9fe', color:'#6d28d9' }}>{'#'}{t}</span>; })}
            </div>
          )}
        </div>
        <button onClick={function() { window.open(previewUrl, '_blank'); }} style={ibtn} title="Νέα καρτέλα">{'↗'}</button>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'3px 2px', borderBottom:'1px solid #f0f0f0', background:'#fcf9f0', flexShrink:0 }}>
        <button style={abtn} disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <span>Student</span>
        </button>
        <button style={abtn} disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>
          <span>Live</span>
        </button>
        <button style={abtn} disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <span>{'Σχόλια'}</span>
        </button>
        <button style={abtn} disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          <span>{'Σύνδεση'}</span>
        </button>
        <button style={abtn} disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>{'Επεξεργασία'}</span>
        </button>
      </div>

      <iframe
        src={previewUrl}
        style={{ flex:1, border:'none', width:'100%' }}
        title={name}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
