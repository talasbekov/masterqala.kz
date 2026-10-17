/** Astana follows the Asia/Almaty IANA zone, including historical offset changes. */
export const SERVICE_TIME_ZONE = 'Asia/Almaty';
const kazakhMonths = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
] as const;

/** Keep Intl's date order and time calculations, but supply missing Kazakh month data. */
export function formatServiceDate(
  value: Date | number,
  language: string,
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  const kazakh = language.startsWith('kk');
  const locale = kazakh ? 'kk-KZ' : language.startsWith('en') ? 'en-GB' : 'ru-RU';
  const formatter = new Intl.DateTimeFormat(locale, {...options, timeZone: SERVICE_TIME_ZONE});
  if (!kazakh || options.month !== 'long') return formatter.format(value);
  // Chromium may support kk yet return M01..M12. A numeric month in the same
  // zone also avoids selecting the wrong month around UTC midnight/year-end.
  const month = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: SERVICE_TIME_ZONE, month: 'numeric',
  }).format(value));
  return formatter.formatToParts(value)
    .map(part => part.type === 'month' ? kazakhMonths[month - 1] : part.value)
    .join('');
}
