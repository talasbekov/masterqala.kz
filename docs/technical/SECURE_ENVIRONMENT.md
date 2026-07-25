# Безопасная конфигурация окружения MasterQala.kz

Документ относится к stacked PR `feat/security-baseline`, основанному на `feat/free-pilot-mode`.

## 1. Что проверяется при запуске

`ConfigModule` вызывает централизованный `validateEnvironment()` до инициализации бизнес-модулей.

API прекращает запуск, если:

- `JWT_SECRET` отсутствует;
- secret короче 32 символов;
- используется известная заглушка из `.env.example`;
- `NODE_ENV` не входит в `development | test | production`;
- `PORT` не является целым числом от 1 до 65535;
- `CORS_ORIGINS` содержит `*`, некорректный URL, path, query или hash;
- в production не задан CORS allowlist;
- production origin использует HTTP вместо HTTPS.

JWT-модуль получает secret через `ConfigService.getOrThrow()` и больше не имеет fallback.

## 2. Production-пример

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@PRIVATE_DB_HOST:5432/masterqala
JWT_SECRET=<случайное значение длиной не менее 32 символов>
CORS_ORIGINS=https://masterqala.kz,https://app.masterqala.kz
COMMERCIAL_MODE=FREE_PILOT
UPLOAD_DIR=/var/lib/masterqala/uploads
```

Генерация секрета:

```bash
openssl rand -base64 48
```

Для каждого окружения используется отдельный secret. Его нельзя хранить в Git, логах, frontend-переменных или Docker image.

## 3. Единый CORS для HTTP и Socket.IO

HTTP и Socket.IO получают один нормализованный allowlist из `CORS_ORIGINS`.

Это исключает ситуацию, когда REST ограничен, но realtime handshake всё ещё разрешает любой browser origin.

В development/test при отсутствии переменной разрешены только:

```text
http://localhost:5173
http://127.0.0.1:5173
```

В production значение обязательно и допускаются только HTTPS origins.

## 4. Проверка HTTP CORS

Разрешённый origin:

```bash
curl -i \
  -H 'Origin: https://masterqala.kz' \
  http://127.0.0.1:3000/api/v1/health
```

Ожидается заголовок:

```text
Access-Control-Allow-Origin: https://masterqala.kz
```

Запрещённый origin:

```bash
curl -i \
  -H 'Origin: https://evil.example' \
  http://127.0.0.1:3000/api/v1/health
```

Ответ не должен содержать `Access-Control-Allow-Origin` для переданного домена.

## 5. Проверка Socket.IO

Из разрешённого frontend-origin:

1. передать JWT через `handshake.auth.token`;
2. убедиться, что соединение установлено;
3. проверить вход в персональную комнату и получение события.

Из запрещённого browser-origin handshake должен быть отклонён политикой CORS до обработки событий.

Невалидный JWT по-прежнему получает `connect_error` с сообщением `Требуется вход`.

## 6. CI и тесты

CI задаёт явные значения:

```env
NODE_ENV=test
JWT_SECRET=ci-only-secret-with-at-least-32-characters
CORS_ORIGINS=http://localhost:5173
```

Unit-тесты подтверждают:

- отказ без `JWT_SECRET`;
- отказ для коротких и известных placeholder secrets;
- обязательный HTTPS allowlist в production;
- запрет wildcard;
- запрет path/query/hash;
- нормализацию и дедупликацию origins;
- проверку порта.

## 7. Порядок rollout

1. Сгенерировать production JWT secret и сохранить в secret manager или защищённом env-файле.
2. Указать реальные HTTPS origins.
3. Развернуть версию на staging.
4. Проверить HTTP CORS и Socket.IO handshake с разрешённого и запрещённого origin.
5. Проверить авторизацию существующего клиента новым токеном.
6. После смены secret считать все старые JWT недействительными и потребовать повторный вход.
7. Только после smoke обновлять production.

## 8. Откат

Откат к предыдущей версии возвращает небезопасный fallback и permissive CORS, поэтому он допустим только как кратковременная аварийная мера в закрытом контуре.

Безопаснее исправить значения env и повторно запустить текущую версию, чем отключать validation.

## 9. Что ещё не закрыто этим PR

Следующими отдельными изменениями остаются:

- HTTP security headers;
- rate limiting для API и Socket.IO geo events;
- хеширование SMS-кодов;
- magic-byte проверка и антивирусный pipeline файлов;
- production readiness health-check;
- session/revocation модель JWT;
- централизованный audit/security logging;
- trust proxy и корректное определение IP за reverse proxy.
