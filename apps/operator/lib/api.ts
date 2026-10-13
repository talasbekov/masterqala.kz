const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Ошибка ${res.status}`, res.status);
  }
  return res.status === 204 ? null : res.json();
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path: string, options: RequestInit = {}) {
  if(options.signal?.aborted)throw new DOMException('Request cancelled','AbortError');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  return handle(res);
}

export async function apiBlob(path: string, options: {signal?: AbortSignal} = {}): Promise<{ blob: Blob; contentType: string | null }> {
  if(options.signal?.aborted)throw new DOMException('Request cancelled','AbortError');
  const res = await fetch(`${API}${path}`, { signal: options.signal, headers: { ...authHeaders() } });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Файл не найден' : `Ошибка ${res.status}`);
  }
  const blob = await res.blob();
  if(options.signal?.aborted)throw new DOMException('Request cancelled','AbortError');
  return { blob, contentType: res.headers.get('Content-Type') };
}
