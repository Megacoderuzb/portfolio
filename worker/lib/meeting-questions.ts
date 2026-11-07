// Static copy of docs/MEETING-QUESTIONS.md (Uzbek). Questions are listed most important first.

type Purpose = "JOB_OFFER" | "FREELANCE" | "NETWORKING" | "OTHER";

export const QUESTIONS = {
  general: [
    "Uchrashuvdan nimani kutasiz? Qanday natija sizni qoniqtiradi?",
    "Qaror qabul qiluvchi shaxs kim va qachongacha qaror chiqadi?",
  ],
  purpose: {
    JOB_OFFER: [
      "Lavozim nomi va jamoa tarkibi qanday? Kimga hisobot beraman?",
      "Asosiy stack va loyiha turi (mahsulot / autsorsing)?",
      "Ish formati: masofaviy, ofis yoki gibrid? Ish soatlari?",
      "Tanlov jarayoni: qanday bosqichlar va qancha vaqt oladi?",
      "Sinov muddati, rivojlanish imkoniyatlari, o'qish/kurslar qo'llab-quvvatlanadimi?",
      "Boshlash sanasi va muddatlar.",
    ],
    FREELANCE: [
      "Loyiha maqsadi va kim foydalanadi (auditoriya)?",
      "Hozir tayyor narsa bormi (dizayn, tizim, texnik vazifa)?",
      "Muddat va muhim sana (launch, tadbir)?",
      "Byudjet doirasi va to'lov tartibi qanday?",
      "Integratsiyalar kerakmi (to'lov, SMS, 1C, Telegram)?",
      "Loyihadan keyin qo'llab-quvvatlash va hosting kim zimmasida?",
      "Qaror qabul qiluvchi va ish jarayonidagi aloqa kanali (Telegram, Meet)?",
    ],
    NETWORKING: [
      "Siz kim va qanday sohada ishlaysiz?",
      "Qaysi mavzu bo'yicha tanishmoqchisiz (karyera, hamkorlik, tajriba almashish)?",
      "Birgalikda qilish mumkin bo'lgan narsa bormi (loyiha, jamoa, tadbir)?",
      "Keyingi aloqa kanali va qachon yana gaplashamiz?",
    ],
    OTHER: ["Uchrashuv mavzusini aniqlashtirib oling: asosiy savol nima?", "Qanday natija bilan chiqib ketmoqchisiz?"],
  } satisfies Record<Purpose, string[]>,
  service: {
    "landing-corporate": [
      "Sayt maqsadi: lead yig'ish, kompaniya haqida, mahsulot katalogi?",
      "Nechta sahifa va qaysi tillar (uz/ru/en)?",
      "Dizayn va kontent tayyormi? Brend materiallari bormi?",
      "Domen, hosting va SEO talablari?",
      "CMS/admin kerakmi (yangiliklar, mahsulotlar)?",
    ],
    "crm-pms": [
      "Hozirgi jarayon qanday (Excel, daftar, boshqa tizim)? Qaysi qismi og'riqli?",
      "Rollar: kim nima ko'radi va qila oladi?",
      "Asosiy modullar (mijozlar, to'lovlar, hisobotlar, xodimlar, filiallar)?",
      "Mavjud ma'lumotlarni ko'chirish (import) kerakmi?",
      "Hisobotlar va Excel eksport talablari?",
      "Telegram bot yoki bildirishnomalar kerakmi?",
    ],
    "ecommerce-ticketing": [
      "Nima sotiladi va nechta mahsulot/tadbir? Zaxira (qoldiq) hisobi kerakmi?",
      "To'lov usullari: Click, Payme, Uzum Bank, Atmos?",
      "Yetkazib berish yoki chipta tekshiruvi (QR) jarayoni qanday?",
      "Chegirma, promokod, referal tizimi kerakmi?",
      "Yuklama: kutilayotgan eng yuqori foydalanuvchi soni (masalan, chipta sotuvi ochilgan kun)?",
    ],
    "telegram-bots": [
      "Bot kim uchun: mijozlar, xodimlar yoki ikkalasi?",
      "Asosiy vazifalar (buyurtma, to'lov, hisobot, eslatma, test)?",
      "Mini App kerakmi yoki oddiy bot yetadimi?",
      "Admin panel va statistikalar kerakmi?",
      "Mavjud tizimlar bilan integratsiya (CRM, Sheets, to'lov)?",
    ],
    "automation-n8n": [
      "Qaysi jarayonlar qo'lda qilinmoqda va qancha vaqt oladi?",
      "Qaysi servislar bog'lanishi kerak (Sheets, Calendar, Telegram, CRM)?",
      "Ishga tushirish sharti: jadval bo'yicha, hodisa bo'yicha, webhook?",
      "Xatolik bo'lsa kim xabar oladi?",
      "n8n ni o'z serveringizda ishlatmoqchimisiz yoki biz joylaymizmi?",
    ],
    "backend-api": [
      "Mavjud tizim bormi yoki noldan quramizmi? Qaysi stack?",
      "Asosiy entitilar va foydalanuvchi rollari?",
      "Integratsiyalar, to'lov, navbatlar (queue), real-time (WebSocket) kerakmi?",
      "Hujjatlashtirish (Swagger), testlar, CI/CD talablari?",
      "Kutilayotgan yuklama va xavfsizlik talablari?",
    ],
  } as Record<string, string[]>,
};

/**
 * 3–6 questions, deterministic (most important first):
 * - with a known service: 1 general + up to 3 purpose + 2 service
 * - without one:          2 general + up to 4 purpose
 */
export function pickQuestions(purpose: Purpose, serviceSlug?: string | null) {
  const service = (serviceSlug && QUESTIONS.service[serviceSlug]) || [];
  const forPurpose = QUESTIONS.purpose[purpose] ?? [];
  return service.length
    ? [...QUESTIONS.general.slice(0, 1), ...forPurpose.slice(0, 3), ...service.slice(0, 2)]
    : [...QUESTIONS.general.slice(0, 2), ...forPurpose.slice(0, 4)];
}
