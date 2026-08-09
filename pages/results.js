// pages/results.js — Ζωντανή σελίδα αποτελεσμάτων κουίζ
// /results?code=XXXX → ράβδοι/ποσοστά συνολικά + ανά ερώτηση (polling κάθε 3s)
// Μπαίνει στη δεξιά στήλη του Live (split), ή προβάλλεται μόνη της στον διαδραστικό.
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = {
  bg: '#faf7ef', card: '#ffffff', ink: '#2d2a1e', muted: '#8a8574',
  accent: '#a68a2e', accentD: '#7a6420', ok: '#15803d', okBg: '#dcfce7',
  ko: '#b91c1c', koBg: '#fee2e2', bar: '#e9e0c8', line: '#ece7d8',
};

const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;

export default function ResultsPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'perq'

  useEffect(() => {
    if (router.query.code) setCode(String(router.query.code));
  }, [router.query.code]);

  const fetchData = useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/quiz-results?code=${code}`);
      if (r.status === 404) { setError('Δεν υπάρχει ενεργή συνεδρία με αυτόν τον κωδικό.'); return; }
      const j = await r.json();
      setData(j.data); setError(null);
    } catch (e) {}
  }, [code]);

  useEffect(() => {
    if (!code) return;
    fetchData();
    const iv = setInterval(fetchData, 3000);
    return () => clearInterval(iv);
  }, [code, fetchData]);

  const students = data ? Object.entries(data.students || {}) : [];
  const questions = data ? Object.entries(data.questions || {}) : [];
  const nStudents = students.length;
  const nFinished = students.filter(([, s]) => s.finished).length;
  const totalAns = data?.totals?.answered || 0;
  const totalOk = data?.totals?.correct || 0;

  /* ── Χωρίς κωδικό ── */
  if (!code) {
    return (
      <div style={S.wrap}>
        <Head><title>Αποτελέσματα κουίζ — ΛΕΒΙΑΘΑΝ</title></Head>
        <div style={{ ...S.card, maxWidth: 380, textAlign: 'center' }}>
          <div style={S.brand}>ΛΕΒΙΑΘΑΝ</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '4px 0 14px' }}>Αποτελέσματα κουίζ</div>
          <input type="text" inputMode="numeric" maxLength={4} placeholder="κωδικός"
            onKeyDown={e => { if (e.key === 'Enter' && e.target.value.length === 4) router.replace(`/results?code=${e.target.value}`); }}
            style={S.codeInput} />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Δώσε τον 4ψήφιο κωδικό της συνεδρίας</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <Head><title>Αποτελέσματα {code} — ΛΕΒΙΑΘΑΝ</title></Head>
      <style>{css}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.brand}>ΛΕΒΙΑΘΑΝ · ΑΠΟΤΕΛΕΣΜΑΤΑ</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{data?.quizName || 'Κουίζ'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: C.accentD, letterSpacing: 2 }}>{code}</div>
          <div style={{ fontSize: 11, color: C.muted }}>κωδικός συνεδρίας</div>
        </div>
      </div>

      {error && <div style={{ ...S.card, color: C.ko, textAlign: 'center' }}>{error}</div>}

      {!error && !data && <div style={{ ...S.card, textAlign: 'center', color: C.muted }}>Φόρτωση…</div>}

      {!error && data && (
        <>
          {/* KPI strip */}
          <div style={S.kpiRow}>
            <Kpi big={nStudents} label="παιδιά συμμετέχουν" />
            <Kpi big={nFinished} label="ολοκλήρωσαν" />
            <Kpi big={`${pct(totalOk, totalAns)}%`} label="σωστές συνολικά" color={C.ok} />
            <Kpi big={totalAns} label="απαντήσεις" />
          </div>

          {/* Toggle */}
          <div style={S.toggleRow}>
            <button onClick={() => setView('overview')} style={{ ...S.toggleBtn, ...(view === 'overview' ? S.toggleActive : {}) }}>Συνολικά</button>
            <button onClick={() => setView('perq')} style={{ ...S.toggleBtn, ...(view === 'perq' ? S.toggleActive : {}) }}>Ανά ερώτηση</button>
          </div>

          {/* ── OVERVIEW: κατάταξη παιδιών ── */}
          {view === 'overview' && (
            <div style={S.card}>
              <div style={S.cardTitle}>Κατάταξη μαθητών</div>
              {nStudents === 0 && <div style={S.empty}>Αναμονή για τα πρώτα παιδιά… μόλις σκανάρουν το QR και απαντήσουν, θα εμφανιστούν εδώ.</div>}
              {students
                .slice()
                .sort((a, b) => (b[1].correct - a[1].correct) || (b[1].answered - a[1].answered))
                .map(([name, s], i) => {
                  const p = pct(s.correct, s.answered);
                  return (
                    <div key={name} style={S.studentRow}>
                      <div style={{ ...S.rank, background: i === 0 ? '#fde68a' : i === 1 ? '#e5e7eb' : i === 2 ? '#fed7aa' : C.bar }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: C.ink, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name} {s.finished && <span title="Ολοκλήρωσε" style={{ color: C.ok }}>✓</span>}
                          </span>
                          <span style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>{s.correct}/{s.answered} · {p}%</span>
                        </div>
                        <div style={S.barTrack}><div style={{ ...S.barFill, width: `${p}%`, background: p >= 50 ? C.ok : C.ko }} /></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* ── PER QUESTION: ράβδοι σωστό/λάθος + κατανομή επιλογών ── */}
          {view === 'perq' && (
            <div>
              {questions.length === 0 && <div style={{ ...S.card }}><div style={S.empty}>Δεν υπάρχουν καταγεγραμμένες απαντήσεις ακόμη.</div></div>}
              {questions.map(([qid, q], i) => {
                const tot = (q.correct || 0) + (q.wrong || 0);
                const p = pct(q.correct, tot);
                const choiceEntries = Object.entries(q.choices || {}).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={qid} style={S.card}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={S.qNum}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {q.cat && <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{q.cat}</div>}
                        {q.excerpt && <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', lineHeight: 1.45, marginBottom: 6, paddingLeft: 10, borderLeft: `3px solid ${C.bar}` }} dangerouslySetInnerHTML={{ __html: q.excerpt }} />}
                        <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: q.qtext || '(ερώτηση)' }} />
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: p >= 50 ? C.ok : C.ko }}>{p}%</div>
                        <div style={{ fontSize: 11, color: C.muted }}>σωστά</div>
                      </div>
                    </div>

                    {/* Σωστό vs Λάθος */}
                    <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', marginTop: 10, background: C.line }}>
                      {q.correct > 0 && <div style={{ width: `${pct(q.correct, tot)}%`, background: C.ok, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{q.correct}</div>}
                      {q.wrong > 0 && <div style={{ width: `${pct(q.wrong, tot)}%`, background: C.ko, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{q.wrong}</div>}
                    </div>

                    {/* Κατανομή επιλογών */}
                    {choiceEntries.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Κατανομή απαντήσεων</div>
                        {choiceEntries.map(([ch, n]) => (
                          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 44, fontSize: 12, fontWeight: 600, color: C.ink, flexShrink: 0 }}>{ch}</div>
                            <div style={{ flex: 1, ...S.barTrack }}><div style={{ ...S.barFill, width: `${pct(n, tot)}%`, background: C.accent }} /></div>
                            <div style={{ width: 54, textAlign: 'right', fontSize: 12, color: C.muted, flexShrink: 0 }}>{n} · {pct(n, tot)}%</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, padding: '8px 0 20px' }}>
            Ζωντανή ενημέρωση κάθε 3 δευτ. · τελευταία: {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('el-GR') : '—'}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ big, label, color }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || C.accentD, lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  );
}

const css = `*{box-sizing:border-box;}html,body{margin:0;padding:0;background:${C.bg};}`;
const S = {
  wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding: '16px 14px 24px', maxWidth: 720, margin: '0 auto' },
  brand: { fontSize: 10, letterSpacing: 2, color: C.accent, fontWeight: 700, textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.line}` },
  card: { background: C.card, borderRadius: 16, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${C.line}` },
  cardTitle: { fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 },
  kpi: { background: C.card, borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: `1px solid ${C.line}` },
  toggleRow: { display: 'flex', gap: 6, marginBottom: 12, background: C.bar, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  toggleActive: { background: C.card, color: C.accentD, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  studentRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.line}` },
  rank: { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 },
  qNum: { width: 26, height: 26, borderRadius: 8, background: C.bar, color: C.accentD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  barTrack: { height: 8, background: C.line, borderRadius: 6, overflow: 'hidden', marginTop: 5 },
  barFill: { height: '100%', borderRadius: 6, transition: 'width 0.4s ease' },
  empty: { fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 10px', lineHeight: 1.5 },
  codeInput: { width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 8, padding: '12px 0', border: `2px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: 'monospace' },
};
