// pages/login.js
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0e1', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <img src="/logo.png" alt="Leviathan" style={{ height: 100, objectFit: 'contain', marginBottom: 16 }} />
        <p style={{ fontSize: 14, color: '#6b6b80', marginBottom: 28, lineHeight: 1.6 }}>
          Συνδέσου με τον λογαριασμό Google σου. Τα αρχεία σου μένουν στο δικό σου Google Drive.
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{ background: '#8a7d4a', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' }}
        >
          Σύνδεση με Google
        </button>
        <div style={{ marginTop: 24, fontSize: 11, color: '#aeaeb8' }}>leviathan-cloud</div>
      </div>
    </div>
  );
}
