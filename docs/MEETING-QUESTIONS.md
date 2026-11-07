# Uchrashuvga tayyorlanish savollari

Bot uchrashuv brifida **maqsad** (purpose) va **xizmat** (service) bo'yicha shu savollardan 3–6 tasini ko'rsatadi. Matnlar o'zbekcha, `worker/lib/meeting-questions.ts` ga statik xarita sifatida ko'chiriladi.

Kalitlar: `purpose.*` va `service.<slug>`; pastdagi `general` har doim 1–2 ta qo'shiladi.

## general
- Uchrashuvdan nimani kutasiz? Qanday natija sizni qoniqtiradi?
- Qaror qabul qiluvchi shaxs kim va qachongacha qaror chiqadi?

## purpose.JOB_OFFER (ish taklifi)
- Lavozim nomi va jamoa tarkibi qanday? Kimga hisobot beraman?
- Asosiy stack va loyiha turi (mahsulot / autsorsing)?
- Ish formati: masofaviy, ofis yoki gibrid? Ish soatlari?
- Tanlov jarayoni: qanday bosqichlar va qancha vaqt oladi?
- Sinov muddati, rivojlanish imkoniyatlari, o'qish/kurslar qo'llab-quvvatlanadimi?
- Boshlash sanasi va muddatlar.

## purpose.FREELANCE (bir martalik loyiha)
- Loyiha maqsadi va kim foydalanadi (auditoriya)?
- Hozir tayyor narsa bormi (dizayn, tizim, texnik vazifa)?
- Muddat va muhim sana (launch, tadbir)?
- Byudjet doirasi va to'lov tartibi qanday?
- Integratsiyalar kerakmi (to'lov, SMS, 1C, Telegram)?
- Loyihadan keyin qo'llab-quvvatlash va hosting kim zimmasida?
- Qaror qabul qiluvchi va ish jarayonidagi aloqa kanali (Telegram, Meet)?

## purpose.NETWORKING
- Siz kim va qanday sohada ishlaysiz?
- Qaysi mavzu bo'yicha tanishmoqchisiz (karyera, hamkorlik, tajriba almashish)?
- Birgalikda qilish mumkin bo'lgan narsa bormi (loyiha, jamoa, tadbir)?
- Keyingi aloqa kanali va qachon yana gaplashamiz?

## purpose.OTHER
- Uchrashuv mavzusini aniqlashtirib oling: asosiy savol nima?
- Qanday natija bilan chiqib ketmoqchisiz?

## service.landing-corporate (Landing va korporativ saytlar)
- Sayt maqsadi: lead yig'ish, kompaniya haqida, mahsulot katalogi?
- Nechta sahifa va qaysi tillar (uz/ru/en)?
- Dizayn va kontent tayyormi? Brend materiallari bormi?
- Domen, hosting va SEO talablari?
- CMS/admin kerakmi (yangiliklar, mahsulotlar)?

## service.crm-pms (CRM / PMS / admin tizimlar)
- Hozirgi jarayon qanday (Excel, daftar, boshqa tizim)? Qaysi qismi og'riqli?
- Rollar: kim nima ko'radi va qila oladi?
- Asosiy modullar (mijozlar, to'lovlar, hisobotlar, xodimlar, filiallar)?
- Mavjud ma'lumotlarni ko'chirish (import) kerakmi?
- Hisobotlar va Excel eksport talablari?
- Telegram bot yoki bildirishnomalar kerakmi?

## service.ecommerce-ticketing (Onlayn do'kon va chipta sotuvi)
- Nima sotiladi va nechta mahsulot/tadbir? Zaxira (qoldiq) hisobi kerakmi?
- To'lov usullari: Click, Payme, Uzum Bank, Atmos?
- Yetkazib berish yoki chipta tekshiruvi (QR) jarayoni qanday?
- Chegirma, promokod, referal tizimi kerakmi?
- Yuklama: kutilayotgan eng yuqori foydalanuvchi soni (masalan, chipta sotuvi ochilgan kun)?

## service.telegram-bots (Telegram botlar va Mini App)
- Bot kim uchun: mijozlar, xodimlar yoki ikkalasi?
- Asosiy vazifalar (buyurtma, to'lov, hisobot, eslatma, test)?
- Mini App kerakmi yoki oddiy bot yetadimi?
- Admin panel va statistikalar kerakmi?
- Mavjud tizimlar bilan integratsiya (CRM, Sheets, to'lov)?

## service.automation-n8n (Avtomatlashtirish — n8n)
- Qaysi jarayonlar qo'lda qilinmoqda va qancha vaqt oladi?
- Qaysi servislar bog'lanishi kerak (Sheets, Calendar, Telegram, CRM)?
- Ishga tushirish sharti: jadval bo'yicha, hodisa bo'yicha, webhook?
- Xatolik bo'lsa kim xabar oladi?
- n8n ni o'z serveringizda ishlatmoqchimisiz yoki biz joylaymizmi?

## service.backend-api (Backend va API)
- Mavjud tizim bormi yoki noldan quramizmi? Qaysi stack?
- Asosiy entitilar va foydalanuvchi rollari?
- Integratsiyalar, to'lov, navbatlar (queue), real-time (WebSocket) kerakmi?
- Hujjatlashtirish (Swagger), testlar, CI/CD talablari?
- Kutilayotgan yuklama va xavfsizlik talablari?
