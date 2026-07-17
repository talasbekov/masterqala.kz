# Этап 4 «Деньги» — технический дизайн

> Основание: бизнес-спека `docs/project-spec.md` (§3.7 оплата/Kaspi-флоу, §3.12 вывод средств мастера, §6 числа, §7 монетизация). Строится поверх этапов 2–3 — переиспользует паттерны `gate()`, `PAYMENT_PROVIDER`, атомарный `updateMany`-гейт для баланса (по прецеденту `LeadCreditAccount` этапа 3).

## 1. Скоуп

**Входит:** денежный кошелёк мастера (атомарный баланс, наполняется из существующих компенсаций выезда срочного режима — этап 2); вывод средств (§3.12) — запрос → списание с баланса сразу → выплата через мок `PAYMENT_PROVIDER.payout()` → «выплачено» либо возврат на баланс при неуспехе; расширение `PAYMENT_PROVIDER` методом `payout()` по прецеденту `charge()` из этапа 3; минимальный read-only список заявок на вывод в админке оператора; экран мастера «Кошелёк»; фикс расхождения фильтров `PricingService`/`MatchingService` (мастер как собственный клиент, дублирование списка активных статусов) — унаследованный из бэклога этапа 2, ранее отложенный.

**Не входит:** реальная интеграция с Kaspi (внешняя зависимость по спеке, не блокирует архитектуру); эскроу/безопасная сделка (фаза 2); собственный учёт выручки платформы (сервисный сбор уже холдируется/капчится с этапа 2, не трогаем); ручной разбор спорных/отклонённых выводов оператором сверх read-only списка (этап 5); гонка `handleAutoClose`/`confirmCompletion` из бэклога этапа 2 — не про деньги, остаётся в общем бэклоге.

## 2. Архитектурные решения (приняты 2026-07-18)

| Область | Решение |
|---|---|
| Баланс кошелька | Новая таблица `MasterWalletAccount` (masterUserId, balance) — по образцу `LeadCreditAccount` этапа 3 |
| Заморозка при выводе | Одно число: списание с баланса сразу при запросе (атомарный `updateMany WHERE balance>=amount`), возврат `increment` при неуспехе — не два числа (available/frozen), мок почти никогда не отказывает |
| Журнал списаний | Сама таблица `WithdrawalRequest` — самодостаточная запись, отдельный универсальный тип транзакций не заводим (в отличие от `LeadCreditTransaction`, здесь только один вид списания) |
| Журнал начислений | Существующая `Accrual` (этап 2) — правится только логика зачисления на баланс |
| Реквизиты выплаты | `User.phone` напрямую — уже верифицирован SMS-авторизацией, отдельная модель реквизитов не нужна |
| Оплата | `PAYMENT_PROVIDER.payout(referenceId, amount)` — тот же паттерн, что `charge()`: мок всегда `SUCCEEDED`, без записи в `PaymentTransaction` (не привязано к заявке) |
| Видимость оператору | Read-only список `/admin/withdrawals`, маскированный телефон (последние 4 цифры) — по прецеденту верификации мастеров этапа 1 |
| Фикс Pricing/Matching | `findNearestFreeMaster` получает `clientId`, исключает себя (`<> clientId`) и список активных статусов мастера через общую константу `ACTIVE_MASTER_STATUSES`, а не строковый литерал |

## 3. Модель данных

```prisma
enum WithdrawalStatus {
  PENDING
  PAID
  FAILED
}

model MasterWalletAccount {
  masterUserId String @id
  master       User   @relation(fields: [masterUserId], references: [id])
  balance      Int    @default(0)
}

model WithdrawalRequest {
  id           String           @id @default(uuid())
  masterUserId String
  master       User             @relation(fields: [masterUserId], references: [id])
  amount       Int
  status       WithdrawalStatus @default(PENDING)
  providerRef  String?
  requestedAt  DateTime         @default(now())
  paidAt       DateTime?
}
```

## 4. Зачисление на баланс (правка `OrdersService`, этап 2)

`accrueCompensation()` сейчас пишет `Accrual` через `createMany({ skipDuplicates: true })` — идемпотентность по `unique(orderId)`. Простое доинкрементирование баланса при каждом вызове задвоило бы зачисление при повторном (пропущенном) вызове. `createMany` в Prisma возвращает `{ count }` — число реально вставленных строк (пропущенные дубликаты не считаются); инкремент баланса делаем только если `count > 0`, в той же транзакции:

```typescript
async accrueCompensation(tx: Tx, order: Order): Promise<void> {
  if (!order.masterId) return;
  const amount = order.calloutPrice - order.serviceFee;
  const res = await tx.accrual.createMany({
    data: [{ masterUserId: order.masterId, orderId: order.id, type: 'CALLOUT_COMPENSATION', amount }],
    skipDuplicates: true,
  });
  if (res.count > 0) {
    await tx.masterWalletAccount.upsert({
      where: { masterUserId: order.masterId },
      create: { masterUserId: order.masterId, balance: amount },
      update: { balance: { increment: amount } },
    });
  }
}
```

## 5. Вывод средств (`WithdrawalsService`, новый модуль `wallet`)

Расширение `PaymentProvider` (`payment.interface.ts`, этапы 2–3):

```typescript
export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
  payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }>;
}
```

`MockPaymentProvider.payout()` — синхронный успех, без записи в `PaymentTransaction`, как и `charge()`.

Флоу `request(masterUserId, amount)`:

| № | Действие | Реакция |
|---|---|---|
| 1 | `amount < 5000` (₸, §6) | 400 |
| 2 | Атомарное списание: `updateMany({ where: { masterUserId, balance: { gte: amount } }, data: { balance: { decrement: amount } } })` | `count===0` → 422 «Недостаточно средств»; тот же гейт-паттерн, что списание lead-кредита в этапе 3 |
| 3 | В той же транзакции — `WithdrawalRequest.create({ status: 'PENDING' })` | — |
| 4 | Вне транзакции — `paymentProvider.payout(withdrawal.id, amount)` | мок: всегда `SUCCEEDED` |
| 5 | Финализация транзакцией: `status='PAID'` (+`paidAt`,`providerRef`) при успехе; `status='FAILED'` **и возврат `amount` на баланс** при неуспехе | §3.12 «выплата отклонена → разморозка» |

Комиссии нет (§6: 0₸); срок «1–3 раб. дня» не симулируется — мок отвечает синхронно, как `charge()`.

## 6. Фикс `PricingService`/`MatchingService`

`findNearestFreeMaster(categoryId, to, clientId)` — добавлен параметр `clientId`, в SQL добавлено `AND mp."masterUserId" <> ${clientId}` (исключение мастера-самого-себе-клиента, как уже сделано в `MatchingService.findCandidates`). Список активных статусов мастера заменён с литерала `('ACCEPTED','MASTER_ON_WAY',...)` на `Prisma.join(ACTIVE_MASTER_STATUSES.map(s => Prisma.sql\`${s}::"OrderStatus"\`))` — импорт общей константы из `order.constants.ts`, устраняет риск рассинхронизации с `MatchingService`.

`PricingService.quote()` получает `clientId` третьим параметром; `OrdersService.create()` уже знает `clientId` и пробрасывает его; `OrdersController.preview()` сейчас не принимает пользователя — добавляется `@CurrentUser()`, `OrdersService.preview(clientId, dto)` пробрасывает дальше.

## 7. HTTP API

- `GET /wallet/balance`, `GET /wallet/withdrawals` (история мастера), `POST /wallet/withdrawals { amount }`.
- `GET /admin/withdrawals` — список для оператора (мастер, сумма, статус, дата, телефон маскирован).

## 8. Экраны

- **`WalletPage.tsx`** (мастер): баланс, форма вывода (сумма, валидация ≥5000₸), история заявок со статусами. Структура — по прецеденту `LeadCreditsPage.tsx` этапа 3. Ссылка — из `ProfilePage.tsx`, видна только активным мастерам.
- **`AdminWithdrawalsPage.tsx`** (оператор): read-only список заявок на вывод. Роут `/admin/withdrawals`, ссылка из `AdminListPage.tsx` рядом с существующей верификацией мастеров.

## 9. Обработка ошибок и крайние случаи

Недостаточно средств → 422 с текущим балансом; сумма меньше 5000₸ → 400; неуспешный `payout()` (в реальном Kaspi — сетевой сбой/отказ банка) → баланс восстанавливается, заявка помечается `FAILED`, мастер видит статус в истории; повторный `accrueCompensation()` для уже закрытой/отменённой заявки — `createMany.count===0` → баланс не трогается (идемпотентность сохранена); мастер без `MasterWalletAccount` (ещё не было начислений) при попытке вывода — `updateMany` не найдёт строку, `count===0` → тот же 422, что и «недостаточно средств» (семантически корректно: баланс 0).

## 10. Тестирование

Unit: правильность `res.count > 0` идемпотентности в `accrueCompensation` (повторный вызов не задваивает баланс). E2e (через реальный HTTP + мок, который всегда успешен — по прецеденту `LeadCreditsService` этапа 3): полный цикл срочной заявки до `CLOSED` → баланс кошелька мастера увеличился на `calloutPrice − serviceFee`; повторный вызов `handleAutoClose`/`confirmCompletion` на уже закрытой заявке не меняет баланс; вывод — успешный (баланс списан, статус `PAID`), недостаточно средств (422, баланс не тронут), сумма меньше минимума (400); оператор видит список выводов с маскированным телефоном, недоступен без роли `OPERATOR`; регрессия `PricingService`/`MatchingService` — превью цены для мастера, заказывающего в своей же категории рядом с собой, не находит себя как ближайшего свободного мастера (тест на edge case «мастер сам себе клиент»).

Ветка `FAILED` (неуспешный `payout()`, возврат на баланс) не воспроизводима через HTTP-мок, который всегда отвечает `SUCCEEDED` — тот же класс ограничения, что и у `LeadCreditsService.purchase()` в этапе 3 (принято там же как Minor, не блокирующее). Эта ветка кода проверяется точечным unit-тестом `WithdrawalsService` с `PAYMENT_PROVIDER`, подменённым на стаб через `overrideProvider` в тестовом модуле Nest (стаб `payout()` возвращает `FAILED` напрямую) — без обращения к HTTP/e2e-стеку.
