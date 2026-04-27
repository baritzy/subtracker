# מעבר SubTracker מ-Neon ל-Supabase — מדריך הרצה

> **מטרה:** להעביר את ה-DB מ-Neon (חרוג, מושעה ב-100% compute) ל-Supabase free tier בלי לאבד שורה אחת ובלי לשבור את ה-push notifications.
> **זמן כולל מוערך:** 45–60 דקות (אם הכול חלק).
> **מתי:** ברגע שיש לך 60 דקות רצופות מול המחשב.

לפני שמתחילים — שים את הקובץ הזה פתוח בצד ועקוב שלב-שלב. אל תדלג. אם משהו נשבר באמצע, יש בסוף כל שלב **rollback**.

---

## דרישות מקדימות (5 דקות)

ודא שיש לך:
- [ ] גישה ל-`supabase.com` (התחבר עם Google/GitHub)
- [ ] גישה ל-`neon.tech` עם הפרויקט הקיים
- [ ] גישה ל-`dashboard.render.com` עם פרויקט `subtracker-nm4n`
- [ ] גישה ל-`uptimerobot.com`
- [ ] `pg_dump` ו-`psql` מותקנים מקומית, **גרסה 15 ומעלה** (Supabase מריץ Postgres 15+).

**איך לבדוק את הגרסה של pg_dump:**
פתח PowerShell והרץ:
```powershell
pg_dump --version
```
אם המספר נמוך מ-15 או אם הפקודה לא נמצאה → התקן את PostgreSQL מ-https://www.postgresql.org/download/windows/ (קח את ה-installer של גרסה 16). בזמן ההתקנה אפשר לסמן רק "Command Line Tools" — לא צריך את ה-server המקומי.

---

## שלב 1 — יצירת פרויקט ב-Supabase (5 דקות)

1. פתח https://supabase.com/dashboard
2. **New project**
3. שדות:
   - **Name:** `subtracker`
   - **Database password:** בחר סיסמה חזקה — **שמור אותה ב-1Password / מנהל סיסמאות מיד**, לא תוכל לראות אותה שוב.
   - **Region:** `Frankfurt (eu-central-1)` (הכי קרוב לישראל)
   - **Pricing plan:** Free
4. לחץ **Create new project** וחכה ~2 דקות עד שה-DB מוכן.
5. כשהפרויקט מוכן: לחץ למעלה על **Connect** (כפתור ירוק).
6. בחר את הטאב **Session pooler** (לא Transaction, לא Direct).
7. העתק את ה-URI. הוא נראה ככה:
   ```
   postgresql://postgres.xxxxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
8. החלף את `[YOUR-PASSWORD]` בסיסמה האמיתית שבחרת.
9. **שמור את ה-URI הזה ב-1Password עם השם `SUPABASE_DATABASE_URL`** — נצטרך אותו עוד 3 פעמים.

**בדיקת חיים:** הרץ ב-PowerShell:
```powershell
psql "<ה-URI ששמרת>" -c "SELECT version();"
```
אמור להחזיר שורה אחת עם `PostgreSQL 15.x` או `16.x`.

**מה קורה אם נשבר:** אם ה-`psql` לא מתחבר — בדוק שהדבקת את הסיסמה נכון, ושהשתמשת ב-Session pooler (פורט 6543, לא 5432).
**Rollback:** מחק את הפרויקט ב-Supabase ותתחיל מחדש.

---

## שלב 2 — להעיר את Neon לחלון קריאה (5 דקות)

Neon מושעה כי אזלה לך מכסת ה-compute. צריך חלון קצר כדי להוציא dump.

1. פתח https://console.neon.tech/
2. בחר את פרויקט `subtracker`.
3. אם רואים באנר אדום שאומר "Project suspended" → לחץ **Resume** / **Reactivate**. מקבלים בד"כ חלון של כמה שעות עד שעוצר שוב.
4. אם אין כפתור Resume → לך ל-**Branches** → תהיה ענף `main` עם snapshot. אפשר לעשות **Restore branch** לרגע מסוים — זה יוצר ענף חדש שאפשר לקרוא ממנו.
5. לך ל-**Connection Details** וצלם / שמור את ה-URI של Neon (יש סיכוי שעוד לא שמרת אותו במקום נפרד — אם הוא ב-Render כ-`DATABASE_URL`, סופר). שמור אותו ב-1Password עם השם `NEON_DATABASE_URL`.

**מה קורה אם נשבר:** אם Neon לא חוזר לחיים — פנה ל-Neon support. בלי הקריאה הזו אי אפשר לעבור.
**Rollback:** אין צורך — לא שינינו כלום עדיין.

---

## שלב 3 — Export מ-Neon (5–15 דקות, תלוי בגודל)

ב-PowerShell, החלף את `<NEON_URL>` ב-URI של Neon ששמרת:

```powershell
cd c:\Users\user\Documents\Projects\subtracker-repo
pg_dump "<NEON_URL>" `
  --no-owner `
  --no-privileges `
  --no-publications `
  --no-subscriptions `
  --schema=public `
  --format=plain `
  --file=neon_backup.sql
```

**מה אמור לקרות:** הפקודה תרוץ דקה-שתיים בשקט ותיצור קובץ `neon_backup.sql` בתיקיית הריפו. גודל סביר: 100KB–5MB.

**בדיקה:**
```powershell
Get-Item neon_backup.sql | Select-Object Name, Length
```
אם המספר אפס או חסר — הצילום נכשל.

**מה קורה אם נשבר:**
- `password authentication failed` → בדוק את ה-URI.
- `pg_dump: server version 15.x; pg_dump version 13.x` → התקן pg_dump 16 כפי שכתוב בדרישות המקדימות.
- `connection terminated` → Neon נרדם שוב. חזור לשלב 2.

**Rollback:** מחק את `neon_backup.sql` והתחל את השלב מחדש.

---

## שלב 4 — Import ל-Supabase (5 דקות)

```powershell
psql "<SUPABASE_DATABASE_URL>" -f neon_backup.sql
```

**מה אמור לקרות:** טקסט רץ במסך עם הרבה `CREATE TABLE`, `INSERT 0 N`, אולי כמה אזהרות אדומות `NOTICE: extension "..." already exists` — אלו לא שגיאות, התעלם.

**מה כן שגיאה:**
- שורות שמתחילות ב-`ERROR:` שלא מסתיימות ב-`already exists`.
- אם רואה `permission denied` → הוספת ב-pg_dump את `--no-owner --no-privileges` כפי שכתוב למעלה? אם לא, הרץ מחדש את שלב 3.

**Rollback:** ב-Supabase Dashboard → Settings → Database → **Reset database password / Reset all data**. או פשוט מחק את הפרויקט ותתחיל מ-שלב 1 (זה לוקח דקה).

---

## שלב 5 — אימות שלמות הנתונים (3 דקות)

הרץ את שתי הפקודות הבאות זו אחר זו, **עם אותה רשימת טבלאות**:

```powershell
# Neon counts
psql "<NEON_URL>" -c "SELECT 'subscriptions' AS t, COUNT(*) FROM subscriptions UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'scheduled_notifications', COUNT(*) FROM scheduled_notifications UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions UNION ALL SELECT 'fcm_tokens', COUNT(*) FROM fcm_tokens;"

# Supabase counts
psql "<SUPABASE_DATABASE_URL>" -c "SELECT 'subscriptions' AS t, COUNT(*) FROM subscriptions UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'scheduled_notifications', COUNT(*) FROM scheduled_notifications UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions UNION ALL SELECT 'fcm_tokens', COUNT(*) FROM fcm_tokens;"
```

**הצלחה:** המספרים בשני הצדדים זהים. כל שורה.

**אם לא זהים:**
- subscriptions חסר 1–2 שורות ב-Supabase → סביר ששורות נכנסו ל-Neon אחרי שעשית dump. אפשר להריץ שוב dump ול-`psql ... < neon_backup.sql` עם flag `--clean` (מוחק לפני import).
- אם פער גדול → עצור. `mv neon_backup.sql neon_backup_FAILED.sql`, ועשה את שלבים 3+4 מחדש.

**Rollback:** הכול עדיין על Neon ב-Render. לא נגענו ב-production. בטוח להפסיק כאן ולנסות שוב מחר.

---

## שלב 6 — החלפת DATABASE_URL ב-Render (5 דקות)

**זה הצעד הקריטי. אחרי זה ה-production רץ מול Supabase.**

1. https://dashboard.render.com/ → פרויקט `subtracker-nm4n`
2. לטאב **Environment** מצד שמאל
3. מצא את `DATABASE_URL`. **אל תמחק אותו.** לחץ עליו → **Edit** → שנה את שם המפתח ל-`DATABASE_URL_NEON_BACKUP` (השאר את ה-value כמו שהוא). שמור.
4. לחץ **Add Environment Variable**:
   - Key: `DATABASE_URL`
   - Value: ה-`SUPABASE_DATABASE_URL` המלא ששמרת ב-1Password
5. לחץ **Save Changes**. Render יבקש לאשר deploy — אשר.
6. למעלה לחץ **Manual Deploy** → **Deploy latest commit**.

חכה ~3 דקות עד שה-deploy מסתיים (הסטטוס יהפוך ל-Live ירוק).

**מה קורה אם נשבר:** אם ה-deploy נכשל, פתח את הטאב **Logs**:
- `connection refused` → ה-URL שגוי. ודא שכתבת Session pooler (פורט 6543), לא Direct.
- `SSL/TLS required` → ה-`database.ts` שלנו כבר מטפל בזה ב-production. אם בכל זאת נופל, ייתכן וצריך להוסיף `?sslmode=require` בסוף ה-URI.
- `relation "..." does not exist` → ה-import לא הצליח. חזור לשלב 5 לבדיקה.

**Rollback (חשוב — דע אותו בעל פה):**
1. ב-Render → Environment
2. שנה את שם `DATABASE_URL` ל-`DATABASE_URL_SUPABASE_BROKEN`
3. שנה את `DATABASE_URL_NEON_BACKUP` בחזרה ל-`DATABASE_URL`
4. Save → Manual Deploy
5. תוך 3 דקות חוזרים ל-Neon. (כל עוד Neon לא שוב מושעה — אם כן, צריך להעיר אותו שוב כמו בשלב 2.)

---

## שלב 7 — Smoke test (5 דקות)

זה הבדיקה שהכול חי. **אל תדלג.**

1. פתח את https://subtracker-nm4n.onrender.com (או ה-TWA בנייד אם מעדיף)
2. **Login** עם המשתמש הקיים שלך
3. ודא שרשימת המנויים נטענת ואותה רשימה שראית פעם אחרונה
4. צור מנוי בדיקה: שם `MIGRATION_TEST`, סכום 1 ש"ח, תאריך חידוש מחר
5. ב-Supabase Dashboard (https://supabase.com/dashboard) → פרויקט `subtracker` → **Table Editor** → טבלה `subscriptions` → ודא שהשורה `MIGRATION_TEST` מופיעה
6. בחזרה באפליקציה — **מחק** את `MIGRATION_TEST`
7. רענן ב-Supabase Dashboard — השורה נעלמה? יופי.

**בדיקה קריטית של push notifications:**
8. ודא שיש לך מנוי שתאריך החידוש שלו בעוד 1–7 ימים
9. ב-Supabase Table Editor → טבלה `scheduled_notifications` → אמור לראות שורות עם `scheduled_at` בעתיד הקרוב
10. אם אין שורות → תפעיל את ה-backfill ידנית: ב-`logs` של Render אמור להופיע `[Push] Backfilled notifications for N subscriptions.` תוך כמה דקות אחרי deploy. אם לא רואה את השורה הזו תוך 10 דקות → restart ידני של ה-service ב-Render.

**מה קורה אם נשבר:**
- האפליקציה לא טוענת מנויים → Rollback מיידי (שלב 6 → rollback)
- מנויים נטענים אבל יצירת מנוי נכשלת → בדוק logs, אולי יש בעיית schema/migration
- push לא קופץ → אל תעשה rollback רק בגלל זה. ה-push עצמו חי על FCM/VAPID, לא על ה-DB. בדוק ב-Render logs אם רואים `[Push] Sent ...` או שגיאה אחרת.

---

## שלב 8 — הורדת תדירות UptimeRobot (2 דקות)

אחרי שעבר Smoke test בהצלחה.

1. https://uptimerobot.com/ → My Monitors
2. מצא את המוניטור של `subtracker-nm4n.onrender.com` → **Edit**
3. **Monitoring Interval:** שנה מ-5 דקות ל-**10 דקות**
4. Save

**למה:** Render עם 5 דקות = השרת אף פעם לא ישן = ה-`backfillScheduledNotifications` רץ פחות (כי עכשיו יש לו guard של 24h), אבל גם connection pool ל-Supabase פתוח כל הזמן. 10 דקות עדיין מונע cold start אגרסיבי, אבל נותן לדברים להירגע.

**Rollback:** החזר ל-5 דקות אם תראה שהאפליקציה עולה לאט מדי.

---

## אחרי שהכול עובד (3 דקות)

עדכן זיכרון פרויקט:
- [ ] עדכן `p-projects/Sub Tracker/pitfalls.md` עם תאריך המעבר ל-Supabase
- [ ] עדכן `p-projects/Sub Tracker/features.md` — DB עכשיו על Supabase
- [ ] שמור את `neon_backup.sql` ב-Google Drive תחת `SubTracker/backups/neon_2026-04-26.sql` ואז מחק מקומית
- [ ] בעוד 14 יום: אם הכול עדיין יציב, בטל את הפרויקט ב-Neon לחלוטין כדי לא לבזבז chumming של compute hours בחינם. עד אז הוא נשאר כ-fallback.

---

## סיכום זמנים

| שלב | זמן |
|-----|-----|
| 1. Supabase project | 5 דק |
| 2. Resume Neon | 5 דק |
| 3. pg_dump | 5–15 דק |
| 4. psql import | 5 דק |
| 5. Verify counts | 3 דק |
| 6. Render env swap | 5 דק |
| 7. Smoke test | 5 דק |
| 8. UptimeRobot | 2 דק |
| **סך הכול** | **~45–60 דק** |

---

## הערה חשובה על push notifications

עברנו את ה-scheduler מ-15 דקות ל-30 דקות. המשמעות: התראת חידוש שאמורה לצאת ב-09:00 יכולה להגיע עד 09:30 במקרה הגרוע. עבור התראות 7 ימים / 24 שעות / 3 שעות מראש זה לא משנה. אם בעתיד תרצה התראת "מתחדש בעוד 5 דקות" — נצטרך לקצר חזרה את האינטרוול ולשלם את העלות ב-compute.

ה-`backfillScheduledNotifications` כבר לא רץ בכל cold start — יש שמירת state בטבלה `app_state` שגורמת לו לרוץ רק פעם ב-24 שעות. זה מה שחיסל את ה-30% הצריכה של Neon.
