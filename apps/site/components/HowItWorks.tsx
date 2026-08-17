import { Badge, Card } from '@masterqala/ui';

const STEPS = [
  {
    title: 'Опишите проблему',
    description: 'Выберите категорию и укажите адрес — система сразу покажет стоимость выезда.',
  },
  {
    title: 'Мастер принимает заявку',
    description: 'Ближайший свободный мастер откликается и сообщает время приезда.',
  },
  {
    title: 'Оплата после работы',
    description: 'Мастер называет цену на месте, вы её подтверждаете и платите напрямую — без переплат посредникам.',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mx-auto max-w-6xl px-6 py-16">
      <h2 id="how-it-works-heading" className="text-center text-3xl font-bold text-ink">
        Как это работает
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card as="li" key={step.title} padding="lg" className="flex flex-col items-start gap-2">
            <Badge tone="primary">Шаг {index + 1}</Badge>
            <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
            <p className="text-sm text-ink-soft">{step.description}</p>
          </Card>
        ))}
      </ol>
    </section>
  );
}
