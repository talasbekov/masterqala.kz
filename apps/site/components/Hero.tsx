import { getAppUrl } from '@/lib/env';

export function Hero() {
  const appUrl = getAppUrl();

  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 text-center md:py-28">
        <h1 className="text-4xl font-bold text-ink md:text-5xl">Мастер на дом — быстро и по понятной цене</h1>
        <p className="mx-auto max-w-2xl text-lg text-ink-soft">
          Сантехник, электрик или мастер по ремонту техники приедут в удобное время. Вы видите стоимость выезда
          заранее и платите мастеру напрямую после работы.
        </p>
        <div className="mx-auto flex flex-col gap-4 sm:flex-row">
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
          >
            Оставить заявку
          </a>
          <a
            href="/become-a-master"
            className="rounded-pill border border-primary px-8 py-3 font-semibold text-primary hover:bg-fill-soft"
          >
            Стать мастером
          </a>
        </div>
      </div>
    </section>
  );
}
