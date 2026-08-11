// pages/text-view.js — Ζωντανή συλλογή σύντομου γραπτού λόγου. /text-view?code=XXXX
// Ο εκπαιδευτικός ανοίγει με &host=1 → εμφανίζονται κουμπιά «καρφίτσωμα».
// (Το καρφίτσωμα περνά από PATCH που απαιτεί σύνδεση + κατοχή του κωδικού.)
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = { bg: '#faf7ef', card: '#ffffff', ink: '#2d2a1e', muted: '#8a8574', accent: '#a68a2e', accentD: '#7a6420', line: '#ece7d8', bar: '#e9e0c8', pin: '#fbf7ea' };

export default function TextView() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [host, setHost] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [onlyPinned, setOnlyPinned] = useState(false);

  useEffect(() => {
    if (router.query.code) setCode(String(router.query.code));
    setHost(!!router.query.host);
  }, [router.query.code, router.query.host]);

  const fetchData = useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/live-text?code=${code}`);
      if (r.status === 404) { setError('Δεν υπάρχει ενεργή συλλογή με αυτόν τον κωδικό.'); return; }
      const j = await r.json(); setData(j.data); setError(null);
    } catch (e) {}
  }, [code]);

  useEffect(() => { if (!code) return; fetchData(); const iv = setInterval(fetchData, 3000); return () => clearInterval(iv); }, [code, fetchData]);

  async function togglePin(id, pinned) {
    // Άμεση (optimistic) ενημέρωση επιτόπου — χωρίς αναδιάταξη, χωρίς αναμονή polling.
    setData((prev) => prev ? { ...prev, items: prev.items.map((it) => it.id === id ? { ...it, pinned } : it) } : prev);
    try {
      await fetch('/api/live-text', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, id, pinned }) });
      fetchData();
    } catch (e) { fetchData(); }
  }

  if (!code) return <CodeGate router={router} to="text-view" title="Σύντομες απαντήσεις" />;

  let items = data ? data.items.slice() : [];
  // Σταθερή σειρά καταχώρισης (παλαιότερες → νεότερες): οι γραμμές ΔΕΝ αναδιατάσσονται
  // όταν καρφιτσώνεις ή όταν φτάνει νέα απάντηση. Το αστέρι μπαίνει επιτόπου, πάνω σε
  // αυτό ακριβώς που πάτησες. Για συγκεντρωμένη προβολή, χρησιμοποίησε «Μόνο καρφιτσωμένες».
  items.sort((a, b) => a.ts - b.ts);
  if (onlyPinned) items = items.filter((it) => it.pinned);
  const nPinned = data ? data.items.filter((i) => i.pinned).length : 0;

  return (
    <div style={S.wrap}>
      <Head><title>Σύντομες απαντήσεις {code} — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{`*{box-sizing:border-box}html,body{margin:0;background:${C.bg}}`}</style>

      <div style={S.header}>
        <div><div style={S.brand}>ΛΕΒΙΑΘΑΝ · ΣΥΝΤΟΜΟΣ ΛΟΓΟΣ</div><div style={{ fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{data?.prompt || '—'}</div></div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 14 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: C.accentD, letterSpacing: 2 }}>{code}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{data?.count || 0} υποβολές{nPinned ? ` · ${nPinned} καρφιτσωμένες` : ''}</div>
        </div>
      </div>

      {(nPinned > 0 || onlyPinned) && (
        <div style={S.toggleRow}>
          <button onClick={() => setOnlyPinned(false)} style={{ ...S.toggleBtn, ...(onlyPinned ? {} : S.toggleActive) }}>Όλες</button>
          <button onClick={() => setOnlyPinned(true)} style={{ ...S.toggleBtn, ...(onlyPinned ? S.toggleActive : {}) }}>Μόνο καρφιτσωμένες</button>
        </div>
      )}

      {error && <div style={{ ...S.card, color: '#b91c1c', textAlign: 'center' }}>{error}</div>}
      {!error && !data && <div style={{ ...S.card, textAlign: 'center', color: C.muted }}>Φόρτωση…</div>}

      {!error && data && (
        <div>
          {items.length === 0 && <div style={{ ...S.card }}><div style={S.empty}>Αναμονή για τις πρώτες απαντήσεις…</div></div>}
          {items.map((it) => (
            <div key={it.id} style={{ ...S.card, background: it.pinned ? C.pin : C.card, borderColor: it.pinned ? C.accent : C.line, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 16, color: C.ink, lineHeight: 1.5 }}>
                {it.pinned && <span style={{ fontSize: 11, color: C.accentD, fontWeight: 700, marginRight: 6 }}>★</span>}
                {it.text}
              </div>
              {host && (
                <button onClick={() => togglePin(it.id, !it.pinned)} title={it.pinned ? 'Ξεκαρφίτσωμα' : 'Καρφίτσωμα / προβολή'}
                  style={{ ...S.pinBtn, ...(it.pinned ? S.pinBtnOn : {}) }}>
                  {it.pinned ? '★' : '☆'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, padding: '8px 0 20px' }}>
        Ζωντανή ενημέρωση κάθε 3 δευτ.{data?.updatedAt ? ' · τελευταία: ' + new Date(data.updatedAt).toLocaleTimeString('el-GR') : ''}
      </div>
    </div>
  );
}

function CodeGate({ router, to, title }) {
  return (
    <div style={S.wrap}>
      <Head><title>{title} — ΛΕΒΙΑΘΑΝ</title></Head>
      <div style={{ ...S.card, maxWidth: 380, textAlign: 'center', margin: '40px auto' }}>
        <div style={S.brand}>ΛΕΒΙΑΘΑΝ</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '4px 0 14px' }}>{title}</div>
        <input type="text" inputMode="numeric" maxLength={4} placeholder="κωδικός"
          onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.length === 4) router.replace(`/${to}?code=${e.target.value}`); }}
          style={S.codeInput} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Δώσε τον 4ψήφιο κωδικό</div>
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '16px 14px 24px', maxWidth: 760, margin: '0 auto' },
  brand: { fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: 700, textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.line}` },
  card: { background: C.card, borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${C.line}` },
  empty: { fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 10px' },
  toggleRow: { display: 'flex', gap: 6, marginBottom: 12, background: C.bar, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  toggleActive: { background: C.card, color: C.accentD, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  pinBtn: { flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: `2px solid ${C.line}`, background: '#fff', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 },
  pinBtnOn: { borderColor: C.accent, background: '#fff', color: C.accent },
  codeInput: { width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 8, padding: '12px 0', border: `2px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: 'monospace' },
};
