import { notFound } from 'next/navigation';
import { getCategories } from '@/lib/categories';
import { getCategoryContent } from '@/lib/category-content';
import { getAppUrl } from '@/lib/env';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">{category.name}</h1>
      <p className="mt-4 text-lg text-ink-soft">{content.description}</p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Типовые работы</h2>
      <ul className="mt-4 flex flex-col gap-2 text-ink-soft">
        {content.typicalWork.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>—</span>
            {item}
          </li>
        ))}
      </ul>

      <a
        href={appUrl}
        className="mt-10 inline-block rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
      >
        Оставить заявку
      </a>
    </main>
  );
}
