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

function throwIfCancelled(signal?:AbortSignal|null) {
  if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');
}

export async function api(path: string, options: RequestInit = {}) {
  throwIfCancelled(options.signal);
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

function scanDelay(signal?:AbortSignal):Promise<void> {
  throwIfCancelled(signal);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal?.removeEventListener('abort',cancel);
    const cancel=()=>{window.clearTimeout(timer);cleanup();reject(new DOMException('Request cancelled','AbortError'));};
    const timer=window.setTimeout(()=>{cleanup();resolve();},750);
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)cancel();
  });
}

async function waitForUploadScan(initial: UploadScanResponse,signal?:AbortSignal): Promise<UploadScanResponse> {
  let current = initial;
  const deadline = Date.now() + 30_000;

  while (true) {
    throwIfCancelled(signal);
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

    await scanDelay(signal);
    throwIfCancelled(signal);
    const statusPath = current.statusPath ?? `/uploads/${encodeURIComponent(current.path)}/status`;
    current = await api(statusPath,{signal});
  }
}

export async function apiUpload(path: string, formData: FormData, options: {signal?:AbortSignal} = {}) {
  throwIfCancelled(options.signal);
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    signal: options.signal,
    headers: authHeaders(),
    body: formData,
  });
  throwIfCancelled(options.signal);
  const result = await handle(res);
  throwIfCancelled(options.signal);
  return isUploadScanResponse(result) ? waitForUploadScan(result, options.signal) : result;
}
