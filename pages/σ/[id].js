// pages/s/[id].js — Σύντομος σύνδεσμος → δημόσια σελίδα εκπαιδευτικού
// /s/smitselos → /student?teacher=smitselos@gmail.com
// /s/user@school.gr → /student?teacher=user@school.gr
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ShortLink() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!id) return;
    // Αν περιέχει @ → πλήρες email, αλλιώς → @gmail.com
    const email = id.includes('@') ? id : `${id}@gmail.com`;
    router.replace(`/student?teacher=${encodeURIComponent(email)}`);
  }, [id, router]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui', color:'#6b6b80' }}>
      Μετάβαση…
    </div>
  );
}
