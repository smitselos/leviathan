// pages/cloud-view.js — Ζωντανό νέφος λέξεων. /cloud-view?code=XXXX
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = { bg: '#faf7ef', card: '#ffffff', ink: '#2d2a1e', muted: '#8a8574', accent: '#a68a2e', accentD: '#7a6420', line: '#ece7d8' };
const PALETTE = ['#a68a2e', '#4f7a6f', '#8a5a44', '#5a6b8a', '#7a6420', '#6b8a5a', '#2d2a1e'];

export default function CloudView() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { if (router.query.code) setCode(String(router.query.code)); }, [router.query.code]);

  const fetchData = useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/live-cloud?code=${code}`);
      if (r.status === 404) { setError('Δεν υπάρχει ενεργό νέφος με αυτόν τον κωδικό.'); return; }
      const j = await r.json(); setData(j.data); setError(null);
    } catch (e) {}
  }, [code]);

  useEffect(() => { if (!code) return; fetchData(); const iv = setInterval(fetchData, 3000); return () => clearInterval(iv); }, [code, fetchData]);

  if (!code) return <CodeGate router={router} to="cloud-view" title="Νέφος λέξεων" />;

  // Ταξινόμηση κατά συχνότητα· μέγεθος γραμματοσειράς 16–64px σε λογαριθμική κλίμακα.
  const terms = data ? Object.values(data.terms || {}).sort((a, b) => b.count - a.count) : [];
  const maxC = Math.max(1, ...terms.map((t) => t.count));
  const size = (c) => { const min = 16, max = 64; if (maxC <= 1) return min + 10; return Math.round(min + (max - min) * (Math.log(c) / Math.log(maxC))); };

  return (
    <div style={S.wrap}>
      <Head><title>Νέφος λέξεων {code} — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{`*{box-sizing:border-box}html,body{margin:0;background:${C.bg}}`}</style>

      <div style={S.header}>
        <div><div style={S.brand}>ΛΕΒΙΑΘΑΝ · ΝΕΦΟΣ ΛΕΞΕΩΝ</div><div style={{ fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{data?.prompt || '—'}</div></div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 14 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: C.accentD, letterSpacing: 2 }}>{code}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{data?.total || 0} υποβολές · {terms.length} όροι</div>
        </div>
      </div>

      {error && <div style={{ ...S.card, color: '#b91c1c', textAlign: 'center' }}>{error}</div>}
      {!error && !data && <div style={{ ...S.card, textAlign: 'center', color: C.muted }}>Φόρτωση…</div>}

      {!error && data && (
        <div style={{ ...S.card, minHeight: 260, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6px 18px', padding: '28px 22px' }}>
          {terms.length === 0 && <div style={S.empty}>Αναμονή για τις πρώτες λέξεις… μόλις οι μαθητές υποβάλουν, θα εμφανιστούν εδώ.</div>}
          {terms.map((t, i) => (
            <span key={t.raw + i} title={`${t.count}`}
              style={{ fontSize: size(t.count), fontWeight: t.count >= maxC * 0.6 ? 800 : 600, color: PALETTE[i % PALETTE.length], lineHeight: 1.1, transition: 'font-size 0.4s ease' }}>
              {t.raw}
            </span>
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
  wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '16px 14px 24px', maxWidth: 900, margin: '0 auto' },
  brand: { fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: 700, textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.line}` },
  card: { background: C.card, borderRadius: 16, padding: '18px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${C.line}` },
  empty: { fontSize: 13, color: C.muted, textAlign: 'center', padding: '30px 10px', lineHeight: 1.5 },
  codeInput: { width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 8, padding: '12px 0', border: `2px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: 'monospace' },
};
