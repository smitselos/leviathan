// pages/api/auth/[...nextauth].js — ΛΕΒΙΑΘΑΝ Cloud
// Συγκατάθεση ΜΙΑ φορά: αφαιρέθηκε το prompt:'consent'. Το refresh token
// αποθηκεύεται στο KV (Upstash) και επαναχρησιμοποιείται στις επόμενες συνδέσεις.
//
// ⚠ ΚΟΙΝΟ KV με τη light: το κλειδί έχει namespace 'cloud:' ώστε να ΜΗΝ
// συγκρούεται με το 'refresh:{email}' της light. (Αν οι δύο εφαρμογές
// χρησιμοποιούν ΤΟ ΙΔΙΟ GOOGLE_CLIENT_ID, θα μπορούσαν να μοιράζονται και το
// ίδιο κλειδί — αλλά το namespace είναι ασφαλές και στις δύο περιπτώσεις.)
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@vercel/kv';

function getKV() {
  return createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}
const RT_KEY = (email) => `refresh:cloud:${email}`;

// ── Έλεγχος πρόσβασης: λίστα επιτρεπόμενων χρηστών στο KV ──
// Διαχείριση από το /api/allowed-users (μόνο διαχειριστές).
// ΚΕΝΗ λίστα = ελεύθερη είσοδος για όλους (όπως πριν).
const ALLOWED_KEY = 'cloud:allowed_users';
const adminEmails = () => (process.env.ADMIN_EMAILS || 'smitselos@gmail.com')
  .split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

async function isEmailAllowed(email) {
  const e = (email || '').toLowerCase();
  if (!e) return false;
  if (adminEmails().includes(e)) return true; // οι διαχειριστές περνούν ΠΑΝΤΑ
  try {
    const list = await getKV().get(ALLOWED_KEY);
    if (!Array.isArray(list) || list.length === 0) return true; // κενή λίστα → ελεύθερα
    return list.map((x) => String(x).toLowerCase()).includes(e);
  } catch (err) {
    // Σε σφάλμα KV μην κλειδώνεις τους πάντες έξω
    console.error('[allowlist]', err.message);
    return true;
  }
}

async function saveRefresh(email, rt) {
  if (!email || !rt) return;
  try { await getKV().set(RT_KEY(email), rt); } catch (e) { console.error('saveRefresh', e.message); }
}
async function loadRefresh(email) {
  if (!email) return null;
  try { return await getKV().get(RT_KEY(email)); } catch (e) { console.error('loadRefresh', e.message); return null; }
}

async function refreshAccessToken(token) {
  try {
    let refreshToken = token.refreshToken || (await loadRefresh(token.email));
    if (!refreshToken) throw new Error('No refresh token available');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const refreshed = await response.json();
    if (!response.ok) {
      // Ανακλημένο/ληγμένο refresh token: σβήσ' το από το KV για να μη «δηλητηριάζει» τις επόμενες συνδέσεις
      if (refreshed.error === 'invalid_grant') {
        try { await getKV().del(RT_KEY(token.email)); } catch {}
      }
      throw refreshed;
    }
    if (refreshed.refresh_token) { await saveRefresh(token.email, refreshed.refresh_token); refreshToken = refreshed.refresh_token; }
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          // Χωρίς prompt:'consent' → η οθόνη συναίνεσης εμφανίζεται μόνο την πρώτη φορά.
        },
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  jwt: { maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, profile }) {
      return isEmailAllowed(user?.email || profile?.email);
    },
    async jwt({ token, account, user, profile }) {
      if (account) {
        const email = user?.email || profile?.email || token.email || null;
        let refreshToken = account.refresh_token;
        if (refreshToken) await saveRefresh(email, refreshToken);
        else refreshToken = await loadRefresh(email);
        return {
          ...token,
          email,
          accessToken: account.access_token,
          refreshToken: refreshToken || token.refreshToken,
          // Η Google δίνει expires_at (δευτ. εποχής), όχι expires_in — αλλιώς προκύπτει NaN
          // και το σύστημα επιχειρεί ανανέωση αμέσως μετά τη σύνδεση.
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + ((account.expires_in ?? 3600) * 1000),
          error: undefined,
        };
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 5 * 60 * 1000) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
export default NextAuth(authOptions);
