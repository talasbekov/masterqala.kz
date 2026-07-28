import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { CategoryTile } from '@/components/CategoryTile';
import { getCategories } from '@/lib/categories';
import { getAppUrl } from '@/lib/env';

export default async function HomePage() {
  const categories = await getCategories();
  const appUrl = getAppUrl();

  return (
    <main>
      <Hero />
      <HowItWorks />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-ink">Категории услуг</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {categories.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="bg-fill-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-ink">Нужен мастер прямо сейчас?</h2>
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover"
          >
            Оставить заявку
          </a>
        </div>
      </section>
    </main>
  );
}
