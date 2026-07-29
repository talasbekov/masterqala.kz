import { getAppUrl } from '@/lib/env';

const HOW_IT_WORKS = [
  {
    title: 'Срочные заявки — бесплатно',
    description: 'Мастер получает срочные заявки в радиусе поиска без каких-либо платежей — плата берётся с клиента.',
  },
  {
    title: 'Плановые заявки — по lead-кредитам',
    description: 'За отклик на плановую заявку списывается lead-кредит. Если клиент не выбрал вас — кредит возвращается.',
  },
  {
    title: '100% стоимости работ — ваши',
    description: 'Платформа не берёт комиссию с работы. Доход платформы — только сервисный сбор с клиента и lead-кредиты.',
  },
];

const REQUIREMENTS = [
  'Подтверждённые документы и опыт в выбранной категории',
  'Ручная проверка оператором перед первым заказом',
  'Работа в выбранном районе — сами решаете, в каком радиусе принимать заявки',
];

export default function BecomeAMasterPage() {
  const appUrl = getAppUrl();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Станьте мастером MasterQala</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Получайте заявки от клиентов рядом с вами — без ежемесячной платы за рекламу.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Как это работает</h2>
      <div className="mt-4 flex flex-col gap-4">
        {HOW_IT_WORKS.map((item) => (
          <div key={item.title} className="rounded-md border border-border bg-surface p-4">
            <p className="font-semibold text-ink">{item.title}</p>
            <p className="text-sm text-ink-soft">{item.description}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold text-ink">Что нужно для старта</h2>
      <ul className="mt-4 flex flex-col gap-2 text-ink-soft">
        {REQUIREMENTS.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>—</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={`${appUrl}/become-master`}
        className="mt-10 inline-block rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
      >
        Подать заявку
      </a>
    </main>
  );
}
