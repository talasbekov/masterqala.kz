import Link from 'next/link';
import { ChevronRightIcon } from '@masterqala/ui';
import type { Category } from '@/lib/categories';

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-6 shadow-card transition-colors duration-(--duration-fast) ease-(--ease-out) hover:border-primary"
    >
      <span className="text-lg font-semibold text-ink">{category.name}</span>
      <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
        Смотреть
        <ChevronRightIcon size={16} className="shrink-0" />
      </span>
    </Link>
  );
}
