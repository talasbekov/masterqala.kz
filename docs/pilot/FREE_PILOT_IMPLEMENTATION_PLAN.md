# План реализации `FREE_PILOT`

Этот документ превращает техническую спецификацию бесплатной версии в последовательный план изменений backend, frontend, тестов и эксплуатации.

## 1. Цель изменения

Добавить явный режим:

```env
COMMERCIAL_MODE=FREE_PILOT
```

При нём сохраняются все продуктовые сценарии, но backend не создаёт и не инициирует платформенные финансовые операции.

## 2. Принцип реализации

Нельзя реализовывать режим набором разрозненных проверок `process.env`.

Нужен один источник истины:

```ts
export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';
```

и сервис возможностей:

```ts
interface CommercialCapabilities {
  payments: boolean;
  leadCredits: boolean;
  payouts: boolean;
  refunds: boolean;
}
```

Бизнес-сервисы запрашивают capabilities, а не название режима, где это возможно.

## 3. Шаг 1 — конфигурация

Добавить модуль:

```text
apps/api/src/commercial-mode/
  commercial-mode.module.ts
  commercial-mode.service.ts
  commercial-mode.types.ts
  commercial-mode.service.spec.ts
```

Задачи:

- прочитать `COMMERCIAL_MODE` через `ConfigService`;
- остановить запуск при неизвестном или отсутствующем production-значении;
- разрешить безопасный development default только в non-production;
- экспортировать сервис глобально или импортировать в нужные модули;
- не читать env напрямую в Orders/PlannedOrders/Wallet/Disputes.

Рекомендуемая матрица:

| Capability | FREE_PILOT | PAID_MOCK | PAID_LIVE |
|---|---:|---:|---:|
| payments | false | true | true |
| leadCredits | false | true | true |
| payouts | false | true | true |
| refunds | false | true | true |

## 4. Шаг 2 — публичная конфигурация frontend

Добавить публичный endpoint, например:

```text
GET /api/v1/config/public
```

Ответ:

```json
{
  "commercialMode": "FREE_PILOT",
  "paymentsEnabled": false,
  "leadCreditsEnabled": false,
  "payoutsEnabled": false
}
```

Требования:

- endpoint не раскрывает секреты;
- frontend загружает конфигурацию до показа коммерческих элементов;
- backend всё равно самостоятельно запрещает действия;
- ответ можно кэшировать на короткое время;
- режим фиксируется в логах старта приложения.

## 5. Шаг 3 — срочные заявки

Изменить `apps/api/src/orders/orders.service.ts`.

### `create`

Текущее:

```text
создание Order → payments.hold → SEARCHING → wave job
```

FREE_PILOT:

```text
создание Order → SEARCHING → wave job
```

Если перевод в SEARCHING/job не удался, заявка не должна зависнуть как пользовательски активная без диагностируемого состояния.

### `accept`

Текущее:

```text
SEARCHING → ACCEPTED → payments.capture
```

FREE_PILOT:

```text
SEARCHING → ACCEPTED
```

Закрытие проигравших офферов и realtime сохраняются.

### `markNoMasters`

FREE_PILOT не вызывает `payments.void`.

### `retrySearch`

FREE_PILOT не создаёт новый hold.

### Отмены

- до принятия: без void;
- после принятия: без accrual;
- отклонение/таймаут цены: без accrual;
- санкции и статусные переходы сохраняются.

### Закрытие

`closeOrder` в FREE_PILOT не вызывает `accrueCompensation`.

## 6. Шаг 4 — плановые отклики

Изменить `apps/api/src/planned-orders/planned-orders.service.ts`.

`placeBid` должен иметь две транзакционные ветки.

FREE_PILOT:

1. проверить заявку, статус, блокировку, лимит и уникальность;
2. создать `PlannedOrderBid`;
3. не читать/не менять `LeadCreditAccount`;
4. не создавать `LeadCreditTransaction`.

PAID_*:

- сохранить текущее атомарное списание кредита и создание транзакции.

Отмена клиента после выбора:

- в FREE_PILOT не создавать REFUND lead-credit;
- в PAID_* сохранить возврат.

## 7. Шаг 5 — lead credits

Изменить `LeadCreditsController/Service`.

В FREE_PILOT:

- `purchase` отклоняется доменной ошибкой;
- packages могут возвращать пустой список с признаком отключения;
- balance не используется как ограничение;
- frontend скрывает весь коммерческий блок.

Рекомендуемый машинный код:

```json
{
  "statusCode": 409,
  "code": "FEATURE_DISABLED_IN_FREE_PILOT",
  "message": "Покупка откликов недоступна в бесплатном пилоте"
}
```

Если общего error envelope пока нет, сначала допускается стандартная NestJS-ошибка, но тест должен проверять backend-блокировку.

## 8. Шаг 6 — кошелёк и вывод

Изменить `WalletController/Service`.

В FREE_PILOT:

- `POST /wallet/withdrawals` запрещён;
- реальные начисления отсутствуют;
- balance не должен представляться как доступные реальные деньги;
- старые mock-данные не переносятся в production.

Frontend:

- скрыть вкладку кошелька либо показать информационное состояние;
- не показывать CTA вывода;
- не использовать mock balance в интерфейсе пилота.

## 9. Шаг 7 — споры

Изменить `DisputesService.resolve`.

В FREE_PILOT:

- `refundServiceFee` не вызывает provider refund;
- решение может сохраняться как аналитический результат либо поле принудительно становится `false`;
- закрытие заказа и санкция мастеру сохраняются;
- закрытие срочного заказа не создаёт accrual.

Важно: сейчас закрытие через разрешение спора вызывает компенсацию напрямую. Эта точка должна использовать ту же централизованную финансовую политику, что `OrdersService`.

## 10. Шаг 8 — унификация финансовых side effects

Чтобы не пропустить скрытые вызовы, рекомендуется вынести оркестрацию в сервис, например:

```text
apps/api/src/commercial/
  order-financial-effects.service.ts
  planned-financial-effects.service.ts
```

Минимальные методы:

```ts
onUrgentOrderCreated(order): Promise<void>
onUrgentOrderAccepted(order): Promise<void>
onUrgentOrderVoided(order): Promise<void>
onUrgentOrderClosed(order): Promise<void>
onPlannedBidCreated(...): Promise<void>
onPlannedBidRefunded(...): Promise<void>
```

FREE_PILOT implementation — no-op с безопасным audit/metric событием.

PAID_MOCK implementation — существующий mock provider.

PAID_LIVE implementation — реальный provider.

Это надёжнее, чем условие вокруг каждого отдельного вызова.

## 11. Шаг 9 — снимок режима в заказе

Для первой итерации миграция необязательна, но до переключения режима в production желательно добавить:

```prisma
enum CommercialMode {
  FREE_PILOT
  PAID_MOCK
  PAID_LIVE
}
```

и поля:

```prisma
commercialMode CommercialMode
```

в `Order` и `PlannedOrder`.

Преимущества:

- понятно, по каким правилам создан старый заказ;
- переключение режима не меняет задним числом трактовку заказа;
- споры и аналитика используют режим заказа, а не текущий глобальный режим;
- безопаснее постепенный rollout.

При реализации этого поля значение задаётся при создании заявки и не изменяется.

## 12. Шаг 10 — frontend срочного режима

Изменения экранов:

- превью: «Выезд бесплатно на период пилота»;
- сервисный сбор: `0 ₸` для пользователя;
- номинальная будущая цена не должна выглядеть как платёжное требование;
- удалить/скрыть payment method;
- после выбора мастера пояснить: стоимость работ согласуется после осмотра;
- после подтверждения цены: «Оплата напрямую мастеру после выполнения»;
- закрытие не показывает платформенную квитанцию.

Важно сохранить backend-поля `calloutPrice/serviceFee` для аналитики, не смешивая их с отображаемой суммой к оплате.

## 13. Шаг 11 — frontend мастера

Срочный оффер:

- не обещать автоматическую выплату;
- `compensation` переименовать в понятный пилотный текст либо скрыть;
- показать, что расчёт за работу происходит напрямую с клиентом.

Плановый режим:

- убрать баланс откликов;
- убрать пакеты;
- убрать покупку;
- показать «Отклик бесплатный в период пилота»;
- не блокировать кнопку из-за локального balance.

Кошелёк:

- скрыть либо заменить информационной страницей.

## 14. Шаг 12 — аналитика

События пилота должны фиксировать:

- режим приложения;
- создание заявки;
- рассчитанную номинальную цену;
- волны и кандидатов;
- время до принятия;
- предложенную и подтверждённую цену работы;
- отмены;
- завершение;
- плановые bids;
- споры и отзывы.

Не фиксировать как факт:

- оплату клиентом;
- выплату мастеру;
- успешный внешний расчёт.

Эти операции происходят вне платформы и не подтверждены системой.

## 15. Шаг 13 — тесты

### Unit

- CommercialMode parsing;
- capability matrix;
- production startup fails without valid mode;
- FREE_PILOT financial-effects methods are no-op.

### API/e2e

- срочная заявка проходит полностью без `PaymentTransaction`;
- нет `Accrual` после каждого пути закрытия/отмены/спора;
- плановый bid проходит без аккаунта кредитов;
- purchase/withdraw запрещены;
- PAID_MOCK сохраняет прежнее поведение;
- public config соответствует backend-режиму.

### Frontend

- коммерческие элементы скрыты;
- пилотные тексты присутствуют;
- изменение только frontend-конфигурации не позволяет вызвать запрещённый backend endpoint.

## 16. Шаг 14 — миграция и данные

Для первой production-базы рекомендуется начать с чистой схемы:

- не переносить mock payment transactions;
- не переносить wallet balances;
- не переносить lead-credit purchases;
- не переносить тестовые SMS-коды;
- не переносить тестовые документы и адреса.

Переносить только утверждённые справочники и операторскую учётную запись через контролируемый production seed.

## 17. Шаг 15 — rollout

1. реализовать режим и тесты;
2. развернуть на staging в `FREE_PILOT`;
3. провести полный сценарий с клиентом, двумя мастерами и оператором;
4. проверить БД на отсутствие финансовых записей;
5. провести security checklist;
6. открыть закрытый пилот для ограниченного числа мастеров;
7. наблюдать отмены, NO_MASTERS, зависшие статусы;
8. расширять аудиторию только после стабильной недели/утверждённого периода наблюдения.

## 18. Rollback режима

Переключение `FREE_PILOT → PAID_*` не должно выполняться только изменением env без готовности:

- реального договора и провайдера;
- UI оплаты;
- webhook/idempotency/reconciliation;
- возвратов;
- выплат;
- юридических документов;
- production-тестов.

Обратное аварийное переключение `PAID_* → FREE_PILOT` требует обработки уже созданных hold/capture и не может считаться простым no-op.

## 19. Definition of Done

- [ ] режим валидируется при старте;
- [ ] публичная конфигурация доступна frontend;
- [ ] ни один срочный путь не вызывает payment/accrual в FREE_PILOT;
- [ ] ни один плановый отклик не использует кредиты;
- [ ] purchase и withdrawal запрещены backend;
- [ ] dispute resolution не вызывает refund/accrual;
- [ ] frontend явно показывает условия бесплатного пилота;
- [ ] e2e матрица FREE_PILOT/PAID_MOCK зелёная;
- [ ] production база не содержит mock-финансовых обязательств;
- [ ] документация и runbook обновлены;
- [ ] оператор прошёл ручной acceptance сценарий.
