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
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center text-3xl font-bold text-ink">Как это работает</h2>
      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex flex-col gap-2 rounded-md bg-surface p-6 shadow-card">
            <span className="text-sm font-semibold text-primary">Шаг {index + 1}</span>
            <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
            <p className="text-sm text-ink-soft">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
