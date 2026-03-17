# Sub Tracker — Session Progress

## מה נבנה

אפליקציית ווב מלאה לניהול מנויים. הפרויקט עובד ומוכן להרצה.

---

## ארכיטקטורה

```
Sub Tracker/
├── server/          # Express + TypeScript + SQLite (port 3001)
├── client/          # React + Vite + TypeScript (port 5173)
├── README.md
└── PROGRESS.md      # הקובץ הזה
```

### Server
- **Express** + TypeScript
- **SQLite** via `better-sqlite3` — קובץ DB: `server/data/subtracker.db`
- **Gmail API** via `googleapis` — OAuth2 עם scope `gmail.readonly`
- כל ה-dependencies מותקנים (`server/node_modules/`)

### Client
- **React** + Vite + TypeScript
- **Tailwind CSS** + **Lucide React** icons
- **date-fns** לעיצוב תאריכים
- כל ה-dependencies מותקנים (`client/node_modules/`)
- עיצוב: dark fintech — רקע כהה, מספרים ב-JetBrains Mono, accent סגול

---

## פיצ'רים שמוכנים

- ✅ הוספת מנוי ידנית (חברה, שירות, מחיר, מחזור חיוב, תאריך חידוש, קישור ביטול)
- ✅ עריכה ומחיקה של מנויים
- ✅ ביטול מנוי → עובר להיסטוריה
- ✅ Dashboard עם סיכום עלויות (חודשי / שנתי / מתחדש בקרוב)
- ✅ ציר זמן חידושים קרובים עם צבע לפי דחיפות
- ✅ דף History למנויים מבוטלים + חיסכון חודשי
- ✅ Gmail OAuth — זיהוי אוטומטי של מנויים מאימיילים
- ✅ Pending Review — מנויים מ-Gmail ממתינים לאישורך לפני הוספה
- ✅ 20+ שירותים מוכרים עם קישור ביטול מוכן (Netflix, Spotify, Adobe וכו')

---

## הרצה

**בכל פעם שרוצים להפעיל:**

```bash
# טרמינל 1 — Backend
cd server
npm run dev

# טרמינל 2 — Frontend
cd client
npm run dev
```

פתח: **http://localhost:5173**

---

## Gmail Integration — מצב נוכחי

**לא מוגדר עדיין.** הקובץ `server/.env` קיים אבל עם ערכים ריקים.

כדי להפעיל Gmail:
1. כנס ל-[console.cloud.google.com](https://console.cloud.google.com)
2. צור פרויקט → הפעל Gmail API
3. צור OAuth 2.0 credentials (Web application)
4. הוסף redirect URI: `http://localhost:3001/api/gmail/callback`
5. הוסף את המייל שלך כ-Test User
6. עדכן `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
7. הפעל מחדש את ה-server

**האפליקציה עובדת מצוין גם בלי Gmail** — הוספה ידנית עובדת מיד.

---

## כיוון עתידי — אפליקציה ציבורית למובייל

הוחלט שהמטרה הסופית היא אפליקציית Android/iOS ציבורית שכל אחד יכול להוריד.

### מה צריך לבנות בשלב הבא:
1. **User Authentication** — כל משתמש עם חשבון נפרד (JWT / Google Sign-In)
2. **Multi-tenant DB** — כל מנוי שייך למשתמש ספציפי
3. **React Native + Expo** — להחליף את ה-client הנוכחי
4. **Cloud deployment** — פרוס ה-server (Railway / Render / Fly.io)
5. **Google OAuth Verification** — נדרש לאפליקציה ציבורית עם Gmail

### מה מה-קוד הנוכחי ייסחב קדימה:
- כל ה-business logic של מנויים (server/src/services/)
- מבנה ה-API (server/src/routes/)
- לוגיקת Gmail parsing (server/src/services/gmailService.ts)
- הטיפוסים (types/index.ts)
- העיצוב — יותאם ל-React Native StyleSheet

---

## קבצים חשובים

| קובץ | תיאור |
|------|--------|
| `server/src/index.ts` | כניסה לשרת |
| `server/src/services/subscriptionService.ts` | כל פעולות ה-DB |
| `server/src/services/gmailService.ts` | Gmail OAuth + parsing |
| `server/src/db/migrations/001_initial.sql` | סכמת ה-DB |
| `server/.env` | credentials — **לא מועלה ל-git** |
| `client/src/App.tsx` | ניווט ראשי |
| `client/src/pages/Dashboard.tsx` | עמוד ראשי |
| `client/src/pages/History.tsx` | היסטוריית מנויים |
| `client/src/lib/api.ts` | כל הקריאות ל-backend |
