import type { Metadata } from 'next';
import { ChevronDownIcon } from '@masterqala/ui';
import { OG_IMAGE } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Частые вопросы',
  description:
    'Как оплатить работу мастера, что делать, если мастер не приехал, в каких районах Астаны работает MasterQala и как открыть спор — ответы на частые вопросы.',
  alternates: { canonical: '/faq' },
  openGraph: {
    url: '/faq',
    title: 'Частые вопросы — MasterQala',
    description: 'Оплата, проверка мастеров, география работы и споры — коротко и по делу.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Частые вопросы — MasterQala',
    description: 'Оплата, проверка мастеров, география работы и споры — коротко и по делу.',
    images: [OG_IMAGE],
  },
};

const FAQ_ITEMS = [
  {
    question: 'Как оплатить работу мастера?',
    answer:
      'Вы платите мастеру напрямую после выполнения работы — сервис не участвует в расчёте за саму работу. Сервисный сбор за срочный вызов списывается через приложение.',
  },
  {
    question: 'Что если мастер не приехал?',
    answer:
      'Если мастер не подтвердил приезд или не вышел на связь, заявка автоматически уходит следующему свободному мастеру в радиусе поиска — вы не остаётесь без помощи.',
  },
  {
    question: 'В каких районах вы работаете?',
    answer:
      'Сейчас сервис работает в пилотном режиме в Астане (Есильский район). География расширяется по мере роста числа мастеров.',
  },
  {
    question: 'Как вы проверяете мастеров?',
    answer: 'Каждый мастер проходит ручную проверку документов и опыта оператором перед тем, как получить доступ к заявкам.',
  },
  {
    question: 'Можно ли узнать цену заранее?',
    answer:
      'Стоимость выезда мастера показывается сразу при создании срочной заявки. Итоговая цена работ называется мастером на месте после осмотра и требует вашего подтверждения до начала работ.',
  },
  {
    question: 'Что делать, если возник спор с мастером?',
    answer:
      'В приложении можно открыть спор по заявке — его разбирает оператор поддержки и принимает решение по компенсации при необходимости.',
  },
  {
    question: 'Нужно ли скачивать приложение?',
    answer: 'Нет, MasterQala работает как веб-приложение прямо в браузере — устанавливать ничего не нужно.',
  },
];

export default function FaqPage() {
  /* FAQPage — тот же список, что видит человек. Расхождение разметки и
     содержимого страницы Google считает нарушением. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <h1 className="text-3xl font-bold text-ink">Частые вопросы</h1>
      <div className="mt-8 flex flex-col divide-y divide-border">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group py-2">
            {/* Нативный <details> уже доступен с клавиатуры; здесь ему добавлена
                видимая цель нажатия в 44px и маркер состояния помимо цвета. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 font-semibold text-ink hover:text-primary">
              {item.question}
              <ChevronDownIcon
                size={20}
                className="shrink-0 text-ink-soft transition-transform duration-(--duration-fast) group-open:rotate-180"
              />
            </summary>
            <p className="pb-2 text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
