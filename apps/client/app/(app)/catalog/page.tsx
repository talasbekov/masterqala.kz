'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, ChevronRightIcon, IconButton, SearchIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api('/categories').then(setCategories);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={() => router.push('/')} />
        <h1 className="text-xl font-extrabold text-ink">{t('catalog.title')}</h1>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 py-3 text-sm text-ink-muted">
        <SearchIcon size={18} />
        {t('catalog.searchPlaceholder')}
      </div>
      <ul className="flex flex-col gap-2">
        {categories.map((c) => {
          const { Icon, subtitle } = categoryMeta(c.slug);
          return (
            <li key={c.id}>
              <Link
                href="/order/new"
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3.5 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken"
              >
                <Icon size={22} className="shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-extrabold text-ink">{c.name}</span>
                  <span className="block text-2xs text-ink-soft">{subtitle}</span>
                </span>
                <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
