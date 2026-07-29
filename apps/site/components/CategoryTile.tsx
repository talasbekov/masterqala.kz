import Link from 'next/link';
import type { Category } from '@/lib/categories';

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-6 shadow-card transition hover:border-primary"
    >
      <span className="text-lg font-semibold text-ink">{category.name}</span>
      <span className="text-sm text-ink-soft">Смотреть →</span>
    </Link>
  );
}
