// pages/login.js — Σύνδεση + Επιλογή ρόλου + Βιβλιοθήκη
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Μετά το OAuth, ελέγχουμε αν υπάρχει ρόλος
  useEffect(() => {
    if (status !== 'authenticated') { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/role');
        const d = await r.json();
        if (cancelled) return;
        if (d.role) {
          // Μαθητής → /student, εκπαιδευτικός → /
          router.replace(d.role === 'student' ? '/student' : '/');
        } else {
          // Πρώτη φορά → επιλογή ρόλου
          setShowRolePicker(true);
          setChecking(false);
        }
      } catch {
        if (!cancelled) { setChecking(false); setShowRolePicker(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [status, router]);

  const pickRole = async (role) => {
    setSaving(true);
    try {
      await fetch('/api/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      router.replace(role === 'student' ? '/student' : '/');
    } catch {
      alert('Σφάλμα αποθήκευσης ρόλου. Δοκίμασε ξανά.');
      setSaving(false);
    }
  };

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

  // Επιλογή ρόλου (μετά το OAuth, πρώτη φορά)
  if (status === 'authenticated' && showRolePicker) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, maxWidth: 440 }}>
          <img src="/logo.png" alt="Leviathan" style={{ height: 80, objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
            Καλώς ήρθες!
          </div>
          <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 28, lineHeight: 1.6 }}>
            Πώς θα χρησιμοποιήσεις το ΛΕΒΙΑΘΑΝ;
          </p>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {/* Εκπαιδευτικός */}
            <button onClick={() => pickRole('teacher')} disabled={saving}
              style={{ ...S.roleBtn, background: '#f5f0e1', borderColor: '#e8dfc4' }}>
              <div style={S.roleIcon}>🎓</div>
              <div style={S.roleLabel}>Εκπαιδευτικός</div>
              <div style={S.roleDesc}>Ανέβασμα, σχόλια, ερωτήσεις, live, σύνδεση αρχείων</div>
            </button>

            {/* Μαθητής */}
            <button onClick={() => pickRole('student')} disabled={saving}
              style={{ ...S.roleBtn, background: '#e8f4f8', borderColor: '#c4dfe8' }}>
              <div style={S.roleIcon}>📚</div>
              <div style={S.roleLabel}>Μαθητής</div>
              <div style={S.roleDesc}>Λήψη υλικού, σημειώσεις, ετικέτες, μοίρασμα</div>
            </button>
          </div>

          {saving && <div style={{ fontSize: 13, color: '#8a7d4a' }}>Αποθήκευση…</div>}

          <div style={{ fontSize: 11, color: '#aeaeb8', marginTop: 8 }}>
            {session.user?.email}
          </div>
        </div>
      </div>
    );
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
            onClick={() => window.open('/student', '_blank')}
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
  roleBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px', borderRadius: 16, border: '2px solid', cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  roleIcon: { fontSize: 36, marginBottom: 10 },
  roleLabel: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 },
  roleDesc: { fontSize: 11, color: '#6b6b80', lineHeight: 1.5 },
};
