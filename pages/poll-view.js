// pages/poll-view.js — Ζωντανή προβολή ψηφοφορίας. /poll-view?code=XXXX
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = { bg: '#faf7ef', card: '#ffffff', ink: '#2d2a1e', muted: '#8a8574', accent: '#a68a2e', accentD: '#7a6420', line: '#ece7d8', bar: '#e9e0c8' };
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function PollView() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { if (router.query.code) setCode(String(router.query.code)); }, [router.query.code]);

  const fetchData = useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/live-poll?code=${code}`);
      if (r.status === 404) { setError('Δεν υπάρχει ενεργή ψηφοφορία με αυτόν τον κωδικό.'); return; }
      const j = await r.json(); setData(j.data); setError(null);
    } catch (e) {}
  }, [code]);

  useEffect(() => { if (!code) return; fetchData(); const iv = setInterval(fetchData, 3000); return () => clearInterval(iv); }, [code, fetchData]);

  if (!code) return <CodeGate router={router} to="poll-view" title="Ψηφοφορία" />;

  const total = data?.totalVotes || 0;
  const options = data?.options || [];
  const maxCount = Math.max(1, ...options.map((o) => data?.tally?.[o.id] || 0));

  return (
    <div style={S.wrap}>
      <Head><title>Ψηφοφορία {code} — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{`*{box-sizing:border-box}html,body{margin:0;background:${C.bg}}`}</style>

      <div style={S.header}>
        <div><div style={S.brand}>ΛΕΒΙΑΘΑΝ · ΨΗΦΟΦΟΡΙΑ</div><div style={{ fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{data?.question || '—'}</div></div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 14 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: C.accentD, letterSpacing: 2 }}>{code}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{total} ψήφοι</div>
        </div>
      </div>

      {error && <div style={{ ...S.card, color: '#b91c1c', textAlign: 'center' }}>{error}</div>}
      {!error && !data && <div style={{ ...S.card, textAlign: 'center', color: C.muted }}>Φόρτωση…</div>}

      {!error && data && (
        <div style={S.card}>
          {options.length === 0 && <div style={S.empty}>Δεν ορίστηκαν επιλογές.</div>}
          {options.map((o, i) => {
            const n = data.tally?.[o.id] || 0;
            const p = pct(n, total);
            const w = Math.round((n / maxCount) * 100);
            return (
              <div key={o.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{o.label}</span>
                  <span style={{ fontSize: 14, color: C.muted }}>{n} · {p}%</span>
                </div>
                <div style={{ height: 30, background: C.line, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, minWidth: n > 0 ? 6 : 0, background: PALETTE[i % PALETTE.length], borderRadius: 8, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Footer data={data} />
    </div>
  );
}

const PALETTE = ['#a68a2e', '#4f7a6f', '#8a5a44', '#5a6b8a', '#7a6420', '#6b8a5a'];

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

function Footer({ data }) {
  return <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, padding: '8px 0 20px' }}>
    Ζωντανή ενημέρωση κάθε 3 δευτ.{data?.updatedAt ? ' · τελευταία: ' + new Date(data.updatedAt).toLocaleTimeString('el-GR') : ''}
  </div>;
}

const S = {
  wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '16px 14px 24px', maxWidth: 760, margin: '0 auto' },
  brand: { fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: 700, textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.line}` },
  card: { background: C.card, borderRadius: 16, padding: '18px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${C.line}` },
  empty: { fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 10px' },
  codeInput: { width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 8, padding: '12px 0', border: `2px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: 'monospace' },
};
