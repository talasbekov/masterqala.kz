export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000/api/v1';
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:5173';
}

/** Канонический адрес самого сайта — база для metadataBase, sitemap и robots. */
export function getSiteUrl(): string {
  return process.env.SITE_URL ?? 'https://masterqala.kz';
}

export function getContactPhone(): string {
  return process.env.CONTACT_PHONE ?? '+7 700 000 00 01 (заменить на реальный номер оператора перед запуском)';
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL ?? 'support@masterqala.kz (заменить на реальный адрес перед запуском)';
}

/*
 * Для structured data нужны только настоящие контакты: заглушка «заменить на
 * реальный номер» попала бы в разметку для поисковика как факт. Поэтому
 * JSON-LD берёт значения отсюда и опускает поле, если переменная не задана.
 */
export function getVerifiedContactPhone(): string | undefined {
  return process.env.CONTACT_PHONE;
}

export function getVerifiedContactEmail(): string | undefined {
  return process.env.CONTACT_EMAIL;
}
