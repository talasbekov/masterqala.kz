import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategories } from '@/lib/categories';
import { getCategoryContent } from '@/lib/category-content';
import { getAppUrl, getSiteUrl } from '@/lib/env';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    return { title: 'Категория не найдена', robots: { index: false, follow: false } };
  }

  const content = getCategoryContent(category.slug);
  const title = `${category.name} на дом в Астане`;

  return {
    title,
    description: content.description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: {
      url: `/categories/${category.slug}`,
      title: `${title} — MasterQala`,
      description: content.description,
    },
    twitter: {
      title: `${title} — MasterQala`,
      description: content.description,
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }

  const content = getCategoryContent(category.slug);
  const appUrl = getAppUrl();
  const siteUrl = getSiteUrl();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: category.name,
    description: content.description,
    url: `${siteUrl}/categories/${category.slug}`,
    serviceType: category.name,
    areaServed: { '@type': 'City', name: 'Астана' },
    provider: { '@type': 'HomeAndConstructionBusiness', name: 'MasterQala', '@id': `${siteUrl}/#business` },
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <h1 className="text-3xl font-bold text-ink">{category.name}</h1>
      <p className="mt-4 text-lg text-ink-soft">{content.description}</p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Типовые работы</h2>
      <ul className="mt-4 flex flex-col gap-2 text-ink-soft">
        {content.typicalWork.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">—</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={appUrl}
        className="mt-10 inline-flex min-h-11 items-center rounded-pill bg-primary px-8 font-semibold text-on-primary hover:bg-primary-hover"
      >
        Оставить заявку
      </a>
    </div>
  );
}
