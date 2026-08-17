import { Badge, Card, CheckCircleIcon, CoinsIcon, MapPinIcon, ScaleIcon, ShieldIcon } from '@masterqala/ui';

/*
 * Блок доверия. Все утверждения здесь — правила продукта из docs/product/spec.md
 * (§2 модель, §3.1 онбординг, §3.9 спор, §5 деньги). Ни отзывов, ни счётчиков,
 * ни рейтингов: на пилоте их нет, а выдуманные цифры — это ложь в разметке.
 */
const POINTS = [
  {
    icon: <CoinsIcon size={24} />,
    title: 'Мастер получает 100% стоимости работ',
    text: 'Платформа не берёт комиссию с работы. Мы зарабатываем только на сервисном сборе за срочный вызов и на lead-кредитах за отклики.',
  },
  {
    icon: <ShieldIcon size={24} />,
    title: 'Мастера проходят ручную проверку',
    text: 'Документы и опыт каждого мастера проверяет оператор до того, как мастер получит доступ к заявкам.',
  },
  {
    icon: <CheckCircleIcon size={24} />,
    title: 'Цена — с вашим подтверждением',
    text: 'Стоимость выезда видна ещё до создания срочной заявки. Цену работ мастер называет после осмотра, и работа начинается только после вашего согласия.',
  },
  {
    icon: <ScaleIcon size={24} />,
    title: 'Спор разбирает оператор',
    text: 'Если что-то пошло не так, спор по заявке можно открыть прямо в приложении — решение принимает оператор поддержки.',
  },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-heading" className="bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 id="trust-heading" className="text-center text-3xl font-bold text-ink">
          Почему нам можно доверять
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-ink-soft">
          Правила сервиса одинаковы для всех и не меняются по ходу заказа.
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {POINTS.map((point) => (
            <Card as="li" key={point.title} padding="lg" className="flex flex-col gap-2">
              <span className="text-primary" aria-hidden="true">
                {point.icon}
              </span>
              <h3 className="text-lg font-semibold text-ink">{point.title}</h3>
              <p className="text-sm text-ink-soft">{point.text}</p>
            </Card>
          ))}
        </ul>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-soft">
          <Badge tone="primary" icon={<MapPinIcon size={14} />}>
            Астана
          </Badge>
          Пилотный запуск — Есильский район. География расширяется по мере роста числа мастеров.
        </p>
      </div>
    </section>
  );
}
