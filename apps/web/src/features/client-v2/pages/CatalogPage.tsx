import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { ArrowLeftIcon, Card, ChevronRightIcon, IconButton, SearchIcon } from '@masterqala/ui';
import { categoryMeta } from '../categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api('/categories').then(setCategories);
  }, []);

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={() => navigate('/')} />
        <h1 className="text-xl font-extrabold text-ink">{t('catalog.title')}</h1>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 py-3 text-sm text-ink-muted">
        <SearchIcon size={18} />
        {t('catalog.searchPlaceholder')}
      </div>
      {categories.map((c) => {
        const meta = categoryMeta(c.slug);
        return (
          <Card key={c.id} padding="none">
            <button
              type="button"
              onClick={() => navigate('/order/new')}
              className="flex w-full min-h-11 items-center gap-3 px-3.5 py-3.5 text-left"
            >
              <span className="shrink-0 text-primary">{meta.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-extrabold text-ink">{c.name}</div>
                <div className="text-2xs text-ink-soft">{meta.subtitle}</div>
              </div>
              <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}
