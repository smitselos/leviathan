# ΛΕΒΙΑΘΑΝ Cloud — νέα έκδοση (drive.file)

Καθαρή βάση της εφαρμογής, χτισμένη με **Next.js + NextAuth + Google Drive (drive.file)**.
Κάθε χρήστης μπαίνει με τον δικό του λογαριασμό Google και δουλεύει με το **δικό του** Drive,
ανεξάρτητα από τους άλλους. Χωρίς λίστα επιτρεπόμενων e-mail — μπαίνει ο καθένας.

## Τι κάνει αυτή η πρώτη έκδοση (MVP)

- Σύνδεση με Google (scope **μόνο** `drive.file` — μη ευαίσθητο, χωρίς CASA).
- Προσθήκη αρχείων με **Google Picker** (επιλογή υπαρχόντων) ή **ανέβασμα** από τη συσκευή.
- **Μητρώο** αρχείων αποθηκευμένο ως `leviathan-cloud-data.json` στο Drive του χρήστη
  (αντί για σάρωση φακέλων — απαραίτητο για το `drive.file`).
- Κατηγορίες: Κείμενα / Βιβλία / Δίκτυα.
- Προβολή αρχείου μέσα στην εφαρμογή (PDF, Google Docs/Slides, Office → PDF, HTML).
- Ανανέωση token (refresh) ώστε η πρόσβαση να μη λήγει στη 1 ώρα.

Τα επόμενα (δίκτυα-builder, σχόλια, ετικέτες, live, σελίδα μαθητή) προστίθενται σταδιακά.

---

## 1. Google Cloud — ρυθμίσεις (μία φορά)

Μπορείς να χρησιμοποιήσεις το **ίδιο** project που έχεις ήδη, ή νέο.

1. Στο [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Enabled APIs** ενεργοποίησε:
   - **Google Drive API**
   - **Google Picker API**
2. **Credentials → Create credentials → OAuth client ID** → τύπος **Web application**.
   - Authorized JavaScript origins: `https://ΤΟ-DOMAIN-ΣΟΥ.vercel.app` (και `http://localhost:3000` για τοπικά).
   - Authorized redirect URIs:
     - `https://ΤΟ-DOMAIN-ΣΟΥ.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
   - Κράτα το **Client ID** και **Client secret**.
3. **Credentials → Create credentials → API key** (αυτό είναι το `NEXT_PUBLIC_GOOGLE_API_KEY` για τον Picker).
4. Σημείωσε τον **Project number** (Dashboard → Project info) — είναι το `NEXT_PUBLIC_GOOGLE_APP_ID`.
5. **OAuth consent screen → Audience**: όταν είσαι έτοιμος, πάτησε **Publish app** (Production)
   ώστε να μπαίνει οποιοσδήποτε. Με `drive.file` η επαλήθευση είναι ελαφριά (χωρίς CASA).

---

## 2. Μεταβλητές περιβάλλοντος

Δες το `.env.example`. Στο **Vercel**: Project → Settings → Environment Variables, πρόσθεσε:

| Μεταβλητή | Τι είναι |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth Client secret |
| `NEXTAUTH_SECRET` | τυχαία συμβολοσειρά (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://ΤΟ-DOMAIN-ΣΟΥ.vercel.app` |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Browser API key (για Picker) |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | Project number |

---

## 3. Ανέβασμα στο GitHub + Vercel

1. Δημιούργησε νέο repo στο GitHub και ανέβασε όλα τα αρχεία αυτού του φακέλου.
2. Στο [Vercel](https://vercel.com/) → **Add New → Project** → επίλεξε το repo.
3. Πρόσθεσε τις μεταβλητές περιβάλλοντος (βήμα 2) και πάτησε **Deploy**.
4. Μετά το πρώτο deploy, βεβαιώσου ότι το `NEXTAUTH_URL` και τα redirect URIs ταιριάζουν
   με το πραγματικό domain που σου έδωσε το Vercel.

---

## 4. Τοπική εκτέλεση (προαιρετικά)

```bash
npm install
cp .env.example .env.local   # συμπλήρωσε τις τιμές
npm run dev
```

Άνοιξε http://localhost:3000

---

## Σημειώσεις αρχιτεκτονικής

- **Γιατί μητρώο και όχι σάρωση φακέλων;** Το `drive.file` δίνει πρόσβαση μόνο σε αρχεία
  που δημιουργεί ή που διαλέγει ρητά ο χρήστης (μέσω Picker/ανεβάσματος). Δεν μπορεί να
  «σαρώσει» έναν φάκελο. Γι' αυτό κρατάμε εμείς τη λίστα των αρχείων (file IDs) σε JSON
  στο Drive του χρήστη.
- **Το ανέβασμα** γίνεται απευθείας από τον browser στο Drive (multipart upload με το token
  του χρήστη), ώστε να μην περνά από τις serverless συναρτήσεις του Vercel (αποφυγή ορίου
  μεγέθους ~4.5MB).
- **Η αφαίρεση** από τη λίστα ΔΕΝ διαγράφει το αρχείο από το Drive — απλώς το βγάζει από το μητρώο.
