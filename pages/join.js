// pages/join.js — Ενοποιημένη σελίδα ΕΙΣΟΔΟΥ μαθητή για τα ζωντανά κανάλια.
// /join?type=poll|cloud|text&code=XXXX
// Ο μαθητής φτάνει εδώ με σκανάρισμα QR (ή σύνδεσμο). Φορτώνει το κοινό
// /reporter.js και στέλνει με ΜΙΑ γραμμή ανά ενέργεια.
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';

const C = {
  bg: '#faf7ef', card: '#ffffff', ink: '#2d2a1e', muted: '#8a8574',
  accent: '#a68a2e', accentD: '#7a6420', ok: '#15803d', line: '#ece7d8', bar: '#e9e0c8',
};

const LABEL = {
  poll: 'Ψηφοφορία', cloud: 'Νέφος λέξεων', text: 'Σύντομη απάντηση',
};

export default function JoinPage() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [code, setCode] = useState('');
  const [meta, setMeta] = useState(null);   // { question/prompt, options }
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false); // reporter φορτώθηκε
  const [value, setValue] = useState('');
  const [chosen, setChosen] = useState(null); // poll: επιλεγμένο optionId
  const [sent, setSent] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (router.query.type) setType(String(router.query.type));
    if (router.query.code) setCode(String(router.query.code));
  }, [router.query.type, router.query.code]);

  const api = type ? `/api/live-${type}` : null;

  const fetchMeta = useCallback(async () => {
    if (!api || !code) return;
    try {
      const r = await fetch(`${api}?code=${code}`);
      if (r.status === 404) { setError('Δεν υπάρχει ενεργή δραστηριότητα με αυτόν τον κωδικό.'); return; }
      const j = await r.json();
      setMeta(j.data); setError(null);
    } catch (e) {}
  }, [api, code]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  function toast(msg) { setFlash(msg); setTimeout(() => setFlash(''), 1800); }

  function submitPoll(optionId) {
    if (!ready || chosen) return; // μία ψήφος: αφού ψηφίσει, κλειδώνει
    window.LeviathanReporter?.poll({ code, optionId });
    setChosen(optionId);
    toast('Η ψήφος καταχωρήθηκε');
  }

  function submitCloud() {
    if (!ready || !value.trim()) return;
    window.LeviathanReporter?.cloud({ code, text: value });
    setValue('');
    toast('Στάλθηκε ✓');
  }

  function submitText() {
    if (!ready || !value.trim()) return;
    window.LeviathanReporter?.text({ code, text: value });
    setValue(''); setSent(true);
    toast('Η απάντησή σου στάλθηκε ✓');
  }

  const prompt = meta?.question || meta?.prompt || '';

  /* ── Χωρίς type/code → μικρή φόρμα εισόδου κωδικού ── */
  if (!type || !code) {
    return (
      <div style={S.wrap}>
        <Head><title>Συμμετοχή — ΛΕΒΙΑΘΑΝ</title></Head>
        <div style={{ ...S.card, maxWidth: 360, textAlign: 'center' }}>
          <div style={S.brand}>ΛΕΒΙΑΘΑΝ</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '4px 0 14px' }}>Συμμετοχή</div>
          <input type="text" inputMode="numeric" maxLength={4} placeholder="κωδικός"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.length === 4) router.replace(`/join?type=${type || 'poll'}&code=${e.target.value}`); }}
            style={S.codeInput} />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Δώσε τον 4ψήφιο κωδικό</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <Head><title>{LABEL[type] || 'Συμμετοχή'} {code} — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{`*{box-sizing:border-box}html,body{margin:0;background:${C.bg}}`}</style>
      <Script src="/reporter.js" strategy="afterInteractive" onLoad={() => { window.LeviathanReporter?.init(); setReady(true); }} />

      <div style={{ ...S.card, maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={S.brand}>ΛΕΒΙΑΘΑΝ · {(LABEL[type] || '').toUpperCase()}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 15, color: C.accentD, letterSpacing: 1 }}>{code}</div>
        </div>

        {error && <div style={{ color: '#b91c1c', textAlign: 'center', padding: '18px 6px' }}>{error}</div>}
        {!error && !meta && <div style={{ color: C.muted, textAlign: 'center', padding: '18px 6px' }}>Φόρτωση…</div>}

        {!error && meta && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.4, margin: '10px 0 16px' }}>{prompt}</div>

            {/* ── POLL ── */}
            {type === 'poll' && (
              <div>
                {(meta.options || []).map((o) => {
                  const isSel = chosen === o.id;
                  const locked = !!chosen;
                  return (
                    <button key={o.id} onClick={() => submitPoll(o.id)} disabled={!ready || locked}
                      style={{ ...S.optionBtn, ...(isSel ? S.optionSel : {}),
                        opacity: !ready ? 0.5 : (locked && !isSel ? 0.4 : 1),
                        cursor: locked ? 'default' : 'pointer' }}>
                      {o.label}{isSel ? '  ✓' : ''}
                    </button>
                  );
                })}
                {chosen && <div style={{ fontSize: 12, color: C.ok, textAlign: 'center', marginTop: 8, fontWeight: 600 }}>Η ψήφος σου καταχωρήθηκε. Ευχαριστούμε!</div>}
              </div>
            )}

            {/* ── CLOUD ── */}
            {type === 'cloud' && (
              <div>
                <input type="text" value={value} maxLength={40} placeholder="μία λέξη ή σύντομη φράση"
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCloud(); }}
                  style={S.textInput} />
                <button onClick={submitCloud} disabled={!ready || !value.trim()} style={{ ...S.sendBtn, opacity: (ready && value.trim()) ? 1 : 0.5 }}>Προσθήκη →</button>
                <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 }}>Μπορείς να προσθέσεις όσες λέξεις θέλεις.</div>
              </div>
            )}

            {/* ── TEXT ── */}
            {type === 'text' && (
              <div>
                <textarea value={value} maxLength={280} rows={4} placeholder="Γράψε την απάντησή σου…"
                  onChange={(e) => setValue(e.target.value)} style={S.textarea} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{value.length}/280</span>
                  {sent && <span style={{ fontSize: 12, color: C.ok }}>Στάλθηκε ✓ — μπορείς να στείλεις κι άλλη</span>}
                </div>
                <button onClick={submitText} disabled={!ready || !value.trim()} style={{ ...S.sendBtn, opacity: (ready && value.trim()) ? 1 : 0.5 }}>Υποβολή →</button>
              </div>
            )}
          </>
        )}
      </div>

      {flash && <div style={S.flash}>{flash}</div>}
    </div>
  );
}

const S = {
  wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' },
  brand: { fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: 700, textTransform: 'uppercase' },
  card: { background: C.card, borderRadius: 18, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: `1px solid ${C.line}` },
  codeInput: { width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 8, padding: '12px 0', border: `2px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: 'monospace' },
  optionBtn: { width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10, borderRadius: 12, border: `2px solid ${C.line}`, background: '#fff', color: C.ink, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  optionSel: { borderColor: C.accent, background: '#fbf7ea', color: C.accentD },
  textInput: { width: '100%', padding: '13px 15px', border: `2px solid ${C.line}`, borderRadius: 12, fontSize: 16, outline: 'none' },
  textarea: { width: '100%', padding: '12px 14px', border: `2px solid ${C.line}`, borderRadius: 12, fontSize: 16, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 },
  sendBtn: { width: '100%', marginTop: 10, padding: '13px', border: 'none', borderRadius: 12, background: C.accent, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  flash: { position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: C.ink, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' },
};
