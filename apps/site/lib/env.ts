export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000/api/v1';
}
function destination(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash
      ? url.toString().replace(/\/$/, '') : null;
  } catch { return null; }
}
export function getAppUrl(): string | null {
  return destination(process.env.APP_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined));
}
export function getMasterAppUrl(): string | null {
  return destination(process.env.MASTER_APP_URL);
}
export function getContactPhone(): string | null {
  const value = process.env.CONTACT_PHONE?.trim();
  return value && /^\+?[\d ()-]{7,30}$/.test(value) && value.replace(/\D/g, '').length >= 7 ? value : null;
}
export function getContactEmail(): string | null {
  const value = process.env.CONTACT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}
