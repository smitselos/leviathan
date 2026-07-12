// pages/_app.js
import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import InstallPrompt from '../components/InstallPrompt';

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
