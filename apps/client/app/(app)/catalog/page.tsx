'use client';
import Link from 'next/link';
import {CategoryBrowserView, useCategoryBrowser,useLocale} from '@masterqala/ui';
import {api} from '../../../lib/api';
import {useTranslation} from 'react-i18next';
import {designCopy} from '../../../components/desktop-service/design-copy';
export default function CatalogPage() {
  const state = useCategoryBrowser({api});
  const {t}=useTranslation();
  const {language}=useLocale(),copy=designCopy[language];
  const categories=state.categories.map(category=>({...category,name:t(`newOrder.category_${category.slug}`,{defaultValue:category.name})}));
  return <CategoryBrowserView {...state} presentation={{intro:copy.catalogBody,filterTitle:copy.filterHeading,actionLabel:copy.categoryAction}} categories={categories} categoryHref={category=>`/?category=${encodeURIComponent(category.id)}`} onRetry={() => {void state.retry();}} renderLink={({href, children, className, ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
