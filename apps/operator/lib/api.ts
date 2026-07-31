const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Ошибка ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  return handle(res);
}

export async function apiBlob(path: string): Promise<{ blob: Blob; contentType: string | null }> {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Файл не найден' : `Ошибка ${res.status}`);
  }
  const blob = await res.blob();
  return { blob, contentType: res.headers.get('Content-Type') };
}
