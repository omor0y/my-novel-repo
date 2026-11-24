# فضاء الروايات لـ LNReader

مصدر لموقع [فضاء الروايات](https://cenele.com/) في تطبيق LNReader.

## الإضافة للتطبيق

في LNReader روح لـ **الإعدادات ← Repositories ← Add** وحط الرابط هذا:

```
https://raw.githubusercontent.com/omor0y/my-novel-repo/main/lnreader/plugins.min.json
```

بعدها ثبّت "فضاء الروايات" من قائمة الإضافات في قسم العربية.

## المميزات

- قائمة الشائع (حسب المشاهدات) والأحدث، والبحث
- كل الفصول: كل المجلدات مرة وحدة، على دفعات من 100 وأربع دفعات مع بعض (رواية فيها 3259 فصل تنجاب في ثواني)، ومرتبة حسب رقم الفصل
- نص الفصل ملفوف بـ `dir="rtl"`، عشان ملفات EPUB اللي تطلّعها من التطبيق تنقرأ من اليمين لليسار

## التحديث

الكود الأصلي في `src/fadaaRiwayat.ts`. بعد أي تعديل:

1. حوّله لـ JavaScript بنفس إعدادات مستودع lnreader-plugins (ES5 و CommonJS):
   ```
   npx tsc src/fadaaRiwayat.ts --target ES5 --module CommonJS --esModuleInterop --skipLibCheck --noCheck --noResolve --removeComments --outDir .
   ```
2. ارفع رقم `version` في ملف `.ts` وفي `plugins.min.json`، عشان التطبيق يعرض التحديث.
