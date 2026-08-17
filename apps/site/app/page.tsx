import type { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Trust } from '@/components/Trust';
import { CategoryTile } from '@/components/CategoryTile';
import { getCategories } from '@/lib/categories';
import { getAppUrl, getSiteUrl, getVerifiedContactEmail, getVerifiedContactPhone } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Мастер на дом в Астане — сантехник, электрик, ремонт техники',
  description:
    'Вызовите проверенного мастера на дом в Астане: сантехника, электрика, мастера по ремонту бытовой техники. Стоимость выезда известна заранее, работу вы оплачиваете мастеру напрямую.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'Мастер на дом в Астане — MasterQala',
    description:
      'Проверенные мастера бытовых услуг в Астане. Стоимость выезда видна заранее, цену работ вы подтверждаете до начала.',
  },
  twitter: {
    title: 'Мастер на дом в Астане — MasterQala',
    description:
      'Проверенные мастера бытовых услуг в Астане. Стоимость выезда видна заранее, цену работ вы подтверждаете до начала.',
  },
};

export default async function HomePage() {
  const categories = await getCategories();
  const appUrl = getAppUrl();
  const siteUrl = getSiteUrl();
  const phone = getVerifiedContactPhone();
  const email = getVerifiedContactEmail();

  /*
   * Structured data. LocalBusiness — сервис привязан к городу и обслуживает
   * конкретную географию. Контакты попадают в разметку только если заданы
   * переменными окружения: значения-заглушки поисковику отдавать нельзя.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': `${siteUrl}/#business`,
    name: 'MasterQala',
    url: siteUrl,
    description:
      'Сервис вызова проверенных мастеров бытовых услуг на дом: сантехника, электрика, ремонт бытовой техники, замки и мелкий ремонт.',
    areaServed: {
      '@type': 'City',
      name: 'Астана',
      address: { '@type': 'PostalAddress', addressCountry: 'KZ', addressLocality: 'Астана' },
    },
    availableLanguage: ['ru'],
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    makesOffer: categories.map((category) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: category.name, url: `${siteUrl}/categories/${category.slug}` },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Названия категорий приходят из API: экранируем «<», иначе строка
        // «</script>» в данных закрыла бы тег и выполнилась как разметка.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <Hero />
      <HowItWorks />
      <Trust />

      <section aria-labelledby="categories-heading" className="mx-auto max-w-6xl px-6 py-16">
        <h2 id="categories-heading" className="text-center text-3xl font-bold text-ink">
          Категории услуг
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryTile category={category} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cta-heading" className="bg-fill-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 id="cta-heading" className="text-2xl font-bold text-ink">
            Нужен мастер прямо сейчас?
          </h2>
          <a
            href={appUrl}
            className="inline-flex min-h-11 items-center rounded-pill bg-primary px-8 font-semibold text-on-primary hover:bg-primary-hover"
          >
            Оставить заявку
          </a>
        </div>
      </section>
    </>
  );
}
