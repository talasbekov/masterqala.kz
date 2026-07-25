# Rate limiting и HTTP security headers MasterQala.kz

Документ относится к stacked PR `feat/security-rate-limits`, основанному на `feat/security-baseline`.

## 1. Назначение

Первая публичная версия получает базовую защиту от:

- массовых HTTP-запросов с одного IP;
- перебора SMS endpoint поверх существующих бизнес-лимитов по номеру;
- чрезмерной загрузки файлов;
- слишком частых Socket.IO геообновлений;
- некорректных координат;
- clickjacking, MIME sniffing и передачи лишних browser permissions;
- подмены IP через произвольный `X-Forwarded-For` при неверной proxy-конфигурации.

Это защитный baseline для пилота, а не полноценный WAF или distributed rate limiter.

## 2. HTTP rate-limit политики

Лимиты считаются по `request.ip`:

| Группа | Лимит | Окно |
|---|---:|---:|
| прочие API-запросы | 180 | 1 минута |
| `POST /auth/request-code` | 10 | 10 минут |
| `POST /auth/verify-code` | 30 | 10 минут |
| uploads/master documents/dispute evidence | 30 | 1 минута |

`OPTIONS` и `/health` не ограничиваются этим middleware.

При превышении API возвращает:

```json
{
  "statusCode": 429,
  "message": "Слишком много запросов. Повторите позже"
}
```

Также отправляются:

- `RateLimit-Limit`;
- `RateLimit-Remaining`;
- `RateLimit-Reset`;
- `Retry-After` при блокировке.

Бизнес-лимиты SMS по телефону продолжают действовать отдельно. IP-rate-limit не заменяет их, а затрудняет массовую атаку на множество номеров.

## 3. Ограничение текущей реализации

Rate limiter хранит buckets в памяти процесса.

Это допустимо для первого single-node пилота, но означает:

- состояние сбрасывается при restart;
- несколько API replicas считают лимиты независимо;
- лимиты нельзя считать строгой финансовой или антифрод-гарантией.

Перед горизонтальным масштабированием требуется shared store, например Redis, с атомарным алгоритмом fixed/sliding window или token bucket.

Reverse proxy должен дополнительно ограничивать:

- общий request rate;
- размер request body;
- число соединений;
- handshake rate для `/socket.io/`;
- подозрительные IP/ASN при необходимости.

## 4. Доверенный reverse proxy

`TRUST_PROXY_HOPS` управляет Express `trust proxy`:

```env
TRUST_PROXY_HOPS=0
```

- `0` — клиент подключается к API напрямую;
- `1` — перед API ровно один доверенный Nginx/Caddy/ingress;
- большее значение задаётся только по фактической сетевой схеме.

Завышенное значение позволяет клиенту влиять на вычисляемый IP через цепочку forwarding headers и обходить per-IP rate limiting.

Рекомендуемая production-схема:

```text
Internet -> один доверенный reverse proxy -> NestJS API
```

Для неё используется:

```env
TRUST_PROXY_HOPS=1
```

## 5. Socket.IO геолокация

`presence:online` и `geo:update` принимают только конечные числа в диапазонах:

```text
lat: -90 .. 90
lng: -180 .. 180
```

Для одного socket разрешается не чаще одного `geo:update` в секунду.

Отклонённое обновление:

- не записывается в presence;
- не запускает поиск активной заявки;
- не выполняет PostGIS-запрос ETA;
- не ретранслируется клиенту.

WeakMap привязывает временную отметку к socket-объекту и не требует ручной очистки после disconnect.

Этот лимит защищает API от случайного высокочастотного клиента. Перед масштабированием нужен дополнительный connection/IP limiter на reverse proxy и наблюдаемость по dropped geo events.

## 6. Security headers

Каждый HTTP-ответ получает:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(self), camera=(), microphone=()
X-Permitted-Cross-Domain-Policies: none
Cross-Origin-Resource-Policy: same-site
```

В production дополнительно:

```text
Strict-Transport-Security: max-age=15552000
```

`X-Powered-By` отключён.

HSTS имеет смысл только при реальном HTTPS на внешнем reverse proxy. До проверки всего домена `includeSubDomains` и `preload` намеренно не включены.

CSP не добавлен в этот PR: API в основном отдаёт JSON и файлы, а политика для frontend должна проектироваться вместе с фактическими CDN, картами, PWA и Socket.IO endpoints, чтобы не сломать приложение случайным запретом.

## 7. Smoke-проверка

Проверка заголовков:

```bash
curl -I https://api.masterqala.kz/api/v1/health
```

Проверка rate limit:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST https://api.masterqala.kz/api/v1/auth/request-code \
    -H 'Content-Type: application/json' \
    --data '{"phone":"+77000000000"}'
done
```

После допустимого числа запросов должен появиться `429`. Использовать только тестовый номер и staging.

Проверка IP за proxy:

1. выставить фактический `TRUST_PROXY_HOPS`;
2. отправить запросы с двух реальных клиентов;
3. убедиться в логах/метриках, что IP различаются;
4. проверить, что произвольный клиентский `X-Forwarded-For` не меняет IP за пределами доверенной proxy-цепочки.

Проверка realtime:

- отправить валидное обновление;
- сразу отправить второе — оно должно быть проигнорировано;
- спустя одну секунду обновление снова принимается;
- координаты `91/181`, `NaN` и бесконечность не должны менять presence.

## 8. Наблюдаемость перед публичным запуском

Нужно отслеживать:

- количество `429` по policy и endpoint;
- количество dropped geo updates;
- число активных Socket.IO connections;
- частоту SMS request/verify;
- upload rejection rate;
- top IP только в защищённых технических логах с ограниченным сроком хранения.

Текущая реализация не добавляет персональные IP-логи автоматически, чтобы не расширять сбор данных без утверждённой политики retention.

## 9. Следующие шаги

- distributed limiter при нескольких replicas;
- отдельные user/account limits после JWT;
- Socket.IO handshake limiter на proxy;
- CAPTCHA/risk challenge для аномальной SMS-активности;
- CSP для web-приложения;
- audit/security logging;
- алерты на всплески `429`, SMS и upload traffic.
