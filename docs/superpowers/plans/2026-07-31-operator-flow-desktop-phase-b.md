# Оператор (desktop), Цикл B — Фаза B: Верификация, Пользователи, Мастера — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать в `apps/operator` три раздела панели оператора:
«Верификация» (список анкет мастеров + деталь + просмотр документов +
решение approve/reject/needs-info), «Пользователи» (список + блокировка/
разблокировка) и «Мастера» (read-only список с фильтрами) — поверх уже
существующего API (`/admin/applications`, `/admin/users`, `/admin/masters`).

**Architecture:** Тот же паттерн `lib/<domain>.ts` (типы + функции запросов)
+ `app/(app)/<route>/page.tsx` (client component, сам управляет своим
состоянием), что уже установлен Фазой A для `lib/metrics.ts`/Обзора.
Раздел «Верификация» впервые в проекте реализует реальный просмотр
авторизованного файла (fetch+blob+`createObjectURL`, а не серые
плейсхолдеры, как для фото заказов/споров в `apps/client`) — эндпоинт
`GET /admin/applications/:id/documents/:docId` требует `Authorization`,
обычный `<img src>` не подходит.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
(`@masterqala/ui/tokens.css`).

## Global Constraints

- Ни одного нового бэкенд-эндпоинта — только уже существующие
  `/admin/applications`, `/admin/users`, `/admin/masters`, `/categories`.
- Без i18n, без сокетов (те же ограничения, что в Фазе A).
- Без фреймворка фронтенд-тестов — верификация каждой задачи: `pnpm
  --filter operator build` + живая браузерная проверка через preview-тул,
  где явно указано.
- Дизайн-токены — только классы из `@masterqala/ui/tokens.css` (тот же
  список, что уже используется в Фазе A: `bg-background`, `bg-surface`,
  `text-ink`, `text-ink-soft`, `text-primary`, `text-danger`,
  `bg-danger-bg`, `text-success`, `bg-success-bg`, `text-warning-ink`,
  `border-border`, `bg-fill-soft`, `bg-fill-faint`, `rounded-md`,
  `rounded-lg`, `rounded-pill`).
- Ни один из трёх эндпоинтов не поддерживает серверную пагинацию —
  полагаемся на фильтры/поиск, без клиентского пейджера (тот же выбор,
  что уже принят для «Заказов» в Фазе A).
- **Логин при живой проверке:** SMS-OTP запрос кода ограничен 3 отправками
  за 10 минут (`apps/api/src/auth/auth.service.ts`). Чтобы не потратить
  квоту на промахи по кнопкам, для живой проверки в этой фазе сразу
  используется проверенный в Фазе A путь: один `curl -X POST
  http://localhost:3001/api/v1/auth/verify-code` с кодом из логов
  `relaxed-api`, затем `localStorage.setItem('token', ...)` /
  `localStorage.setItem('user', ...)` через `preview_eval` с телом ответа
  — экономит ретраи и не проверяет заново форму логина (она уже
  живьём проверена в Фазе A, вне скоупа этой фазы).
- Тестовый оператор `+77000000001` уже существует в локальной БД (создан в
  Фазе A через `cd apps/api && pnpm exec prisma db seed`, использует
  `OPERATOR_PHONE` из `apps/api/.env`) — повторно сидить не нужно, если
  аккаунт уже есть (`prisma db seed` идемпотентен, можно перезапустить,
  если сомневаетесь).

---

## Файловая структура Фазы B

```
apps/operator/
  lib/
    api.ts              # MODIFY: добавить apiBlob()
    verification.ts     # NEW
    users.ts            # NEW
    masters.ts          # NEW
  components/
    Lightbox.tsx         # NEW
  app/(app)/
    verification/page.tsx  # NEW
    users/page.tsx          # NEW
    masters/page.tsx        # NEW
```

---

### Task 1: `apiBlob` в `lib/api.ts` + `lib/verification.ts` + `components/Lightbox.tsx`

**Files:**
- Modify: `apps/operator/lib/api.ts`
- Create: `apps/operator/lib/verification.ts`
- Create: `apps/operator/components/Lightbox.tsx`

**Interfaces:**
- Consumes: ничего нового (только уже существующий `authHeaders()` внутри
  `lib/api.ts`, используется напрямую, не экспортируется отдельно).
- Produces: `apiBlob(path: string): Promise<{ blob: Blob; contentType:
  string | null }>` из `lib/api.ts` — используется `Lightbox` (эта же
  задача) и любым будущим разделом с файлами.
- Produces: типы `MasterStatus`, `DecisionType`, `DocumentType`,
  `DOCUMENT_TYPE_LABELS`, `MASTER_STATUS_LABELS`, интерфейсы
  `ApplicationListItem`, `ApplicationDocument`, `ApplicationDecisionRecord`,
  `ApplicationDetail`, функции `fetchApplications()`,
  `fetchApplication(id)`, `decideApplication(id, decision, comment?)`,
  `documentIsViewable(doc)` из `lib/verification.ts` — используются Task 2.
- Produces: `<Lightbox path title onClose>` из `components/Lightbox.tsx` —
  используется Task 2.

- [ ] **Step 1: Добавить `apiBlob` в `lib/api.ts`**

Дописать в конец файла (после существующей функции `api`, саму функцию
`api` и `authHeaders` не менять):

```ts
export async function apiBlob(path: string): Promise<{ blob: Blob; contentType: string | null }> {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Файл не найден' : `Ошибка ${res.status}`);
  }
  const blob = await res.blob();
  return { blob, contentType: res.headers.get('Content-Type') };
}
```

Без `Content-Type: application/json` в заголовках запроса — это GET без
тела, серверу нечего парсить как JSON, а сам ответ мы читаем как `blob()`,
не `json()`.

- [ ] **Step 2: Создать `lib/verification.ts`**

Типы и поля дословно сверены с `apps/api/prisma/schema.prisma`
(`MasterProfile`, `MasterDocument`, `VerificationDecision`) и
`apps/api/src/admin/admin.service.ts` (`listApplications`/
`getApplication`/`decide` — `scanStatus`/`cdrStatus` в ответе `getApplication`
добавлены сервисом поверх модели, не часть схемы `MasterDocument`
напрямую). Словарь типов документов переиспользует значения из
`apps/master/lib/masterApplication.ts:37-40` (`DOCUMENT_TYPES`) — тот же
набор, что мастер видит при загрузке анкеты, не выдумывается заново.

```ts
import { api } from './api';

export type MasterStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';
export type DecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
export type DocumentType = 'ID_CARD' | 'QUALIFICATION';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ID_CARD: 'Удостоверение личности',
  QUALIFICATION: 'Подтверждение квалификации',
};

export const MASTER_STATUS_LABELS: Record<MasterStatus, string> = {
  PENDING_REVIEW: 'на проверке',
  NEEDS_INFO: 'нужны данные',
  ACTIVE: 'активен',
  REJECTED: 'отклонён',
};

export interface ApplicationListItem {
  id: string;
  fullName: string;
  district: string;
  status: MasterStatus;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
}

export interface ApplicationDocument {
  id: string;
  masterProfileId: string;
  type: DocumentType;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  scanStatus: string;
  scannedAt: string | null;
  cdrStatus: string;
}

export interface ApplicationDecisionRecord {
  decision: DecisionType;
  comment: string | null;
  createdAt: string;
  operator: { name: string | null; phone: string };
}

export interface ApplicationDetail {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: MasterStatus;
  rejectionReason: string | null;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
  documents: ApplicationDocument[];
  decisions: ApplicationDecisionRecord[];
}

export function fetchApplications(): Promise<ApplicationListItem[]> {
  return api('/admin/applications');
}

export function fetchApplication(id: string): Promise<ApplicationDetail> {
  return api(`/admin/applications/${id}`);
}

export async function decideApplication(id: string, decision: DecisionType, comment?: string): Promise<void> {
  await api(`/admin/applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
  });
}

/**
 * Отражает гейт бэкенда в `AdminService.getDocumentStream` — до того, как
 * оба условия выполнены, запрос файла вернёт 404, значит не показываем
 * документ кликабельным.
 */
export function documentIsViewable(doc: ApplicationDocument): boolean {
  return doc.scanStatus === 'CLEAN' && ['NOT_REQUIRED', 'SANITIZED', 'BYPASSED'].includes(doc.cdrStatus);
}
```

`decideApplication` намеренно типизирован как `Promise<void>` — бэкенд
возвращает голый `MasterProfile` (без `documents`/`decisions`/`user`/
`categories`), не `ApplicationDetail`; после решения деталь перезапрашивается
целиком через `fetchApplication` (Task 2), а не берётся из ответа
`decide`.

- [ ] **Step 3: Создать `components/Lightbox.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiBlob } from '@/lib/api';

export function Lightbox({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setState('loading');

    apiBlob(path)
      .then(({ blob, contentType }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        if ((contentType ?? '').startsWith('image/')) {
          setObjectUrl(url);
          setState('ready');
        } else {
          window.open(url, '_blank');
          onClose();
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorMessage((e as Error).message);
        setState('error');
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        className="max-h-full max-w-3xl overflow-auto rounded-lg bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-6">
          <span className="text-sm font-extrabold text-ink">{title}</span>
          <button type="button" onClick={onClose} className="text-sm font-bold text-ink-soft">
            Закрыть ✕
          </button>
        </div>
        {state === 'loading' && <div className="p-8 text-center text-ink-soft">Загрузка…</div>}
        {state === 'error' && <div className="p-8 text-center text-danger">Ошибка: {errorMessage}</div>}
        {state === 'ready' && objectUrl && (
          <img src={objectUrl} alt={title} className="max-h-[70vh] max-w-full" />
        )}
      </div>
    </div>
  );
}
```

Для PDF (`contentType` не начинается с `image/`) компонент открывает файл
в новой вкладке через `window.open` и сразу вызывает `onClose()` — модалка
не остаётся висеть пустой. `URL.revokeObjectURL` в cleanup-функции
эффекта освобождает blob-URL и при закрытии, и при размонтировании
(смене документа), не копит память.

- [ ] **Step 4: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок (новые файлы пока никем не
импортируются в маршруты, но должны компилироваться сами по себе —
`Lightbox` компилируется как часть графа типов, даже не будучи
подключённым ни к одной странице).

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/api.ts apps/operator/lib/verification.ts apps/operator/components/Lightbox.tsx
git commit -m "feat(operator): apiBlob + типы/API-вызовы верификации + компонент Lightbox"
```

---

### Task 2: Раздел «Верификация» — список, деталь, документы, решение

**Files:**
- Create: `apps/operator/app/(app)/verification/page.tsx`

**Interfaces:**
- Consumes: всё из `lib/verification.ts` и `components/Lightbox.tsx`
  (Task 1), `useOperatorMetrics` из `lib/operatorMetrics.tsx` (Фаза A, для
  `refetch()` бейджа после решения).

- [ ] **Step 1: Создать `app/(app)/verification/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  fetchApplications,
  fetchApplication,
  decideApplication,
  documentIsViewable,
  DOCUMENT_TYPE_LABELS,
  MASTER_STATUS_LABELS,
  type ApplicationListItem,
  type ApplicationDetail,
  type MasterStatus,
  type DecisionType,
} from '@/lib/verification';
import { Lightbox } from '@/components/Lightbox';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const STATUS_FILTERS: { value: MasterStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все статусы' },
  { value: 'PENDING_REVIEW', label: 'на проверке' },
  { value: 'NEEDS_INFO', label: 'нужны данные' },
  { value: 'ACTIVE', label: 'активен' },
  { value: 'REJECTED', label: 'отклонён' },
];

function formatWaiting(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return hours < 24 ? `ждёт ${hours} ч` : `ждёт ${Math.floor(hours / 24)} дн`;
}

export default function VerificationPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<MasterStatus | 'ALL'>('ALL');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState('');
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);

  async function loadList() {
    try {
      const rows = await fetchApplications();
      setApplications(rows);
      setListError('');
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchApplication(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setComment('');
        setDecideError('');
      })
      .catch((e) => {
        if (!cancelled) setListError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = applications.filter((a) => statusFilter === 'ALL' || a.status === statusFilter);

  async function submitDecision(decision: DecisionType) {
    if (!selectedId) return;
    if (decision !== 'APPROVE' && !comment.trim()) return;
    setDeciding(true);
    setDecideError('');
    try {
      await decideApplication(selectedId, decision, comment.trim() || undefined);
      const [updated] = await Promise.all([fetchApplication(selectedId), loadList()]);
      setDetail(updated);
      setComment('');
      refetchMetrics();
    } catch (e) {
      setDecideError((e as Error).message);
    } finally {
      setDeciding(false);
    }
  }

  const needComment = !comment.trim();

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Верификация</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MasterStatus | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {listError && <div className="text-sm text-danger">{listError}</div>}

      <div className="flex gap-4">
        <div className="flex w-[300px] shrink-0 flex-col gap-2">
          {listLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {!listLoading && filtered.length === 0 && <div className="text-sm text-ink-soft">Пусто</div>}
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={`rounded-lg border-2 bg-surface p-3 text-left ${
                selectedId === a.id ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-ink">{a.fullName}</span>
                <span className="rounded-pill bg-fill-soft px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  {MASTER_STATUS_LABELS[a.status]}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-ink-soft">
                {a.categories.map((c) => c.category.name).join(', ')} · {formatWaiting(a.createdAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-surface p-5">
          {!selectedId && <div className="text-sm text-ink-soft">Выберите анкету слева</div>}
          {selectedId && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selectedId && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-extrabold text-ink">
                  {detail.fullName} · ИИН {detail.iin}
                </span>
                <span className="rounded-pill bg-fill-soft px-3 py-1 text-xs font-extrabold text-primary">
                  {MASTER_STATUS_LABELS[detail.status]}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Опыт</div>
                  <div className="text-sm font-extrabold text-ink">{detail.experienceYears} лет</div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Категории</div>
                  <div className="text-sm font-extrabold text-ink">
                    {detail.categories.map((c) => c.category.name).join(', ')}
                  </div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Геозона</div>
                  <div className="text-sm font-extrabold text-ink">{detail.district}</div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Телефон</div>
                  <div className="text-sm font-extrabold text-ink">
                    +7 ··· {detail.user.phone.replace(/\D/g, '').slice(-4)}
                  </div>
                </div>
              </div>

              <div className="text-sm font-extrabold text-ink">Документы</div>
              <div className="flex flex-wrap gap-2.5">
                {detail.documents.map((doc) => {
                  const viewable = documentIsViewable(doc);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      disabled={!viewable}
                      onClick={() =>
                        setOpenDoc({
                          id: doc.id,
                          title: DOCUMENT_TYPE_LABELS[doc.type],
                        })
                      }
                      className="flex w-[170px] flex-col gap-1 rounded-md border border-border bg-fill-faint p-2.5 text-left disabled:opacity-50"
                    >
                      <span className="text-xs font-extrabold text-ink">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                      <span className="text-[11px] text-ink-soft">
                        {viewable ? 'открыть ⤢' : `проверка: ${doc.scanStatus.toLowerCase()}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {detail.status !== 'PENDING_REVIEW' ? (
                <div className="rounded-md bg-fill-soft p-3 text-sm font-bold text-ink">
                  {detail.status === 'ACTIVE' && '✓ Мастер одобрен и активирован.'}
                  {detail.status === 'NEEDS_INFO' && '📎 Запрошены дополнительные данные.'}
                  {detail.status === 'REJECTED' && `✕ Заявка отклонена. ${detail.rejectionReason ?? ''}`}
                </div>
              ) : (
                <>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Комментарий решения — обязателен при отказе или запросе данных"
                    className="min-h-16 rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
                  />
                  {decideError && <div className="text-sm text-danger">{decideError}</div>}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => submitDecision('APPROVE')}
                      className="rounded-pill bg-success px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      disabled={deciding || needComment}
                      onClick={() => submitDecision('REQUEST_INFO')}
                      className="rounded-pill border-[1.5px] border-primary px-4 py-2 text-sm font-extrabold text-primary disabled:opacity-40"
                    >
                      Запросить данные
                    </button>
                    <button
                      type="button"
                      disabled={deciding || needComment}
                      onClick={() => submitDecision('REJECT')}
                      className="rounded-pill border-[1.5px] border-danger px-4 py-2 text-sm font-extrabold text-danger disabled:opacity-40"
                    >
                      Отклонить
                    </button>
                    {needComment && (
                      <span className="text-xs font-bold text-warning-ink">
                        для отказа/запроса нужен комментарий
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {openDoc && selectedId && (
        <Lightbox
          path={`/admin/applications/${selectedId}/documents/${openDoc.id}`}
          title={openDoc.title}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Подготовить реальную анкету с документом для живой проверки**

Через `apps/client`/`apps/master` реальный флоу быстрее и надёжнее прямых
SQL-вставок (гарантирует, что файл физически существует на диске и
`scanStatus` дойдёт до `CLEAN` через настоящий пайплайн проверки, а не
рассинхронизируется с БД):

1. Запустить `relaxed-api` и `relaxed-master` (`preview_start`), если ещё
   не запущены.
2. В `apps/master` войти новым тестовым номером (например
   `7010009000`), пройти `/become-master`, заполнить анкету (любая
   категория), загрузить хотя бы один документ типа «Удостоверение
   личности» (реальный файл — подойдёт любое маленькое изображение).
3. Подождать/убедиться, что скан документа завершился (`scanStatus`
   станет `CLEAN` — в деве скан обычно завершается за секунды,
   синхронный мок-сканер).

- [ ] **Step 4: Живая проверка раздела «Верификация»**

Войти оператором (`7000000001`, curl+localStorage — см. Global
Constraints), открыть `http://localhost:4400/verification`.

- Убедиться, что анкета из Step 3 видна в списке слева со статусом «на
  проверке» и корректной меткой ожидания.
- Кликнуть по ней — деталь справа показывает ИИН/опыт/категории/район/
  маскированный телефон.
- Кликнуть по плитке загруженного документа — должен открыться реальный
  **Lightbox** с картинкой (не плейсхолдер, не ошибка) — это ключевая
  проверка задачи, подтверждающая, что `fetch+blob+Authorization` реально
  работает сквозь бэкенд. Закрыть лайтбокс.
- Ввести комментарий, нажать «Одобрить» — убедиться, что деталь
  обновилась (статус «активен», баннер решения), анкета пропала из
  фильтра «на проверке» (или список отразил новый статус), а бейдж
  «Верификация» в сайдбаре уменьшился на 1 (сверить с `/admin/metrics`
  через `preview_network`, если бейдж не обновился визуально сразу).
- Отдельно (на другой тестовой анкете, если время позволяет, или тем же
  файлом через новый тестовый номер) проверить, что «Отклонить»/«Запросить
  данные» задизейблены без комментария и включаются при его вводе.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/app/\(app\)/verification
git commit -m "feat(operator): раздел Верификация — список, деталь, документы, решение"
```

---

### Task 3: Раздел «Пользователи» — список, блокировка, разблокировка

**Files:**
- Create: `apps/operator/lib/users.ts`
- Create: `apps/operator/app/(app)/users/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза A).
- Produces: `interface OperatorUserRow`, `fetchUsers(search?)`,
  `blockUser(id, reason)`, `unblockUser(id)` из `lib/users.ts`.

- [ ] **Step 1: Создать `lib/users.ts`**

Поле `role` в ответе `GET /admin/users` — уже готовая человеко-читаемая
строка (`'клиент'`/`'клиент + мастер'`), вычисленная бэкендом
(`AdminUsersService.list`), не enum `UserRole` — не путать с
`AuthUser.role` из `lib/auth.tsx` (Фаза A), это разные поля разных
сущностей. `block`/`unblock` возвращают сырую модель `User` (другая форма,
без поля `role`-строки) — она этой странице не нужна, оба вызова
типизированы как `Promise<void>`, страница просто перезапрашивает список
после успеха.

```ts
import { api } from './api';

export interface OperatorUserRow {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  orders: number;
  isBlocked: boolean;
}

export function fetchUsers(search?: string): Promise<OperatorUserRow[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return api(`/admin/users${query}`);
}

export async function blockUser(id: string, reason: string): Promise<void> {
  await api(`/admin/users/${id}/block`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function unblockUser(id: string): Promise<void> {
  await api(`/admin/users/${id}/unblock`, { method: 'POST' });
}
```

- [ ] **Step 2: Создать `app/(app)/users/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetchUsers, blockUser, unblockUser, type OperatorUserRow } from '@/lib/users';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OperatorUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockTarget, setBlockTarget] = useState<OperatorUserRow | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load(currentSearch: string) {
    try {
      const data = await fetchUsers(currentSearch.trim() || undefined);
      setRows(data);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(search), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function confirmBlock() {
    if (!blockTarget || !reason.trim()) return;
    setSubmitting(true);
    try {
      await blockUser(blockTarget.id, reason.trim());
      setBlockTarget(null);
      setReason('');
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock(id: string) {
    try {
      await unblockUser(id);
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Пользователи</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по телефону/имени"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_170px_140px_100px_140px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Пользователь</span>
          <span>Телефон</span>
          <span>Роль</span>
          <span>Заказов</span>
          <span></span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_170px_140px_100px_140px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span>
              {row.name ?? '—'}
              {row.isBlocked && (
                <span className="ml-2 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] font-extrabold text-danger">
                  заблокирован
                </span>
              )}
            </span>
            <span className="text-ink-soft">{row.phone}</span>
            <span>{row.role}</span>
            <span>{row.orders}</span>
            <span>
              {row.isBlocked ? (
                <button
                  type="button"
                  onClick={() => handleUnblock(row.id)}
                  className="rounded-pill border-[1.5px] border-success px-3 py-1 text-xs font-extrabold text-success"
                >
                  Разблокировать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBlockTarget(row);
                    setReason('');
                  }}
                  className="rounded-pill border-[1.5px] border-danger px-3 py-1 text-xs font-extrabold text-danger"
                >
                  Заблокировать
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {blockTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setBlockTarget(null)}
        >
          <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-base font-extrabold text-ink">
              Заблокировать {blockTarget.name ?? blockTarget.phone}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина блокировки — обязательна"
              className="mb-3 min-h-20 w-full rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmBlock}
                disabled={!reason.trim() || submitting}
                className="rounded-pill bg-danger px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Подтвердить
              </button>
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Пользователи»**

Войти оператором (`7000000001`, curl+localStorage), открыть
`http://localhost:4400/users`.

- Убедиться, что список непустой (в БД уже есть тестовые клиенты/мастера
  из прошлых живых проверок этой и Фазы A сессий).
- Ввести часть номера/имени в поиск, подождать debounce, убедиться, что
  список отфильтровался.
- Нажать «Заблокировать» у любого не заблокированного пользователя,
  попробовать подтвердить без причины — кнопка должна быть задизейблена;
  ввести причину, подтвердить — модалка закрывается, строка в таблице
  показывает бейдж «заблокирован» и кнопку «Разблокировать».
- Нажать «Разблокировать» — бейдж пропадает, кнопка возвращается к
  «Заблокировать».

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/users.ts apps/operator/app/\(app\)/users
git commit -m "feat(operator): раздел Пользователи — список, блокировка, разблокировка"
```

---

### Task 4: Раздел «Мастера» — read-only список с фильтрами

**Files:**
- Create: `apps/operator/lib/masters.ts`
- Create: `apps/operator/app/(app)/masters/page.tsx`

**Interfaces:**
- Consumes: `api` из `lib/api.ts` (Фаза A).
- Produces: `interface Category`, `interface OperatorMasterRow`,
  `fetchCategories()`, `fetchMasters(category?, district?)` из
  `lib/masters.ts`.

- [ ] **Step 1: Создать `lib/masters.ts`**

`fetchCategories` дублирует по смыслу одноимённую функцию в
`apps/master/lib/masterApplication.ts` — согласно уже принятому в проекте
соглашению («каждое приложение определяет свой `lib`, общий пакет — только
токены/`EmptyState`/иконки»), не выносится в общий пакет.

```ts
import { api } from './api';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface OperatorMasterRow {
  id: string;
  categories: string[];
  orders: number;
  status: string;
  name: string | null;
  rating: number | null;
  reviewCount: number;
}

export function fetchCategories(): Promise<Category[]> {
  return api('/categories');
}

export function fetchMasters(category?: string, district?: string): Promise<OperatorMasterRow[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (district) params.set('district', district);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api(`/admin/masters${query}`);
}
```

`category` в query — это `slug`, не `id` (сверено с `AdminMastersController.
list(@Query('category') category)` → `AdminMastersService.list(categorySlug,
district)` → `categories: { some: { category: { slug: categorySlug } } }`).

- [ ] **Step 2: Создать `app/(app)/masters/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetchCategories, fetchMasters, type Category, type OperatorMasterRow } from '@/lib/masters';

export default function MastersPage() {
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<OperatorMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchMasters(category || undefined, district.trim() || undefined)
        .then((data) => {
          setRows(data);
          setError('');
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [category, district]);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Мастера</div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="Район (точное совпадение)"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_170px_100px_100px_180px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Мастер</span>
          <span>Категории</span>
          <span>Рейтинг</span>
          <span>Заказов</span>
          <span>Статус</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_170px_100px_100px_180px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span>{row.name ?? '—'}</span>
            <span className="text-ink-soft">{row.categories.join(', ')}</span>
            <span>{row.rating === null ? '—' : `★ ${row.rating.toFixed(1)}`}</span>
            <span>{row.orders}</span>
            <span className="text-ink-soft">{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm --filter operator build`
Expected: сборка проходит без ошибок.

- [ ] **Step 4: Живая проверка раздела «Мастера»**

Войти оператором (`7000000001`, curl+localStorage), открыть
`http://localhost:4400/masters`.

- Убедиться, что список непустой (активные тестовые мастера из прошлых
  живых проверок уже есть в БД).
- Выбрать категорию из дропдауна — список сужается до мастеров этой
  категории.
- Ввести точный район в текстовое поле (например район одного из
  видимых мастеров) — список сужается до совпадения; ввести
  несуществующий район — список пустеет («Ничего не найдено»).
- Убедиться, что раздел полностью read-only — ни одной кнопки действия в
  строках.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/lib/masters.ts apps/operator/app/\(app\)/masters
git commit -m "feat(operator): раздел Мастера — read-only список с фильтрами"
```

---

## Итог Фазы B

После выполнения всех 4 задач: разделы «Верификация» (первая в проекте
реальная авторизованная загрузка/просмотр файла), «Пользователи» и
«Мастера» полностью рабочие поверх уже существующего API. Оставшиеся 5
разделов («Заказы», «Журнал» — Фаза C; «Споры», «Вывод средств»,
«Безопасность» — Фаза D) получат свои планы непосредственно перед
реализацией, как решено в спеке Цикла B.
