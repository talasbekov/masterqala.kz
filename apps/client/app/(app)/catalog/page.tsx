'use client';
import Link from 'next/link';
import {CategoryBrowserView, useCategoryBrowser} from '@masterqala/ui';
import {api} from '../../../lib/api';
export default function CatalogPage() {
  const state = useCategoryBrowser({api});
  return <CategoryBrowserView {...state} onRetry={() => {void state.retry();}} renderLink={({href, children, className, ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
