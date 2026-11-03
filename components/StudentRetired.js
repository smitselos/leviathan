// components/StudentRetired.js — Μήνυμα για λογαριασμούς με ρόλο «μαθητής».
// Η εφαρμογή μαθητή καταργήθηκε· οι μαθητές παίρνουν το υλικό από τη σελίδα τάξης (/class).
import { signOut } from 'next-auth/react';

export default function StudentRetired({ email }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0e1', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <img src="/logo.png" alt="Leviathan" style={{ height: 72, objectFit: 'contain', marginBottom: 12 }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>Η εφαρμογή μαθητή δεν είναι πλέον διαθέσιμη</div>
        <p style={{ fontSize: 13, color: '#6b6b80', lineHeight: 1.6, marginBottom: 24 }}>
          Το υλικό του εκπαιδευτικού σου το βρίσκεις στη <b>σελίδα τάξης</b>, χωρίς σύνδεση,
          από τον σύνδεσμο ή το QR που σου έδωσε.
        </p>
        <button onClick={() => { window.location.href = '/class'; }}
          style={{ background: '#5c7a3a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: 10 }}>
          Σελίδα τάξης
        </button>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ background: 'transparent', color: '#8a7d4a', border: '1px solid #e8dfc4', padding: '10px 24px', borderRadius: 12, fontSize: 13, cursor: 'pointer', width: '100%' }}>
          Αποσύνδεση
        </button>
        {email && <div style={{ fontSize: 11, color: '#aeaeb8', marginTop: 14 }}>{email}</div>}
      </div>
    </div>
  );
}
