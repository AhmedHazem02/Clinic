# نظام الحجز - شرح كامل للـ Flow والـ Roles

## 📋 نظرة عامة

النظام يسمح **للمرضى بالحجز بدون تسجيل دخول** ويعطيهم رابط لمتابعة حالتهم.

---

## 🎭 الأدوار (Roles) في النظام

### 1. **Public/Patient (زائر/مريض غير مسجل)**
**الصلاحيات:**
- ✅ **يقدر يحجز** من صفحة `/book/[clinicSlug]` بدون login
- ✅ **يشوف حجزه** من `/status/[clinicId]/[doctorId]/[ticketId]`
- ✅ **يقرأ clinic info** (اسم العيادة، الطبيب، إلخ)
- ❌ **ما يقدرش يعمل list** لكل العيادات (anti-scraping)
- ❌ **ما يقدرش يشوف معلومات المرضى الآخرين**

**Firestore Rules:**
```javascript
// يقدر يقرأ عيادة واحدة محددة (get only)
allow get: if resource.data.isActive == true;

// يقدر ينشئ booking ticket بشروط
allow create: if /* validation rules */;

// يقدر يقرأ ticket الخاص بيه لو مش منتهي
allow get: if resource.data.expiresAt.toMillis() > request.time.toMillis();
```

---

### 2. **Nurse (ممرضة/موظف استقبال)**
**الصلاحيات:**
- ✅ **يحجز للمرضى** (نفس صلاحية المريض + بيانات إضافية)
- ✅ **يشوف كل المرضى** في عيادته فقط
- ✅ **يدير الطابور** (ينقل للكشف، يخلّص)
- ✅ **يبعت رسائل للمرضى**
- ❌ **ما يقدرش يكتب روشتة** (دي للدكتور بس)
- ❌ **ما يقدرش يشوف بيانات عيادة تانية**

**Firestore Rules:**
```javascript
// يقدر يقرأ/يكتب في عيادته بس
allow read, write: if sameClinic(resource.data.clinicId);

function sameClinic(clinicId) {
  return isAuthenticated() && (
    (isActiveNurse() && getNurseClinicId() == clinicId)
  );
}
```

**Authentication Required:** ✅ Yes (Firebase Auth)

---

### 3. **Doctor (طبيب/صاحب العيادة)**
**الصلاحيات:**
- ✅ **كل صلاحيات الممرضة**
- ✅ **يكتب روشتة**
- ✅ **يدير إعدادات العيادة**
- ✅ **يضيف/يحذف موظفين**
- ✅ **يشوف الإحصائيات**
- ❌ **ما يقدرش يشوف/يعدل عيادات تانية**

**Firestore Rules:**
```javascript
// نفس sameClinic لكن بـ isActiveDoctor()
allow read, write: if sameClinic(resource.data.clinicId);
```

**Authentication Required:** ✅ Yes (Firebase Auth)

---

### 4. **Platform Admin (سوبر أدمن)**
**الصلاحيات:**
- ✅ **يشوف كل العيادات**
- ✅ **يدير platform clients**
- ✅ **Server-side only** (مش من Firestore Client)

**Firestore Rules:**
```javascript
// ما فيش صلاحيات client-side
// كل شيء من خلال API routes بـ Admin SDK
allow read, write: if false;
```

---

## 🔄 Flow الحجز للمريض (Public Booking)

### الخطوة 1: المريض يدخل صفحة الحجز
```
URL: /book/[clinicSlug]
مثال: /book/dr-ahmed-clinic
```

**ما يحصل:**
1. النظام يجيب بيانات العيادة من Firestore (`clinics` collection)
2. يعرض فورم الحجز (اسم، تليفون، السن، إلخ)
3. يعرض عدد الناس في الطابور اليوم

### الخطوة 2: المريض يملا البيانات ويضغط "احجز"
**ما يحصل:**
```typescript
// POST /api/public/book
const response = await fetch('/api/public/book', {
  method: 'POST',
  body: JSON.stringify({
    clinicSlug: 'dr-ahmed-clinic',
    doctorId: 'xxx',
    name: 'أحمد محمد',
    phone: '01012345678',
    age: 25,
    queueType: 'Consultation',
  }),
});
```

### الخطوة 3: Server API يعمل المعالجة
**في `/api/public/book/route.ts`:**

1. **Rate Limiting** (منع الـ spam)
2. **Validation** (التأكد من البيانات صحيحة)
3. **Check Duplicate** (لو المريض حجز قبل كده النهارده)
4. **Calculate Queue Number** (رقم الدور)
5. **Create Patient Document** في `patients` collection
6. **Create Booking Ticket** في `bookingTickets` collection
7. **Return ticketId**

```typescript
// النتيجة
{
  ok: true,
  ticketId: 'abc123xyz',
  queueNumber: 5,
  alreadyBooked: false
}
```

### الخطوة 4: Redirect للنجاح
```
URL: /book/[clinicSlug]/success?ticketId=abc123xyz
```

**ما يحصل:**
- النظام يعرض:
  - ✅ رسالة نجاح
  - 📱 رقم الدور: 5
  - 🔗 رابط لمتابعة الحالة
  - 📋 بيانات الحجز

### الخطوة 5: المريض يتابع حجزه
```
URL: /status/[clinicId]/[doctorId]/[ticketId]
```

**ما يحصل:**
- النظام يقرأ `bookingTicket` من Firestore
- يعرض:
  - الحالة: (Waiting / Consulting / Finished)
  - رقم الدور
  - عدد الناس قبله
  - رسائل الدكتور (إن وجدت)

---

## 🔐 Firestore Security Rules - الشرح التفصيلي

### Rule 1: Public Booking Creation
```javascript
match /bookingTickets/{ticketId} {
  allow create: if 
    // Required fields exist
    request.resource.data.clinicId is string &&
    request.resource.data.doctorId is string &&
    request.resource.data.patientId is string &&
    request.resource.data.displayName is string &&
    request.resource.data.phoneLast4 is string &&
    
    // Status validation
    request.resource.data.status in ['Waiting', 'Consulting', 'Finished'] &&
    
    // Queue type validation
    request.resource.data.queueType in ['Consultation', 'Re-consultation'] &&
    
    // Timestamps valid
    request.resource.data.createdAt is timestamp &&
    request.resource.data.expiresAt is timestamp &&
    request.resource.data.expiresAt.toMillis() > request.time.toMillis() &&
    
    // Anti-cheating: createdAt cannot be in future
    request.resource.data.createdAt.toMillis() <= request.time.toMillis() + 60000;
}
```

**الشرح:**
- ✅ **يسمح للـ public** بإنشاء ticket
- ✅ **يتأكد** إن كل الحقول المطلوبة موجودة
- ✅ **يمنع** القيم الغلط (enum validation)
- ✅ **يمنع** التلاعب بالتواريخ (anti-cheating)
- ✅ **يمنع** Tickets منتهية من البداية

### Rule 2: Public Ticket Reading
```javascript
allow get: if resource.data.expiresAt.toMillis() > request.time.toMillis();
```

**الشرح:**
- ✅ **يسمح** بقراءة ticket لو لسه صالح
- ❌ **يمنع** قراءة tickets منتهية (خصوصية)
- ❌ **يمنع** list كل الـ tickets (anti-scraping)

### Rule 3: Staff Multi-Tenant Isolation
```javascript
allow read: if sameClinic(resource.data.clinicId);
allow create: if sameClinic(request.resource.data.clinicId);
allow update: if sameClinic(resource.data.clinicId);
```

**الشرح:**
- ✅ **الموظفين** يقدروا يشوفوا tickets عيادتهم بس
- ❌ **ما يقدروش** يشوفوا عيادات تانية
- ✅ **الدكتور/الممرضة** يقدروا يعدلوا status

---

## 🛡️ الأمان (Security Considerations)

### ✅ ما تم تنفيذه:

1. **Rate Limiting**
   - كل IP محدود بـ X طلبات/دقيقة
   - منع spam attacks

2. **Input Validation**
   - Zod schema للتأكد من البيانات
   - Sanitization للأسماء والنصوص
   - Egyptian phone validation

3. **Anti-Scraping**
   - منع list queries على public collections
   - فقط get بـ ID محدد

4. **Multi-Tenant Isolation**
   - كل عيادة معزولة تماماً
   - الموظفين ما يشوفوش بيانات عيادات تانية

5. **Privacy-Safe Tickets**
   - فقط أول حرف من الاسم (`أ.م.`)
   - آخر 4 أرقام من التليفون (`5678`)
   - مفيش بيانات حساسة في الـ ticket

6. **Timestamp Validation**
   - منع التلاعب بتواريخ الحجز
   - Tickets تنتهي آخر اليوم

---

## 🔧 الخلاصة والتوصيات

### ✅ الوضع الحالي صحيح أمنياً:

1. **Public Booking مسموح** ✅
   - ده مطلوب للمرضى اللي ما عندهمش حساب
   - محمي بـ validation rules قوية

2. **Firestore Rules محكمة** ✅
   - Multi-tenant isolation شغال
   - Anti-scraping شغال
   - Privacy محفوظ

3. **Server API موجود** ✅
   - `/api/public/book` بيستخدم Admin SDK
   - Rate limiting شغال
   - Duplicate check شغال

### 🎯 التوصيات:

#### الحل الحالي (الموصى به):
**استخدام Server API فقط**
- الكود الحالي بيستخدم `/api/public/book` ✅
- آمن وكامل ✅
- ما يحتاجش تعديل ✅

#### البديل (لو عايز تسمح direct Firestore writes):
**الـ Rules اللي عملناها كافية** ✅
- لكن Server API أفضل عشان:
  - Rate limiting
  - Duplicate checking
  - Complex validation

---

## 📝 ملخص الـ Roles للـ Firestore Rules

| Collection | Public | Nurse | Doctor | Platform Admin |
|------------|--------|-------|--------|----------------|
| `clinics` | GET only (active) | Read/Write own | Read/Write own | API only |
| `doctors` | GET only (active) | Read own clinic | Read/Write own | API only |
| `nurses` | ❌ | Read/Write own | Read own clinic | API only |
| `patients` | ❌ | Read/Write own clinic | Read/Write own clinic | API only |
| `bookingTickets` | GET + CREATE* | Read/Write own clinic | Read/Write own clinic | API only |
| `queueState` | GET only | Read/Write own clinic | Read/Write own clinic | API only |
| `doctorMessages` | GET/LIST | Create/Update/Delete own clinic | Create/Update/Delete own clinic | API only |

**CREATE***: مع strict validation rules

---

## 🚀 التطبيق العملي

### نشر التعديلات:

```bash
# Deploy Firestore Rules
firebase deploy --only firestore:rules

# أو deploy كل شيء
firebase deploy
```

### اختبار النظام:

1. **Public Booking:**
   ```
   /book/your-clinic-slug
   ```
   - احجز بدون login
   - شوف الـ ticket

2. **Status Page:**
   ```
   /status/[clinicId]/[doctorId]/[ticketId]
   ```
   - شوف حالة الحجز

3. **Nurse Dashboard:**
   - سجل دخول كممرضة
   - شوف طابور اليوم
   - انقل مريض للكشف

4. **Doctor Dashboard:**
   - سجل دخول كدكتور
   - اكتب روشتة
   - خلّص مريض
