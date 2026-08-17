import Link from 'next/link';
import { getContactEmail, getContactPhone } from '@/lib/env';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-ink">MasterQala</p>
          <p>Мастер на дом — быстро и по понятной цене</p>
        </div>
        <nav aria-label="Ссылки в подвале" className="flex flex-col gap-2 md:flex-row md:gap-6">
          <Link href="/about" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
            О нас
          </Link>
          <Link href="/faq" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
            Вопросы
          </Link>
          <Link href="/become-a-master" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
            Стать мастером
          </Link>
        </nav>
        <div>
          <p>{getContactPhone()}</p>
          <p>{getContactEmail()}</p>
        </div>
      </div>
    </footer>
  );
}
