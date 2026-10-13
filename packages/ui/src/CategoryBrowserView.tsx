'use client';
import {useState} from 'react';
import type {ReactNode} from 'react';
import {useLocale} from './Locale';
import {TextField} from './TextField';
import {Button} from './Button';
import {categoryBrowserText} from './category-browser-copy';
import type {BrowseCategory} from './hooks/useCategoryBrowser';
import type {OwnedOrderLinkProps} from './OwnedOrdersView';
export function CategoryBrowserView({categories, loading, error, onRetry, renderLink}: {categories: BrowseCategory[]; loading: boolean; error: string; onRetry: () => void; renderLink: (props: OwnedOrderLinkProps) => ReactNode}) {
  const {language} = useLocale();
  const [query, setQuery] = useState('');
  const text = (key: Parameters<typeof categoryBrowserText>[1], name?: string) => categoryBrowserText(language, key, name);
  const needle = query.trim().toLocaleLowerCase(language === 'kk' ? 'kk-KZ' : language === 'ru' ? 'ru-RU' : 'en-US');
  const visible = categories.filter(category => category.name.toLocaleLowerCase(language === 'kk' ? 'kk-KZ' : language === 'ru' ? 'ru-RU' : 'en-US').includes(needle));
  return <section className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-6 px-6 py-6" aria-labelledby="category-browser-title">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 id="category-browser-title" className="min-w-0 break-words text-[28px] font-medium leading-[1.4] md:text-[32px] md:font-semibold">{text('title')}</h1>{renderLink({href:'/', children:text('back'), className:'inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary'})}</header>
    <p className="text-base leading-6 text-ink-soft">{text('guidance')}</p>
    <TextField type="search" label={text('search')} value={query} onChange={event => setQuery(event.target.value)} variant="responsive" fullWidth/>
    {loading && <p role="status">{text('loading')}</p>}
    {!!error && <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-fill-soft p-6"><p>{text('error')}</p>{categories.length > 0 && <p data-category-stale>{text('stale')}</p>}<Button variant="secondary" disabled={loading} onClick={onRetry}>{text('retry')}</Button></div>}
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{visible.map(category => <div key={category.id} className="min-w-0">{renderLink({href:'/order/new', children:category.name, ariaLabel:text('order', category.name), className:'flex min-h-[56px] min-w-0 items-center rounded-2xl border border-border bg-surface p-6 text-xl font-semibold leading-[1.4] text-primary break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'})}</div>)}</div>
    {!loading && !error && categories.length === 0 && <p data-category-empty>{text('empty')}</p>}
    {categories.length > 0 && visible.length === 0 && <p data-category-no-match>{text('noMatch')}</p>}
  </section>;
}
