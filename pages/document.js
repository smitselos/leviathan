// pages/_document.js
// Καθολικά <head> tags για όλες τις σελίδες:
// - apple-touch-icon (ΑΠΑΡΑΙΤΗΤΟ για το iOS «Προσθήκη στην οθόνη Αφετηρίας»)
// - manifest (Android/Chrome PWA)
// - theme-color
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="el">
      <Head>
        {/* Εικονίδιο εφαρμογής για iOS — το iOS αγνοεί το manifest, διαβάζει ΜΟΝΟ αυτό */}
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />

        {/* Εικονίδιο browser / favicon */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="shortcut icon" href="/icon-192.png" />

        {/* PWA manifest (Android/Chrome) */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS standalone behaviour */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ΛΕΒΙΑΘΑΝ" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Χρώμα γραμμής κατάστασης / theme */}
        <meta name="theme-color" content="#1a1a1a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
