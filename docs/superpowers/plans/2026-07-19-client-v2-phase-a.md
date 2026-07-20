# Клиент v2 — Фаза A: тема, shell, авторизация, главная, каталог

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: superpowers:subagent-driven-development для выполнения плана по задачам.

**Цель:** заложить фундамент Цикла 2 (клиент v2) — скоупнутые токены v2, мобильный shell с таб-баром, i18n-инфраструктура — и реализовать первые 3 маршрута (`/login`, `/`, `/catalog`) строго по хендофф-прототипу `apps/MasterQala/design_handoff_masterqala/Этап 5 - Клиент (mobile).dc.html`.

**Архитектура:** новые компоненты живут в `apps/web/src/features/client-v2/`, не трогают `packages/ui`, кроме одного нового CSS-файла токенов. Старые `LoginPage.tsx`/`HomePage.tsx` полностью заменяются (удаляются), не патчатся. `/orders`, `/profile`, `/order/*`, `/planned/*`, `/work`, `/lead-credits`, `/wallet` остаются на старом `Layout`/`TabBar` до своих фаз (B/C/D) — ожидаемое переходное состояние, не баг.

**Верификация задач:** в репозитории нет фронтенд-тестового фреймворка (осознанно, прецедент из клиентского редизайна v1). Верификация каждой задачи — `pnpm --filter web build` (tsc + vite, должен быть чистым) плюс механическая проверка, где применимо (grep собранного CSS на новые токены). Финальную браузерную сквозную проверку всех 3 экранов проводит контроллер (не саб-агент) после завершения всех задач, перед финальным ревью.

## Global Constraints

- Точные значения токенов v2 (подтверждены прямым чтением прототипа, строка 13 и по всему файлу): primary `#166088`, primary-hover `#134F73`, фон приложения `#F2F7FA` (НЕ `#C7DAE3` — это хром инструмента прототипирования, не часть продукта), surface `#FFFFFF`, border `#C0D6DF`, fill `#CFE0E8`, fill-soft `#EAF2F6`, fill-faint `#F6FAFC`, ink `#14303C`, ink-soft `#5B7B8A`, muted `#8FAAB8`, on-fill `#38596A`, success `#059669`/success-bg `#E5F3EE`/success-ink `#065F46`, danger `#DC2626`/danger-bg `#FBECEC`/danger-ink `#991B1B`, warning-bg `#FFF1E8`/warning-ink `#B4530A`.
- Имена токенов — префикс `c2` (`--color-c2-*`, `--radius-c2-*`, `--shadow-c2-*`), НЕ переопределять существующие `--color-primary`/`--color-accent`/и т.д. из `packages/ui/src/tokens.css` — это затронуло бы мастер/админ страницы и Claude Design sync.
- Шрифт — переиспользовать существующий глобальный `--font-sans` (Manrope), отдельного `c2`-токена под шрифт не заводить.
- Весь копирайт — русский, дословно по прототипу (см. точные цитаты в каждой задаче).
- TypeScript strict: `verbatimModuleSyntax: true` в `apps/web/tsconfig.app.json` — все type-only импорты через `import type { ... }`. `noUnusedLocals`/`noUnusedParameters: true` — не оставлять неиспользуемые импорты/переменные.
- Не удалять и не менять `apps/web/src/Layout.tsx`, `apps/web/src/components/TabBar.tsx` — обслуживают ещё не переведённые на v2 маршруты.
- Бэкенд categories: сейчас засеяно только `plumbing`/`electrics` (`apps/api/prisma/seed.ts`), прототип показывает 6 категорий — Задача 3 расширяет seed до полного набора (это seed-данные, не схема — низкий риск).

---

### Task 1: Дизайн-токены v2 (скоуп `c2`) + Tailwind wiring

**Files:**
- Create: `packages/ui/src/tokens-client-v2.css`
- Modify: `packages/ui/package.json`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Produces: Tailwind-утилиты `bg-c2-*`/`text-c2-*`/`border-c2-*`/`rounded-c2-*`/`shadow-c2-*`, доступные во всех последующих задачах Цикла 2.

- [ ] **Step 1: Создать файл токенов**

`packages/ui/src/tokens-client-v2.css`:
```css
@theme {
  --color-c2-primary: #166088;
  --color-c2-primary-hover: #134F73;
  --color-c2-bg: #F2F7FA;
  --color-c2-surface: #FFFFFF;
  --color-c2-border: #C0D6DF;
  --color-c2-fill: #CFE0E8;
  --color-c2-fill-soft: #EAF2F6;
  --color-c2-fill-faint: #F6FAFC;
  --color-c2-ink: #14303C;
  --color-c2-ink-soft: #5B7B8A;
  --color-c2-muted: #8FAAB8;
  --color-c2-on-fill: #38596A;
  --color-c2-success: #059669;
  --color-c2-success-bg: #E5F3EE;
  --color-c2-success-ink: #065F46;
  --color-c2-danger: #DC2626;
  --color-c2-danger-bg: #FBECEC;
  --color-c2-danger-ink: #991B1B;
  --color-c2-warning-bg: #FFF1E8;
  --color-c2-warning-ink: #B4530A;

  --radius-c2-md: 14px;
  --radius-c2-lg: 18px;
  --radius-c2-pill: 999px;
  --radius-c2-sheet: 22px;

  --shadow-c2-card: 0 2px 8px rgba(20, 48, 60, 0.06);
  --shadow-c2-sheet: 0 -6px 24px rgba(20, 48, 60, 0.12);
}
```

- [ ] **Step 2: Экспортировать новый CSS-файл из пакета**

В `packages/ui/package.json` в блок `"exports"` (после `"./tokens.css": "./src/tokens.css",`) добавить:
```json
    "./tokens-client-v2.css": "./src/tokens-client-v2.css",
```
В массив `"files"` (после `"src/tokens.css"`) добавить:
```json
    "src/tokens-client-v2.css"
```

- [ ] **Step 3: Импортировать в web**

В `apps/web/src/index.css`, после строки `@import "@masterqala/ui/tokens.css";`, добавить:
```css
@import "@masterqala/ui/tokens-client-v2.css";
```

- [ ] **Step 4: Собрать и проверить**

```bash
pnpm --filter web build
grep -o -- "--color-c2-primary:#166088" apps/web/dist/assets/*.css
```
Ожидается: build без ошибок; grep находит совпадение (значение попало в собранный CSS-бандл). Если Tailwind минифицирует без `#`-сокращений — искать просто `166088` через `grep -o "166088" apps/web/dist/assets/*.css`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/tokens-client-v2.css packages/ui/package.json apps/web/src/index.css
git commit -m "feat(ui): скоупнутые токены client-v2 (префикс c2), не трогают v1"
```

---

### Task 2: i18n-скаффолд + LoginPage v2 (splash/phone/sms)

**Files:**
- Create: `apps/web/src/features/client-v2/i18n/index.ts`
- Create: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Create: `apps/web/src/features/client-v2/i18n/locales/kk.json`
- Create: `apps/web/src/features/client-v2/i18n/locales/en.json`
- Create: `apps/web/src/features/client-v2/pages/LoginPage.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/tsconfig.app.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` из `../../../auth` (`login(token, user)`), `api()` из `../../../api`.
- Produces: `apps/web/src/features/client-v2/i18n/index.ts` default-экспортирует инициализированный `i18n` — импортируется один раз в `main.tsx`. `LoginPage` (default export) — используется в `App.tsx` вместо старого.

- [ ] **Step 1: Разрешить импорт JSON-файлов**

В `apps/web/tsconfig.app.json`, в `compilerOptions`, добавить:
```json
    "resolveJsonModule": true,
```

- [ ] **Step 2: Установить i18n-библиотеки**

```bash
pnpm --filter web add i18next react-i18next
```

- [ ] **Step 3: Файлы переводов**

`apps/web/src/features/client-v2/i18n/locales/ru.json`:
```json
{
  "common": {
    "loading": "Загрузка…"
  },
  "auth": {
    "splashTagline": "Проверенные мастера рядом",
    "phoneTitle": "Вход по номеру телефона",
    "phoneSubtitle": "Отправим SMS с кодом подтверждения",
    "phonePlaceholder": "707 123 45 67",
    "termsPrefix": "Продолжая, вы соглашаетесь с",
    "termsLink": "условиями сервиса",
    "getCodeButton": "Получить код",
    "changeNumber": "Изменить номер",
    "smsTitle": "Код из SMS",
    "smsSubtitle": "Отправили на {{phone}}",
    "resendIn": "Отправить снова через {{time}}",
    "resendNow": "Отправить код повторно",
    "loginButton": "Войти"
  }
}
```

`apps/web/src/features/client-v2/i18n/locales/kk.json` и `apps/web/src/features/client-v2/i18n/locales/en.json` (оба файла — идентичное содержимое, пустой объект; решение пользователя «только инфраструктура + RU-контент» — `fallbackLng: 'ru'` покрывает отсутствующие ключи):
```json
{}
```

- [ ] **Step 4: Инициализация i18n**

`apps/web/src/features/client-v2/i18n/index.ts`:
```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import kk from './locales/kk.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 5: Подключить в точке входа**

В `apps/web/src/main.tsx`, добавить импорт (до `import App`):
```ts
import './features/client-v2/i18n';
```

- [ ] **Step 6: LoginPage v2**

`apps/web/src/features/client-v2/pages/LoginPage.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { useAuth } from '../../../auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('splash');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'splash') return;
    const timer = setTimeout(() => setStep('phone'), 1200);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'sms' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);

  async function requestCode() {
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: `+7${phone.replace(/\D/g, '')}` }) });
      setResendIn(60);
      setStep('sms');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    setError('');
    setSubmitting(true);
    try {
      const res = await api('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: `+7${phone.replace(/\D/g, '')}`, code }),
      });
      login(res.accessToken, res.user);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'splash') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4.5 bg-c2-primary"
        onClick={() => setStep('phone')}
      >
        <div className="flex h-22 w-22 items-center justify-center rounded-c2-lg bg-white text-4xl font-extrabold text-c2-primary">
          M
        </div>
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala</div>
        <div className="text-sm text-c2-fill">{t('auth.splashTagline')}</div>
        <div className="mt-3 h-6.5 w-6.5 animate-spin rounded-full border-[3px] border-c2-fill border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3.5 bg-c2-bg px-6 py-5.5">
      {step === 'sms' && (
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="self-start text-sm font-extrabold text-c2-primary"
        >
          ← {t('auth.changeNumber')}
        </button>
      )}

      {step === 'phone' && (
        <>
          <div className="mt-6 text-[26px] font-extrabold leading-tight text-c2-ink">{t('auth.phoneTitle')}</div>
          <div className="text-sm text-c2-ink-soft">{t('auth.phoneSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface px-4 py-3.5">
            <span className="text-[17px] font-extrabold text-c2-ink">+7</span>
            <input
              className="flex-1 bg-transparent text-[17px] font-bold text-c2-ink outline-none placeholder:text-c2-muted"
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="text-xs leading-normal text-c2-ink-soft">
            {t('auth.termsPrefix')} <span className="font-bold text-c2-primary">{t('auth.termsLink')}</span>
          </div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={requestCode}
            disabled={submitting || phone.replace(/\D/g, '').length < 10}
            className="rounded-c2-pill bg-c2-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.getCodeButton')}
          </button>
        </>
      )}

      {step === 'sms' && (
        <>
          <div className="mt-2.5 text-[26px] font-extrabold leading-tight text-c2-ink">{t('auth.smsTitle')}</div>
          <div className="text-sm text-c2-ink-soft">{t('auth.smsSubtitle', { phone: `+7 ${phone}` })}</div>
          <div className="relative mt-2 w-fit" onClick={() => codeInputRef.current?.focus()}>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`flex h-14 w-10 items-center justify-center rounded-c2-md border-[1.5px] bg-c2-surface text-xl font-extrabold text-c2-ink ${
                    code[i] ? 'border-c2-primary' : 'border-c2-border'
                  }`}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="absolute inset-0 opacity-0"
            />
          </div>
          <div className="text-[13px] text-c2-ink-soft">
            {resendIn > 0 ? (
              t('auth.resendIn', { time: formatTime(resendIn) })
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-c2-primary">
                {t('auth.resendNow')}
              </button>
            )}
          </div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={verify}
            disabled={submitting || code.length < 6}
            className="rounded-c2-pill bg-c2-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.loginButton')}
          </button>
        </>
      )}
    </div>
  );
}
```

Примечание к шагу: сплэш-экран в прототипе продвигается тапом (`onClick="{{ go.phone }}"`) — для реального продукта добавлен автопереход через 1.2с (тап по-прежнему работает), т.к. требовать тап от живого пользователя на сплэше нетипично для мобильных приложений. Ввод SMS-кода в прототипе — статичная демо-заливка 2 из 4 клеток (случайное демо-число, не привязанное к реальной длине кода); в реальном коде — рабочий **6-значный** OTP-инпут (не 4, как в прототипе) поверх визуальных клеток, т.к. бэкенд генерирует и валидирует ровно 6-значный код (`apps/api/src/auth/auth.service.ts` — `randomInt(100000, 1000000)`, `apps/api/src/auth/dto.ts` — `@Length(6, 6)`; это давно существующий, вне-скоупа-этого-цикла контракт — старый v1 `LoginPage` его не нарушал только потому, что использовал обычный текстовый инпут без ограничения длины). Таймер повторной отправки — реальный обратный отсчёт с 60 секунд (прототип показывает статичное «0:42» как демо-значение).

- [ ] **Step 7: Заменить маршрут в App.tsx, удалить старый файл**

В `apps/web/src/App.tsx`: заменить `import LoginPage from './pages/LoginPage';` на `import LoginPage from './features/client-v2/pages/LoginPage';`.

```bash
rm apps/web/src/pages/LoginPage.tsx
```

- [ ] **Step 8: Собрать и проверить**

```bash
pnpm --filter web build
```
Ожидается: чистая сборка (0 ошибок TS, 0 ошибок сборки).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/client-v2/i18n apps/web/src/features/client-v2/pages/LoginPage.tsx apps/web/src/main.tsx apps/web/tsconfig.app.json apps/web/src/App.tsx apps/web/package.json pnpm-lock.yaml
git rm apps/web/src/pages/LoginPage.tsx
git commit -m "feat(web): i18n-скаффолд (react-i18next, RU+заглушки KK/EN) + LoginPage v2 по прототипу"
```

---

### Task 3: Категории-seed + мобильный shell (5-слотовый таб-бар) + HomePage v2 + заглушка Notifications

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Create: `apps/web/src/features/client-v2/categoryMeta.ts`
- Create: `apps/web/src/features/client-v2/components/AppShell.tsx`
- Create: `apps/web/src/features/client-v2/components/BottomTabBar.tsx`
- Create: `apps/web/src/features/client-v2/pages/HomePage.tsx`
- Create: `apps/web/src/features/client-v2/pages/NotificationsPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/orders/active` → `{ order: {id, status, category:{id,slug,name}, master:{id,name,phone}|null, address, ...} | null }`; `GET /api/v1/categories` → `Array<{id, slug, name}>`; `useAuth()` для `user.name`; `EmptyState` из `@masterqala/ui`.
- Produces: `AppShell` (default export) — layout-компонент для React Router (`<Outlet/>` + `BottomTabBar`), используется как `element` для маршрутов `/`, `/catalog`, `/notifications`. `categoryMeta(slug: string): { icon: string; subtitle: string }` — используется также в Task 4 (Catalog).

- [ ] **Step 1: Расширить seed-данные категорий**

В `apps/api/prisma/seed.ts`, после блока `electrics` upsert (после строки с `update: {},` для electrics, перед `const operatorPhone = ...`), добавить:
```ts
  await prisma.category.upsert({
    where: { slug: 'appliances' },
    create: { slug: 'appliances', name: 'Бытовая техника' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'locksmith' },
    create: { slug: 'locksmith', name: 'Замки и двери' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'handyman' },
    create: { slug: 'handyman', name: 'Мелкий ремонт' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'other' },
    create: { slug: 'other', name: 'Другие услуги' },
    update: {},
  });
```
Применить к локальной dev-БД:
```bash
cd apps/api && DATABASE_URL=postgresql://masterqala:masterqala@localhost:5434/masterqala_test npx prisma db seed 2>&1 | tail -5
```
(Используется реальный dev-URL проекта — если отличается от тестового 5434, взять значение из `apps/api/.env`.) Эта команда не влияет на e2e-тесты — они используют отдельный тестовый хелпер `seedCategories()` в `test/helpers.ts`, не `prisma/seed.ts`.

- [ ] **Step 2: Метаданные категорий (иконка+подзаголовок) для клиента v2**

Точные данные из прототипа (строки 909-914 `Этап 5 - Клиент (mobile).dc.html`).

`apps/web/src/features/client-v2/categoryMeta.ts`:
```ts
interface CategoryMeta {
  icon: string;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { icon: '🔧', subtitle: 'течи, засоры, смесители' },
  electrics: { icon: '⚡', subtitle: 'розетки, проводка, свет' },
  appliances: { icon: '🧊', subtitle: 'стиральные, холодильники' },
  locksmith: { icon: '🔐', subtitle: 'вскрытие, замена, установка' },
  handyman: { icon: '🔨', subtitle: 'полки, карнизы, мебель' },
  other: { icon: '🧹', subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { icon: '🛠️', subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
```

- [ ] **Step 3: Добавить переводы**

В `apps/web/src/features/client-v2/i18n/locales/ru.json`, добавить новые верхнеуровневые ключи (после `"auth": {...}`):
```json
  "home": {
    "greeting": "Что случилось, {{name}}?",
    "urgentTitle": "Срочно",
    "urgentEta": "~15 мин",
    "urgentDescription": "Найдём ближайшего мастера. Сейчас оплачивается только выезд — цену работ подтвердите после осмотра.",
    "urgentButton": "Вызвать мастера",
    "plannedTitle": "Запланировать",
    "plannedBadge": "до 5 предложений",
    "plannedDescription": "Мастера предложат цену и срок — сравните рейтинг, опыт и стоимость и выберите сами.",
    "plannedButton": "Создать заявку",
    "categoriesTitle": "Категории",
    "categoriesAll": "Все",
    "trustBanner": "Все мастера проходят проверку документов. Оплата защищена, при проблеме — спор и поддержка 24/7."
  },
  "tabs": {
    "home": "Главная",
    "orders": "Заявки",
    "notifications": "Уведомл.",
    "profile": "Профиль"
  },
  "notifications": {
    "title": "Уведомления",
    "emptyTitle": "Пока нет уведомлений",
    "emptySubtitle": "Здесь появятся новости по вашим заявкам"
  }
```
(Помнить о запятой после закрывающей `}` блока `auth`.)

- [ ] **Step 4: Bottom tab bar (5 слотов, точно по прототипу строки 822-830)**

`apps/web/src/features/client-v2/components/BottomTabBar.tsx`:
```tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-extrabold ${
    isActive ? 'text-c2-primary' : 'text-c2-ink-soft'
  }`;

export default function BottomTabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="flex items-end border-t border-c2-border bg-c2-surface px-1.5 pb-3.5 pt-1.5">
      <NavLink to="/" end className={tabClass}>
        <span className="text-[19px]">⌂</span>
        {t('tabs.home')}
      </NavLink>
      <NavLink to="/orders" className={tabClass}>
        <span className="text-[19px]">☰</span>
        {t('tabs.orders')}
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => navigate('/order/new')}
          className="-mt-5.5 flex h-13 w-13 items-center justify-center rounded-full bg-c2-primary text-2xl text-white shadow-c2-card"
          aria-label={t('home.urgentButton')}
        >
          ＋
        </button>
      </div>
      <NavLink to="/notifications" className={tabClass}>
        <span className="text-[19px]">🔔</span>
        {t('tabs.notifications')}
      </NavLink>
      <NavLink to="/profile" className={tabClass}>
        <span className="text-[19px]">◉</span>
        {t('tabs.profile')}
      </NavLink>
    </nav>
  );
}
```

- [ ] **Step 5: AppShell**

`apps/web/src/features/client-v2/components/AppShell.tsx`:
```tsx
import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-c2-bg">
      <div className="flex-1 pb-2">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
}
```

- [ ] **Step 6: HomePage v2**

Точные тексты и структура — прототип строки 88-143 (баннер активной заявки, кнопка «Срочно», кнопка «Запланировать», сетка категорий 3×2, баннер доверия).

`apps/web/src/features/client-v2/pages/HomePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import { useAuth } from '../../../auth';
import { STATUS_LABELS } from '../../../orderStatus';
import { categoryMeta } from '../categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ActiveOrder {
  id: string;
  status: string;
  category: { name: string } | null;
}

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api('/categories').then(setCategories);
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) return <div className="p-6 text-c2-ink-soft">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-extrabold text-c2-ink">
          {t('home.greeting', { name: user?.name ?? 'Гость' })}
        </div>
        <Link
          to="/support"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-c2-border bg-c2-surface text-base"
        >
          ?
        </Link>
      </div>

      {order && (
        <button
          type="button"
          onClick={() => navigate(`/order/${order.id}`)}
          className="flex items-center gap-3 rounded-c2-lg bg-c2-primary p-4 text-left"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-c2-fill text-[13px] font-extrabold text-c2-ink">
            {order.category?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-white">{order.category?.name}</div>
            <div className="truncate text-xs font-semibold text-c2-fill">{STATUS_LABELS[order.status]}</div>
          </div>
          <span className="text-lg text-c2-fill">›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate('/order/new')}
        className="rounded-c2-lg border-2 border-c2-primary bg-c2-surface p-4 text-left shadow-c2-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-c2-ink">⚡ {t('home.urgentTitle')}</span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-c2-primary">
            {t('home.urgentEta')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-c2-ink-soft">{t('home.urgentDescription')}</div>
        <div className="mt-2.5 rounded-c2-pill bg-c2-primary p-2.5 text-center text-sm font-extrabold text-white">
          {t('home.urgentButton')}
        </div>
      </button>

      <Link
        to="/planned/new"
        className="rounded-c2-lg border-2 border-c2-border bg-c2-surface p-4 text-left shadow-c2-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-c2-ink">📅 {t('home.plannedTitle')}</span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-c2-primary">
            {t('home.plannedBadge')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-c2-ink-soft">{t('home.plannedDescription')}</div>
        <div className="mt-2.5 rounded-c2-pill border-[1.5px] border-c2-primary p-2.5 text-center text-sm font-extrabold text-c2-primary">
          {t('home.plannedButton')}
        </div>
      </Link>

      {categories.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold text-c2-ink">{t('home.categoriesTitle')}</span>
            <Link to="/catalog" className="text-[12.5px] font-extrabold text-c2-primary">
              {t('home.categoriesAll')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => {
              const meta = categoryMeta(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate('/order/new')}
                  className="rounded-c2-md border border-c2-border bg-c2-surface px-1.5 py-3 text-center"
                >
                  <div className="mb-1 text-xl">{meta.icon}</div>
                  <div className="text-[11.5px] font-bold text-c2-ink">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-c2-md bg-c2-fill px-3.5 py-3">
        <span className="text-lg">🛡️</span>
        <div className="text-xs font-semibold leading-snug text-c2-ink">{t('home.trustBanner')}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: NotificationsPage — честный empty state (не выдуманные данные)**

Реальный источник данных для ленты уведомлений не спроектирован (нет отдельной таблицы уведомлений, решение по объёму — Фаза D). Показывать здесь придуманные карточки — нарушение политики проекта «не фабриковать данные без реального источника». Экран честно показывает пустое состояние через уже существующий `EmptyState` из `@masterqala/ui`.

`apps/web/src/features/client-v2/pages/NotificationsPage.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@masterqala/ui';

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-[22px] font-extrabold text-c2-ink">{t('notifications.title')}</div>
      <EmptyState icon={<span className="text-3xl">🔔</span>} title={t('notifications.emptyTitle')} subtitle={t('notifications.emptySubtitle')} />
    </div>
  );
}
```

- [ ] **Step 8: Вписать в роутинг**

В `apps/web/src/App.tsx`:
- Заменить `import HomePage from './pages/HomePage';` на `import HomePage from './features/client-v2/pages/HomePage';`
- Добавить `import AppShell from './features/client-v2/components/AppShell';` и `import NotificationsPage from './features/client-v2/pages/NotificationsPage';`
- Изменить структуру маршрутов: вынести `/`  в отдельный `<Route element={<AppShell />}>`-блок вместе с `/notifications` (и `/catalog` в Task 4), оставив `/orders`, `/order/new`, `/order/:id`, `/planned/new`, `/planned/:id`, `/work`, `/lead-credits`, `/wallet`, `/profile` под старым `<Route element={<Layout />}>`:

```tsx
<Route element={<RequireAuth />}>
  <Route element={<AppShell />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
  </Route>
  <Route element={<Layout />}>
    <Route path="/orders" element={<MyOrdersPage />} />
    <Route path="/order/new" element={<NewOrderPage />} />
    <Route path="/order/:id" element={<OrderPage />} />
    <Route path="/planned/new" element={<PlannedNewOrderPage />} />
    <Route path="/planned/:id" element={<PlannedOrderPage />} />
    <Route path="/work" element={<WorkPage />} />
    <Route path="/lead-credits" element={<LeadCreditsPage />} />
    <Route path="/wallet" element={<WalletPage />} />
    <Route path="/profile" element={<ProfilePage />} />
  </Route>
  <Route path="/become-master" element={<BecomeMasterPage />} />
  <Route element={<RequireOperator />}>
    <Route path="/admin" element={<AdminListPage />} />
    <Route path="/admin/:id" element={<AdminDetailPage />} />
    <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
    <Route path="/admin/disputes" element={<AdminDisputesPage />} />
    <Route path="/admin/disputes/:id" element={<AdminDisputeDetailPage />} />
  </Route>
</Route>
```
`/support` временно не существует как маршрут (появится в Фазе D) — ссылка `HomePage`→`/support` заведёт на 404-редирект React Router (`<Routes>` без catch-all — уточнить: если в `App.tsx` нет catch-all `*`, добавить временный `<Route path="/support" element={<Navigate to="/" replace />} />` рядом с `/notifications`, чтобы не было мёртвой ссылки до Фазы D).

```bash
rm apps/web/src/pages/HomePage.tsx
```

- [ ] **Step 9: Собрать и проверить**

```bash
pnpm --filter web build
```
Ожидается: чистая сборка.

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/seed.ts apps/web/src/features/client-v2 apps/web/src/App.tsx
git rm apps/web/src/pages/HomePage.tsx
git commit -m "feat(web): seed 6 категорий + AppShell/BottomTabBar + HomePage v2 + заглушка Notifications"
```

---

### Task 4: CatalogPage v2

**Files:**
- Create: `apps/web/src/features/client-v2/pages/CatalogPage.tsx`
- Modify: `apps/web/src/features/client-v2/i18n/locales/ru.json`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/categories`, `categoryMeta(slug)` из Task 3.

Точная структура — прототип строки 145-160: заголовок с кнопкой назад, строка поиска (визуальная, без реальной фильтрации в Фазе A — список короткий, 6 категорий, полнотекстовый поиск избыточен на этом объёме; решение — оставить строку как статичный визуальный элемент, не заводить состояние фильтра, пересмотреть при росте каталога), список категорий с иконкой+подзаголовком.

- [ ] **Step 1: Добавить переводы**

В `ru.json`, добавить (после блока `"notifications"`):
```json
  "catalog": {
    "title": "Все категории",
    "searchPlaceholder": "🔍 Поиск услуги…"
  }
```

- [ ] **Step 2: CatalogPage**

`apps/web/src/features/client-v2/pages/CatalogPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { categoryMeta } from '../categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api('/categories').then(setCategories);
  }, []);

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="text-xl font-extrabold text-c2-ink">{t('catalog.title')}</span>
      </div>
      <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface px-3.5 py-3 text-sm text-c2-muted">
        {t('catalog.searchPlaceholder')}
      </div>
      {categories.map((c) => {
        const meta = categoryMeta(c.slug);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate('/order/new')}
            className="flex items-center gap-3 rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5 text-left"
          >
            <span className="text-xl">{meta.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-extrabold text-c2-ink">{c.name}</div>
              <div className="text-[11.5px] text-c2-ink-soft">{meta.subtitle}</div>
            </div>
            <span className="text-c2-ink-soft">›</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Вписать маршрут**

В `apps/web/src/App.tsx`:
- Добавить `import CatalogPage from './features/client-v2/pages/CatalogPage';`
- Добавить `<Route path="/catalog" element={<CatalogPage />} />` внутрь блока `<Route element={<AppShell />}>` (рядом с `/` и `/notifications`).

- [ ] **Step 4: Собрать и проверить**

```bash
pnpm --filter web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/client-v2 apps/web/src/App.tsx
git commit -m "feat(web): CatalogPage v2 по прототипу"
```

---

## После завершения всех задач (контроллер, не саб-агент)

1. Полная сборка: `pnpm --filter web build` и `pnpm --filter api build` (seed-файл — часть api-пакета).
2. Живая браузерная проверка через `preview_*` тулы: пройти splash→phone→sms→home→catalog, убедиться что таб-бар переключает `/`, `/orders` (старый стиль — ожидаемо), `/notifications` (empty state), `/profile` (старый стиль — ожидаемо); проверить, что `+`-кнопка ведёт на `/order/new`.
3. Финальный whole-branch review (opus) диапазона коммитов этой фазы.
4. Обновить память проекта и `.superpowers/sdd/progress.md`.
