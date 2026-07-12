// pages/_app.js
// Περιλαμβάνει: εγγραφή service worker + μπάνερ εγκατάστασης PWA (ενσωματωμένο, χωρίς import)
import { useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';

const DISMISS_KEY = 'leviathan-install-dismissed';
const DISMISS_DAYS = 7;

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Ήδη εγκατεστημένο (standalone); → τίποτα
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) return;

    // Το έκλεισε πρόσφατα; → τίποτα
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 864e5) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // Στο iOS δεν υπάρχει beforeinstallprompt — δείχνουμε οδηγίες
      setShow(true);
    } else {
      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 420, width: 'calc(100% - 24px)',
      background: '#1a1a1a', color: '#f7f3e8',
      border: '1px solid #444', borderRadius: 14,
      padding: '14px 16px', boxShadow: '0 6px 24px rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'inherit', fontSize: 14, lineHeight: 1.45,
    }}>
      <img src="/icon-192.png" alt="" width={40} height={40}
           style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>ΛΕΒΙΑΘΑΝ Cloud</strong>
        {isIOS ? (
          <span>
            Εγκαταστήστε την εφαρμογή: πατήστε <strong>Κοινοποίηση</strong> (⬆︎)
            και μετά <strong>«Προσθήκη στην οθόνη Αφετηρίας»</strong>.
          </span>
        ) : (
          <span>Εγκαταστήστε την εφαρμογή στη συσκευή σας.</span>
        )}
      </div>
      {!isIOS && (
        <button onClick={install} style={{
          background: '#e9e0c8', color: '#3d3a2e', border: 'none',
          borderRadius: 10, padding: '8px 14px', fontWeight: 700,
          cursor: 'pointer', flexShrink: 0, fontSize: 14,
        }}>
          Εγκατάσταση
        </button>
      )}
      <button onClick={dismiss} aria-label="Κλείσιμο" style={{
        background: 'none', border: 'none', color: '#999',
        fontSize: 20, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1,
      }}>
        ×
      </button>
    </div>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  // Εγγραφή service worker — απαραίτητο για το install prompt σε Android/Chrome
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <InstallPrompt />
    </SessionProvider>
  );
}
