'use client';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleSelector } from './LocaleSelector';
import type { Locale } from './locale-data';

interface DialogRouter {
  push: (href: string, options?: { scroll: boolean }) => void;
  replace: (href: string, options?: { scroll: boolean }) => void;
  back: () => void;
}
const OpenLanguageDialog = createContext<(() => void) | null>(null);
export function useLanguageDialog() {
  const open = useContext(OpenLanguageDialog);
  if (!open) throw new Error('Language controls require LanguageDialogController');
  return open;
}
function dialogUrl(href: string, open: boolean) {
  const url = new URL(href, 'https://masterqala.local');
  if (open) url.searchParams.set('modal', 'language');
  else url.searchParams.delete('modal');
  return url.pathname + url.search + url.hash;
}

/** The current Next route owns the dialog. No global history locks or pending promises. */
export function LanguageDialogController({ href, router, locale, onSelect, children }: {
  href: string; router: DialogRouter; locale: Locale; onSelect: (locale: Locale) => void; children?: ReactNode;
}) {
  const routeOpen = new URL(href, 'https://masterqala.local').searchParams.get('modal') === 'language';
  const ownedHref = useRef<string | null>(null);
  const closingHref = useRef<string | null>(null);
  const [, renderDismissal] = useState(0);
  // Route changes and fresh mounts release dismissal guards even if traversal was cancelled.
  if (closingHref.current !== href) closingHref.current = null;
  if (ownedHref.current !== href && !routeOpen) ownedHref.current = null;

  function open() {
    if (routeOpen || closingHref.current === href) return;
    const next = dialogUrl(href, true);
    ownedHref.current = next;
    router.push(next, { scroll: false });
  }
  function dismiss() {
    if (!routeOpen || closingHref.current === href) return;
    closingHref.current = href;
    renderDismissal(value => value + 1);
    if (ownedHref.current === href) router.back();
    else router.replace(dialogUrl(href, false), { scroll: false });
  }
  return <OpenLanguageDialog.Provider value={open}>
    {children}
    <LocaleSelector open={routeOpen && closingHref.current !== href} locale={locale} onSelect={onSelect} onDismiss={dismiss} />
  </OpenLanguageDialog.Provider>;
}
