# Мобильный ретрофит `apps/master`, Фаза D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильная вёрстка `/wallet` (баланс, вывод, история) и баннер блокировки (`MasterProfile.blockedUntil`) на `/become-master` — экраны прототипа «Кошелёк ₸», «Вывод», «Профиль» (без раздела «Профиль» как отдельного экрана — решение брейнсторминга уже принято, см. ниже).

**Architecture:** Как и в Фазе C — раскладки блочно похожи (список/форма без карты и сайдбара), поэтому используется **CSS-парность внутри одного компонента**, не форк на пару компонентов. `/wallet` остаётся отдельным роутом с той же логикой (`load`, `submit`, `savePayoutAccount` не меняются). Отдельный экран «Профиль» **не создаётся** — баннер блокировки добавляется прямо на `/become-master`, которая уже показывает всё, что прототип называет «Профиль» (статус заявки, документы, категории), за вычетом аватара/рейтинга/геозоны/поддержки/выхода — те не входят в эту фазу (см. Global Constraints).

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (токены в `packages/ui/src/tokens.css`), существующие `lib/masterApplication.ts`, `apps/master/app/(app)/wallet/page.tsx`, `apps/master/app/(app)/become-master/page.tsx`.

## Global Constraints

- Бэкенд (`apps/api`) не меняется. `MasterProfile.blockedUntil` уже отдаётся эндпоинтом `GET masters/application` — метод `getOwnApplication()` (`apps/api/src/masters/masters.service.ts:102-127`) делает `{...profile, ...}`, где `profile` — полная запись `MasterProfile` из Prisma (без `select`), т.е. `blockedUntil` уже приходит на фронтенд, просто не типизирован и не отображается. Аналогично `GET wallet/withdrawals` (`apps/api/src/wallet/wallet.service.ts:41-47`, без `select`) уже отдаёт `payoutPhone` на каждую запись — просто фронтенд-тип `Withdrawal` его не содержит.
- `MasterProfile.blockedUntil` выставляется **только** одним путём — 3-я отмена мастером за 30 дней (`apps/api/src/common/master-penalty.service.ts:44-68`, `penalizeForCancellation`). Причина блокировки в UI поэтому статична и всегда верна: «3 отмены заказов за 30 дней» — не нужен динамический текст причины.
- Минимальная сумма вывода — `MIN_WITHDRAWAL_TENGE = 5000` (`apps/api/src/wallet/wallet.constants.ts`), уже используется как `min="5000"` на существующем инпуте — источник цифр для быстрых чипов суммы.
- При статусе `FAILED` баланс возвращается автоматически (`apps/api/src/wallet/wallet.service.ts:114-120`, `if (result.status !== 'SUCCEEDED') { increment balance }`) — подтверждает точность копии прототипа «при отказе банка вернётся автоматически». При статусе `ERROR` баланс **не** возвращается автоматически (требует ручной сверки оператором) — копия про автовозврат к этому статусу не относится, поэтому в списке статусов для `ERROR` используется нейтральная формулировка «Уточняется», не «отклонено»/«возвращено».
- **Явно вне скоупа: полноценный экран «Профиль»** (аватар, рейтинг, геозона, «Мои споры», «Поддержка», «Выйти из аккаунта» — как в прототипе `scr.profile`). Решение брейнсторминга: `/become-master` уже покрывает функциональный эквивалент (статус/документы/категории); из прототипной версии «Профиль» переносится только баннер блокировки. Остальное — вне скоупа мобильного трека целиком, не только этой фазы.
- Тестирование — без фреймворка фронтенд-тестов (осознанный выбор всего проекта). Проверка: `tsc --noEmit` + `pnpm --filter master build`, затем живая браузерная проверка на 390px и десктопе.

---

### Task 1: Расширить `Application` под поле `blockedUntil`

**Files:**
- Modify: `apps/master/lib/masterApplication.ts`

**Interfaces:**
- Produces: `Application.blockedUntil: string | null` — уже отдаётся бэкендом (см. Global Constraints), интерфейс просто перестаёт быть уже фактического ответа.

- [ ] **Step 1: Добавить поле в интерфейс**

В `apps/master/lib/masterApplication.ts` замени интерфейс `Application`:

```ts
export interface Application {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: ApplicationStatus;
  rejectionReason: string | null;
  latestDecisionComment: string | null;
  blockedUntil: string | null;
  categories: { category: Category }[];
  documents: ApplicationDocument[];
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add apps/master/lib/masterApplication.ts
git commit -m "feat(master): добавить blockedUntil в Application"
```

---

### Task 2: Баннер блокировки на `/become-master`

**Files:**
- Modify: `apps/master/app/(app)/become-master/page.tsx`

**Interfaces:**
- Consumes: `Application.blockedUntil` (Task 1).

Логика (`load`, `submit`, `upload`, состояние формы) не меняется — только новый условный блок в JSX.

- [ ] **Step 1: Добавить баннер**

В `apps/master/app/(app)/become-master/page.tsx`, сразу после `<h1 className="text-xl font-extrabold text-ink">Анкета мастера</h1>` и перед блоком `{app && !editing && (...)}`, добавь:

```tsx
      {app?.blockedUntil && new Date(app.blockedUntil) > new Date() && (
        <div className="rounded-lg bg-danger-bg p-4">
          <div className="text-sm font-extrabold text-danger">
            ⛔ Доступ к новым заявкам ограничен до{' '}
            {new Date(app.blockedUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-danger">
            Причина: 3 отмены заказов за 30 дней. Текущий активный заказ можно завершить. Вопросы — в поддержку.
          </p>
        </div>
      )}
```

`new Date(app.blockedUntil) > new Date()` — банер показывается только пока блокировка активна; после истечения `blockedUntil` (прошедшая дата) баннер сам перестаёт рендериться без какого-либо серверного вызова или таймера — простое сравнение дат на каждом рендере достаточно (страница и так перезапрашивает `fetchApplication()` при каждом монтировании через `load()` в `useEffect`).

- [ ] **Step 2: Проверить типы и собрать**

Run: `pnpm --filter master exec tsc --noEmit && pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add "apps/master/app/(app)/become-master/page.tsx"
git commit -m "feat(master): баннер блокировки на /become-master"
```

---

### Task 3: Мобильная вёрстка `/wallet`

**Files:**
- Modify: `apps/master/app/(app)/wallet/page.tsx`

**Interfaces:**
- Produces: расширенный `Withdrawal` (добавлено поле `payoutPhone`, уже отдаётся бэкендом — см. Global Constraints).

Логика (`load`, `submit`, `savePayoutAccount`, состояние) не меняется — только отступы, быстрые чипы суммы, информационная плашка, стилизация истории бейджами, и исправление отсутствующей метки статуса `ERROR` (реальный пробел: `STATUS_LABELS` не содержит `ERROR`, хотя такой статус существует в `WithdrawalStatus`, — рендер вернул бы `undefined` в бейдж, если заявка когда-либо окажется в этом статусе; исправляется заодно, раз файл и так меняется для мобильной вёрстки).

Полностью замени содержимое файла:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
  ERROR: 'Уточняется',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-warning-bg text-warning-ink',
  PAID: 'bg-success-bg text-success-ink',
  FAILED: 'bg-danger-bg text-danger',
  ERROR: 'bg-danger-bg text-danger',
};

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  payoutPhone: string;
}

function maskPhone(phone: string): string {
  // +77011112233 → +7 701 ··· 22 33
  const digits = phone.replace('+7', '');
  return `+7 ${digits.slice(0, 3)} ··· ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}

export default function WalletPage() {
  const { payoutsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [payoutPhone, setPayoutPhone] = useState<string | null>(null);
  const [editingPayout, setEditingPayout] = useState(false);
  const [payoutInput, setPayoutInput] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  function load() {
    api('/wallet/balance')
      .then((r) => setBalance(r.balance))
      .catch((e) => setError((e as Error).message));
    api('/wallet/withdrawals')
      .then(setHistory)
      .catch((e) => setError((e as Error).message));
    api('/wallet/payout-account')
      .then((r) => setPayoutPhone(r.payoutPhone))
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    if (payoutsEnabled) load();
  }, [payoutsEnabled]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setAmount('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function savePayoutAccount() {
    setSavingPayout(true);
    setPayoutError('');
    try {
      const res = await api('/wallet/payout-account', {
        method: 'PATCH',
        body: JSON.stringify({ phone: payoutInput }),
      });
      setPayoutPhone(res.payoutPhone);
      setEditingPayout(false);
      setPayoutInput('');
    } catch (e) {
      setPayoutError((e as Error).message);
    } finally {
      setSavingPayout(false);
    }
  }

  if (!payoutsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-4 md:p-8">
        <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
        <div className="rounded-lg border border-border bg-fill-soft p-5 text-center">
          <div className="text-lg font-extrabold text-primary">Расчёт напрямую с клиентом</div>
          <p className="mt-2 text-sm text-ink-soft">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance} ₸</div>
        <div className="text-sm text-ink-soft">доступно к выводу</div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">Куда выводим</div>
        {editingPayout ? (
          <div className="mt-2 space-y-2">
            <input
              type="tel"
              placeholder="+7 701 234 56 78"
              className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              autoFocus
            />
            {payoutError && <p className="text-sm text-danger">{payoutError}</p>}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-pill bg-primary p-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                disabled={!payoutInput || savingPayout}
                onClick={savePayoutAccount}
              >
                {savingPayout ? 'Сохраняем…' : 'Сохранить'}
              </button>
              <button
                className="rounded-pill border border-border px-4 text-sm font-bold text-ink-soft"
                onClick={() => {
                  setEditingPayout(false);
                  setPayoutError('');
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-extrabold text-ink">
              {payoutPhone ? `Kaspi · ${maskPhone(payoutPhone)}` : 'Не указано'}
            </span>
            <button className="text-sm font-bold text-primary" onClick={() => setEditingPayout(true)}>
              {payoutPhone ? 'изменить' : 'указать'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setAmount('5000')}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft"
          >
            5 000
          </button>
          <button
            type="button"
            onClick={() => setAmount('20000')}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft"
          >
            20 000
          </button>
          <button
            type="button"
            onClick={() => setAmount(String(balance))}
            disabled={balance < 5000}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft disabled:opacity-40"
          >
            всё · {balance} ₸
          </button>
        </div>
        <input
          type="number"
          min="5000"
          placeholder="Сумма вывода, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="rounded-lg bg-fill-soft p-3 text-xs leading-relaxed text-ink">
          Минимум 5 000 ₸, комиссии нет. Сумма спишется с баланса сразу; при отказе банка вернётся автоматически.
          Обычно 1–3 рабочих дня.
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || !payoutPhone || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : payoutPhone ? 'Вывести' : 'Сначала укажите реквизиты'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-extrabold text-ink">История</h2>
        {history.length === 0 && <p className="text-sm text-ink-soft">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="text-ink">
              {w.amount} ₸ на {maskPhone(w.payoutPhone)}
            </span>
            <span className={`rounded-pill px-2 py-0.5 text-xs font-extrabold ${STATUS_BADGE[w.status] ?? 'bg-fill-soft text-ink-soft'}`}>
              {STATUS_LABELS[w.status] ?? w.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Примечания к реализации:
- `STATUS_BADGE`/`STATUS_LABELS` используют `??`-фолбэк (`?? 'bg-fill-soft text-ink-soft'` / `?? w.status`) — защита на случай появления ещё одного статуса в будущем без падения в `undefined`, не только для уже известного набора `PENDING/PAID/FAILED/ERROR`.
- `bg-warning-bg`/`text-warning-ink`, `bg-success-bg`/`text-success-ink`, `bg-danger-bg`/`text-danger` — все шесть токенов уже подтверждены в `packages/ui/src/tokens.css` (использовались в Фазах B/C).
- Быстрые чипы суммы — просто `setAmount(...)`, не отдельная кнопка отправки; после клика по чипу мастер по-прежнему должен нажать «Вывести» — это то же самое взаимодействие, что раньше было доступно только через ручной ввод в инпуте, чипы лишь ускоряют частые значения.
- `maskPhone(w.payoutPhone)` — `payoutPhone` на записи `WithdrawalRequest` гарантированно непустая строка (бэкенд не создаёт заявку без реквизитов, см. `wallet.service.ts:79-81` — блокирует запрос до заполнения `payoutPhone`), поэтому `Withdrawal.payoutPhone: string` (не `string | null`) корректен без доп. проверки на `null`.

- [ ] **Step 1: Проверить типы**

Run: `pnpm --filter master exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 2: Собрать**

Run: `pnpm --filter master build`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add "apps/master/app/(app)/wallet/page.tsx"
git commit -m "feat(master): мобильная вёрстка /wallet + бейджи истории + фикс метки ERROR"
```

---

### Task 4: Живая проверка — оба вьюпорта, баннер блокировки, реальный вывод средств

**Files:** нет (только проверка).

- [ ] **Step 1: `/wallet` на 390px — быстрые чипы, плашка, история**

Через `docker exec -i` (см. project gotcha — heredoc без `-i` тихо проглатывается) обеспечить тестовому мастеру ненулевой `MasterWalletAccount.balance` (например, вставить `Accrual`/напрямую обновить баланс — см. паттерн из Фаз B/C: `UPDATE "MasterWalletAccount" SET balance = ... WHERE "masterUserId" = 'master-1'`, создав строку через `upsert`-эквивалент `INSERT ... ON CONFLICT` при первом использовании) и указать `payoutPhone` через API или напрямую в БД. `preview_resize` → 390×844, открыть `/wallet`, `preview_snapshot` — баланс, чипы «5 000»/«20 000»/«всё · N ₸», плашка «Минимум 5 000 ₸…», кнопка «Вывести» активна.

- [ ] **Step 2: Реальный вывод — чип → отправка → история**

`preview_eval` клик по чипу «20 000» (если баланс это позволяет; иначе — «5 000») — подтвердить, что инпут суммы обновился (`preview_inspect`/`preview_eval` на `input.value`). Отправить (`preview_network` — `POST /wallet/withdrawals` успешен). `preview_snapshot` — запись в истории показывает «{сумма} ₸ на {маскированный телефон}» и бейдж статуса (жёлтый «В обработке» для `PENDING`, если мок-провайдер синхронно не завершает выплату; если провайдер синхронный и статус сразу `PAID`/`FAILED` — соответствующий зелёный/красный бейдж). `docker exec` — свериться с реальной записью `WithdrawalRequest` и обновлённым `MasterWalletAccount.balance`.

- [ ] **Step 3: Баннер блокировки на `/become-master`**

`docker exec -i` — выставить тестовому мастеру `MasterProfile.blockedUntil` в будущем (`UPDATE "MasterProfile" SET "blockedUntil" = now() + interval '5 days' WHERE "userId" = 'master-1';`). Открыть `/become-master` на 390px и 1280px — `preview_snapshot` на обоих подтверждает баннер «⛔ Доступ к новым заявкам ограничен до {дата}» с текстом про 3 отмены, `bg-danger-bg`/`text-danger` (проверить вычисленный цвет через `preview_inspect`, не только класс — см. project gotcha про доверие только вычисленным стилям). Остальной контент страницы (статус/документы/категории) не изменился.

- [ ] **Step 4: Баннер исчезает после истечения блокировки**

`docker exec -i` — выставить `blockedUntil` в прошлое (`now() - interval '1 day'`). Перезагрузить `/become-master` — `preview_snapshot` подтверждает, что баннер не рендерится, страница выглядит как обычно.

- [ ] **Step 5: Метка статуса `ERROR` не ломается**

`docker exec -i` — вручную выставить одной из тестовых записей `WithdrawalRequest.status = 'ERROR'`. Перезагрузить `/wallet` — `preview_snapshot` подтверждает бейдж «Уточняется» вместо пустого/`undefined` текста.

- [ ] **Step 6: Зафиксировать результат**

Проверочная задача, без отдельного коммита. Расхождения — находка, возврат в Task 2/3 по месту.

---

## Self-Review (проведено при написании плана)

- **Покрытие спеки:** `/wallet` мобильная вёрстка существующей страницы (баланс/вывод/история), логика не меняется, форма реквизитов Kaspi переносится как есть (Task 3) — покрыто. Баннер блокировки на `/become-master` вместо отдельного экрана «Профиль» (Task 1-2) — покрыто, с явным обоснованием, почему остальной прототипный «Профиль» не переносится (Global Constraints). Метка `ERROR` — не из спеки напрямую, но обнаруженный по ходу реальный дефект в файле, который и так меняется (тот же паттерн, что фикс `district`/`address` в Фазе A).
- **Плейсхолдеры:** не найдены.
- **Согласованность типов:** `Application.blockedUntil` (Task 1) потребляется в Task 2 без изменений сигнатуры. `Withdrawal.payoutPhone` вводится и потребляется в рамках одного Task 3 (полная перезапись файла), несогласованности между задачами нет.
