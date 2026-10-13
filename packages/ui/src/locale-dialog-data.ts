import type {Locale} from './locale-data';
export type {Locale} from './locale-data';
export const LOCALES = ['ru', 'kk', 'en'] as const;
export function isLocale(value: unknown): value is Locale { return value==='ru'||value==='kk'||value==='en'; }
export const LOCALE_COPY = {
  ru: { title: 'Язык интерфейса', note: 'Язык интерфейса не переводит переписку и описания клиентов.', close: 'Закрыть' },
  kk: { title: 'Интерфейс тілі', note: 'Интерфейс тілі хат алмасуды және клиенттердің сипаттамаларын аудармайды.', close: 'Жабу' },
  en: { title: 'Interface language', note: 'The interface language does not translate messages or customer descriptions.', close: 'Close' },
} satisfies Record<Locale, { title: string; note: string; close: string }>;
