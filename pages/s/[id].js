// pages/s/[id].js — Σύντομος σύνδεσμος → σελίδα Τάξης εκπαιδευτικού
// /s/smitselos → /class?teacher=smitselos@gmail.com
// /s/user@school.gr → /class?teacher=user@school.gr
// (Διατηρείται μόνο για συμβατότητα με παλιούς συνδέσμους/QR· η δημόσια σελίδα είναι πλέον το /class)
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ShortLink() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!id) return;
    // Αν περιέχει @ → πλήρες email, αλλιώς → @gmail.com
    const email = id.includes('@') ? id : `${id}@gmail.com`;
    router.replace(`/class?teacher=${encodeURIComponent(email)}`);
  }, [id, router]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui', color:'#6b6b80' }}>
      Μετάβαση…
    </div>
  );
}
