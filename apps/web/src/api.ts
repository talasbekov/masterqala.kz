const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Ошибка ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function authHeaders(): Record<string, string> {
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

type UploadScanResponse = {
  path: string;
  statusPath?: string;
  scanStatus: 'PENDING_SCAN' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
  [key: string]: unknown;
};

function isUploadScanResponse(value: unknown): value is UploadScanResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.path === 'string' && typeof candidate.scanStatus === 'string';
}

async function waitForUploadScan(initial: UploadScanResponse): Promise<UploadScanResponse> {
  let current = initial;
  const deadline = Date.now() + 30_000;

  while (true) {
    if (current.scanStatus === 'CLEAN') return current;
    if (current.scanStatus === 'INFECTED') {
      throw new Error('Файл отклонён проверкой безопасности');
    }
    if (current.scanStatus === 'SCAN_FAILED') {
      throw new Error('Не удалось проверить файл. Повторите загрузку');
    }
    if (Date.now() >= deadline) {
      throw new Error('Проверка файла занимает слишком много времени. Повторите попытку позже');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 750));
    const statusPath = current.statusPath ?? `/uploads/${encodeURIComponent(current.path)}/status`;
    current = await api(statusPath);
  }
}

export async function apiUpload(path: string, formData: FormData) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  const result = await handle(res);
  return isUploadScanResponse(result) ? waitForUploadScan(result) : result;
}
