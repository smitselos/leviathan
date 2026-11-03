// pages/login.js — Σύνδεση + Βιβλιοθήκη
// Η εφαρμογή μαθητή καταργήθηκε: δεν υπάρχει πλέον επιλογή ρόλου. Κάθε νέος λογαριασμός
// γίνεται «εκπαιδευτικός»· παλιοί λογαριασμοί με ρόλο «μαθητής» βλέπουν μήνυμα παραπομπής στη σελίδα τάξης.
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import StudentRetired from '../components/StudentRetired';

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [retired, setRetired] = useState(false);

  // Μετά το OAuth, ελέγχουμε αν υπάρχει ρόλος
  useEffect(() => {
    if (status !== 'authenticated') { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/role');
        const d = await r.json();
        if (cancelled) return;
        if (d.role === 'student') {
          // Παλιός λογαριασμός μαθητή → μήνυμα (η εφαρμογή μαθητή καταργήθηκε)
          setRetired(true);
          setChecking(false);
          return;
        }
        if (!d.role) {
          // Πρώτη φορά → αυτόματα «εκπαιδευτικός» (χωρίς επιλογή ρόλου)
          await fetch('/api/role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'teacher' }),
          });
          if (cancelled) return;
        }
        router.replace('/');
      } catch {
        if (!cancelled) router.replace('/');
      }
    })();
    return () => { cancelled = true; };
  }, [status, router]);

  // Φόρτωση
  if (status === 'loading' || (status === 'authenticated' && checking)) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 14, color: '#6b6b80' }}>Φόρτωση…</div>
        </div>
      </div>
    );
  }

  // Παλιός λογαριασμός μαθητή
  if (status === 'authenticated' && retired) {
    return <StudentRetired email={session.user?.email} />;
  }

  // Αρχική οθόνη login (πριν το OAuth)
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700, width: '100%' }}>

        {/* Είσοδος */}
        <div style={{ ...S.card, flex: 1, minWidth: 280 }}>
          <img src="/logo.png" alt="Leviathan" style={{ height: 100, objectFit: 'contain', marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Είσοδος</div>
          <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 28, lineHeight: 1.6 }}>
            Συνδέσου με τον λογαριασμό Google σου. Τα αρχεία σου μένουν στο δικό σου Google Drive.
          </p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/login' })}
            style={S.googleBtn}
          >
            Σύνδεση με Google
          </button>
        </div>

        {/* Βιβλιοθήκη */}
        <div style={{ ...S.card, flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Βιβλιοθήκη</div>
          <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 28, lineHeight: 1.6 }}>
            Περιήγηση στο δημοσιευμένο εκπαιδευτικό υλικό χωρίς σύνδεση.
          </p>
          <button
            onClick={() => window.open('/s/smitselos', '_blank')}
            style={{ ...S.googleBtn, background: '#5c7a3a' }}
          >
            Ανοικτό υλικό
          </button>
        </div>

      </div>
      <div style={{ marginTop: 24, fontSize: 11, color: '#aeaeb8', textAlign: 'center' }}>leviathan-cloud</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: '#f5f0e1', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 380,
    width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  },
  googleBtn: {
    background: '#8a7d4a', color: '#fff', border: 'none', padding: '12px 28px',
    borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
};
