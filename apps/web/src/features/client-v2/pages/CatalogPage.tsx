import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
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
        <button type="button" onClick={() => navigate('/')} className="text-xl text-primary">
          ←
        </button>
        <span className="text-xl font-extrabold text-ink">{t('catalog.title')}</span>
      </div>
      <div className="rounded-md border-[1.5px] border-border bg-surface px-3.5 py-3 text-sm text-muted">
        {t('catalog.searchPlaceholder')}
      </div>
      {categories.map((c) => {
        const meta = categoryMeta(c.slug);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate('/order/new')}
            className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3.5 text-left"
          >
            <span className="text-xl">{meta.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-extrabold text-ink">{c.name}</div>
              <div className="text-[11.5px] text-ink-soft">{meta.subtitle}</div>
            </div>
            <span className="text-ink-soft">›</span>
          </button>
        );
      })}
    </div>
  );
}
