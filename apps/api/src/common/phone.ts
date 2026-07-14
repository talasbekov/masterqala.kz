export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!/^(?:\+7|7|8)\d{10}$/.test(cleaned)) return null;
  return '+7' + cleaned.slice(-10);
}
