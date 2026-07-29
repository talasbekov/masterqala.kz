export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000/api/v1';
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:5173';
}

export function getContactPhone(): string {
  return process.env.CONTACT_PHONE ?? '+7 700 000 00 01 (заменить на реальный номер оператора перед запуском)';
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL ?? 'support@masterqala.kz (заменить на реальный адрес перед запуском)';
}
