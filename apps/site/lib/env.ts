/*
 * og:image / twitter:image, один и тот же на все страницы.
 *
 * Файл лежит в public/, а не по конвенции app/opengraph-image.jpg — так
 * надёжнее. Пробовали конвенцию: Next подключает её автоматически только к
 * сегменту "/", потому что там page.tsx совпадает с самим каталогом app/, где
 * лежит файл. У вложенных страниц (faq, about, become-a-master,
 * categories/[slug]) свой export const metadata со своим openGraph — Next
 * заменяет им унаследованный объект целиком, а не сливает поля, и
 * унаследованная images пропадает молча, без ошибки сборки. Та же судьба у
 * twitter.card: 'summary_large_image' из layout — на страницах со своим
 * twitter-блоком card откатывается на дефолтный 'summary'.
 *
 * Поэтому здесь — обычный публичный файл и один объект, который каждая
 * страница подставляет в свои openGraph.images/twitter.images явно.
 */
export const OG_IMAGE = {
  url: '/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'MasterQala — мастер на дом в Астане',
};

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
