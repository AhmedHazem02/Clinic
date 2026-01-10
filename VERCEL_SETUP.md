# Vercel Deployment Setup

## Environment Variables Setup

يجب إضافة جميع متغيرات البيئة في Vercel Dashboard:

### Firebase Client Configuration (Required)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCHUXPQGzzUau7rDmNZBQSGhpnpTj8I28w
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=queuewise-clinic-bgafu.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=queuewise-clinic-bgafu
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=queuewise-clinic-bgafu.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=823213877401
NEXT_PUBLIC_FIREBASE_APP_ID=1:823213877401:web:d516081a75bbd9b95db008
```

### Firebase Admin SDK (Required for Server-Side)
```
FIREBASE_PROJECT_ID=queuewise-clinic-bgafu
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@queuewise-clinic-bgafu.iam.gserviceaccount.com
```

**Important:** For `FIREBASE_PRIVATE_KEY`, use the full key with `\n` (not actual line breaks):
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCttOFpmfA/Q/e7\ngdjyFLNWXSxoY79rKyXtLs8U6vcE7GwDiHUN89FTN5lhOr4iWaz1QkPbGOER5q5D\n7YDFpgwbrK1/LFpYDfwqrz5Gt1MOU8qc9rt4FCcR1970G71AEu70dj9ORY10TPt0\nfThLiA/R2uoeep6JyK7VU93pBSW1qwQ/TBFUAYwAOFpsmG1R7U2NBIO6+3imikb9\nRPcJ5C11K9i9AU26eriFsH12ABBl93o9hbLEVhubbExPt11s8S+Z865nxP/Dtz13\nSp0QHAVlMjAhs1QFMTBIO8ScAN2LCMIHGfSFE7lH5Kd1OJdTO48yINUTilKZUG9v\n+e7NX5ZpAgMBAAECggEABngFxcTJnjshJUBFqWY9JrDOyY7SMklOEhIiYuYJKVhg\nmvt6JUXe/FlfgrAJJDnwtF8X+QQ1+Lbj5uJ+X13t3E36Inh7xZ6BTvM6jEmhc/28\n17GWJt4HqNhALkw/wclMUTN7uHKwo0cgPVge2fk8Ly8W27TqfuxHtOjfPiFGvggl\nQKRLJCJUprgMFEFjq70gqehOPa+hyeWWvCeaZsXKvEv8cUXEBaicuEqx7ktTIjhv\nY0IJrqsEwCYSo0q3Y3G2LHnRB26LNfcca9uRkzxAGjCDvOVRIPizip8j/WzX52Xg\nqPPT0bEdLImVPKcxE/XuXohKaKEq9cCL1g++vvQYfQKBgQDbTFTLrtH+U+6PewlI\n5NIPRPkMezQLBarT4z3SkRyhYonWByJRqxEXW3LTeA3qodVcnE0GJR+7YWAv2XTK\nAhPH1TV3h+dWP4fz/Ga9sR7jZRCCtgvGMbnp0PHY+x+nEWCADFOMKnG34AwqBowQ\nyuZrbXxk9Oshr3gsMuNHdzA6swKBgQDKxzXk/qFc71M2V6zQRKj+kPK3dwyw9KnD\nLq1b+7pHBf22uGiX4rQ1zrB6CU907G+mttOV3sQ67jUwOjQc/4yzCl8bqQ1SG9M8\nKXlMcAVHbAA+0jEAkaHkQMHU/wxqNChYl1lX+nQjw1DzbqvBrQB/wIDX/gYXaXzM\nP4DDCfHocwKBgD/XdewiBcI7nvyoPei5rKmDU9mdWGZJDRVIV2wgkKwu6p+jTgtm\neMBLAB+uGKcQ2/NtEUNTtWwwifcEIGratfV8DWex6dgDAMo31ZUtpide+bKD2uOl\nAFGgYXfgi7NwbJ56eCwbAyYblI77fvU4jGID6q3dW0JgOeTsH5xjh2ffAoGBAIYY\nZNiRVo5JqcKXCi4UKZlmq0uOC7N9qEHtvTDF7/KF0Lkji+9dOQUYMPYS8BuHO3KJ\nFrTWQvghjMTeyJWgnR/NLQXyrl9tDSyM1K0qqyMHFcZ1Y3hX1jJGbKf5HfGhmkiz\nlZ6rfmAkCoVg225RhLH20H2Fe+vBk4jSOclA61tnAoGASmJMStkDAonyOUPJKghx\n3G0/XRqgfa3NeKvuKeTWhtEwV/VxDkvMQ9DdWCohxNWjDGbqhEWPTgTryYEU4pgG\nOeBtXQtOJ2a9OyIco4Cxl0a03aINJYnlZQs+LmDFV1nTsSnT1Jjazritt/6OCkEY\nrnNl6GlDlBH0RTRcFuGBZ4Y=\n-----END PRIVATE KEY-----\n"
```

### Firebase Service Account (Optional - for backward compatibility)
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"queuewise-clinic-bgafu",...}
```

### Application URL (Optional but Recommended)
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Steps to Add Environment Variables in Vercel:

1. **Go to Vercel Dashboard**
   - افتح project على Vercel
   - اضغط على "Settings"

2. **Navigate to Environment Variables**
   - من القائمة الجانبية اختر "Environment Variables"

3. **Add Each Variable**
   - اكتب اسم المتغير في "Key"
   - انسخ القيمة في "Value"
   - اختر Environment: **Production**, **Preview**, **Development** (اختر الثلاثة)
   - اضغط "Add"

4. **Redeploy**
   - بعد إضافة جميع المتغيرات
   - اذهب لـ "Deployments"
   - اضغط على آخر deployment
   - اختر "Redeploy"

---

## Firebase Console Configuration

تأكد من إضافة domain الخاص بـ Vercel في Firebase Console:

1. **Go to Firebase Console**
   - افتح [Firebase Console](https://console.firebase.google.com)
   - اختر project: `queuewise-clinic-bgafu`

2. **Add Authorized Domain**
   - اذهب إلى **Authentication** → **Settings** → **Authorized domains**
   - اضغط "Add domain"
   - أضف domain الخاص بك: `clinic-woad-ten.vercel.app`
   - أضف أيضاً: `*.vercel.app` (للـ preview deployments)

---

## Common Issues & Solutions

### Issue: ERR_NAME_NOT_RESOLVED
**Cause:** Missing `NEXT_PUBLIC_*` environment variables
**Solution:** Add all Firebase client config variables listed above

### Issue: ERR_TOO_MANY_REDIRECTS
**Cause:** Login pages not in public routes list
**Solution:** Already fixed in middleware.ts

### Issue: Firebase Auth doesn't work
**Cause:** Domain not authorized in Firebase
**Solution:** Add Vercel domain to Firebase authorized domains

---

## Verification Checklist

After deployment, verify:
- [ ] All environment variables are set in Vercel
- [ ] Vercel domain is in Firebase authorized domains
- [ ] Login page loads without redirect loop
- [ ] Firebase authentication works
- [ ] No console errors about missing config

---

## Security Note

⚠️ **IMPORTANT:** Never commit `.env.local` to Git!
- `.env.local` is already in `.gitignore`
- Only add environment variables through Vercel Dashboard
- Firebase API keys can be public (they're meant for client-side)
- Private key should only be in Vercel environment variables, never in frontend code
