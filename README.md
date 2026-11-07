# Portfolio kit — Muhammadjon Abduvakhobov

Bu papka shaxsiy portfolio saytini **tartib bilan, o'zingiz xohlagan paytda** qurish uchun hamma narsani o'z ichiga oladi: spec, dizayn tizimi, ma'lumotlar bazasi sxemasi, tarjimalar, seed ma'lumotlar, Docker/Nginx fayllari va Claude Code uchun 10 ta tayyor prompt.

## Papka tarkibi

```
CLAUDE.md              Claude Code har sessiyada o'qiydigan loyiha qoidalari
README.md              shu fayl
docs/
  SPEC.md              to'liq mahsulot va texnik spec (asosiy hujjat)
  DESIGN.md            ranglar, shriftlar, animatsiyalar, bo'limlar o'tishi
  GAME.md              footer'dagi breakout o'yini spesifikatsiyasi
  BOOKING-N8N.md       yozilish oqimi, Google Calendar/Meet, Sheets, n8n workflow'lar
  BOT.md               shaxsiy assistent Telegram bot spesifikatsiyasi
  MEETING-QUESTIONS.md uchrashuvga tayyorlanish savollari (uz)
  QA-CHECKLIST.md      oxirgi tekshiruv ro'yxati
prompts/
  00-scaffold.md ... 09-deploy.md   tartib bilan beriladigan 10 ta prompt
prisma/schema.prisma   ma'lumotlar bazasi sxemasi
seed/seed-data.json    loyihalar va xizmatlar (keyin o'zingiz qo'shib borasiz)
messages/{uz,ru,en}.json   interfeys matnlari (3 til)
design/tokens.css      binafsha/qora rang tokenlari
docker-compose.yml     production (app, worker, postgres, redis, n8n)
docker-compose.dev.yml faqat lokal infratuzilma (postgres, redis, n8n)
Dockerfile             app va worker uchun
nginx/portfolio.conf.example
.env.example
```

## Qanday boshlash

1. Yangi bo'sh papka oching (masalan `portfolio`), `git init` qiling.
2. Shu kit ichidagi **hamma fayl va papkalarni** o'sha papkaga ko'chiring.
3. Shu papkada Claude Code'ni ishga tushiring.
4. `prompts/00-scaffold.md` ichidagi matnni Claude Code'ga bering. Tugagach natijani tekshirib, `git commit` qiling.
5. Keyingi prompt'larga tartib bilan o'ting. **Bitta prompt = bitta faza.** Fazani tugatmay keyingisiga o'tmang.
6. Hamma fazadan keyin `docs/QA-CHECKLIST.md` bo'yicha tekshiring.

## Fazalar

| # | Prompt | Natija |
|---|---|---|
| 00 | scaffold | Next.js loyiha, kutubxonalar, papka tuzilmasi, env, test muhiti |
| 01 | design-i18n | Dizayn tizimi, 3 til (uz/ru/en), layout, animatsiya asoslari |
| 02 | sections | Hero, About, Stack, Projects, Services, Contacts + bo'limlar o'tishi |
| 03 | db-admin | Baza, seed, admin panel (loyiha/xizmat/resume/sozlamalar), resume yuklab olish |
| 04 | booking | Bo'sh vaqtlar, yozilish formasi, boshqarish sahifasi, spamdan himoya |
| 05 | n8n-google | n8n workflow'lar: Google Calendar + Meet, Sheets, Telegram xabarnoma |
| 06 | bot-worker | Shaxsiy assistent bot, eslatmalar, vazifalar, uchrashuv brifi |
| 07 | game | Footer'dagi breakout o'yini |
| 08 | polish | SEO, OG rasm, a11y, tezlik, testlar |
| 09 | deploy | Docker, Nginx, TLS, backup, ishga tushirish |

## Qarorlar (men o'zim tanladim, xohlasangiz o'zgartiring)

- Konsultatsiya **30 daqiqa**, bepul, Google Meet. Davomiylikni adminkadan 15/30/45/60 ga o'zgartirasiz.
- Ish vaqti: **Dushanba–Shanba, 09:00–23:00** (Toshkent vaqti), yakshanba yopiq. Oxirgi slot 23:00 dan oldin tugaydi.
- Eng erta yozilish: hozirdan 3 soat keyin; eng uzoq: 30 kun oldin.
- Narxlar saytda yo'q. Har bir xizmat kartasida "Yozilish" tugmasi bor, tanlangan xizmat statistikaga yoziladi.
- Email xizmati (Resend va h.k.) **ishlatilmaydi**: tasdiqlash xatini Google Calendar taklifnomasi o'zi yuboradi.
- AI API yo'q, pullik servis yo'q: faqat VPS va domen.
- Bot alohida yangi bot (time-manager emas), faqat sizga javob beradi.
- Ism yozilishi: **Muhammadjon Abduvakhobov** (resumengizdagi kabi). Boshqacha bo'lsa `messages/*.json` va seed'ni to'g'rilang.

## Qo'lda qilinadigan ishlar (Claude Code buni qila olmaydi)

1. **Telegram bot:** `@BotFather` orqali yangi bot yarating → `TELEGRAM_BOT_TOKEN`. O'z ID'ingizni `@userinfobot` dan oling → `OWNER_TELEGRAM_ID`.
2. **Google Cloud:** yangi project → *Google Calendar API* va *Google Sheets API* ni yoqing → OAuth consent screen (External) → OAuth client (Web). Redirect URI: `https://n8n.<domeningiz>/rest/oauth2-credential/callback`.
   **Muhim:** consent screen "Testing" holatida qolsa, refresh token 7 kundan keyin o'ladi va n8n'dagi Google ulanish uziladi. Ishlab chiqarishga (*In production*) o'tkazing. Faqat o'zingiz ishlatasiz, tekshiruv talab qilinmaydi, "unverified app" ogohlantirishi chiqadi, davom eting.
3. **Google Sheets:** yangi jadval yarating (ustunlar `docs/BOOKING-N8N.md` da), ID'sini n8n workflow'ga kiriting.
4. **Cloudflare Turnstile** (bepul): site key va secret key oling.
5. **DNS:** `abduvaxobov.uz`, `www.`, `admin.`, `api.` va `n8n.` (hammasi `abduvaxobov.uz` ostida) uchun A yozuvlarini VPS IP'siga yo'naltiring. `.env` da: `APP_URL=https://abduvaxobov.uz`, `ADMIN_URL=https://admin.abduvaxobov.uz`, `NEXT_PUBLIC_API_URL=https://api.abduvaxobov.uz` (oxirgisi va `APP_URL` Docker build vaqtida kerak). Certbot: `-d abduvaxobov.uz -d www.abduvaxobov.uz -d admin.abduvaxobov.uz -d api.abduvaxobov.uz -d n8n.abduvaxobov.uz`.
6. **Resume PDF:** Docs'dagi Full-Stack resumeni PDF qilib yuklab oling va admin paneldan yuklang.
7. **Vivasam va Real School:** `seed/seed-data.json` da `visible:false`. Har biri uchun tavsif yozing (uz/ru/en tarjimani Claude Code qiladi) va adminkadan yoqing. Dormix, ticket sayti va Game Bar CRM uchun stack va natija ma'lumotini qo'shing.

## Yangi loyiha qo'shish (keyinchalik)

Eng oson yo'l: admin panel → Loyihalar → Yangi. Muqobil: `seed/seed-data.json` ga yozing va `pnpm seed` ishga tushiring (mavjud yozuvlarni **bosib ketmaydi**, faqat yo'qlarini qo'shadi).
