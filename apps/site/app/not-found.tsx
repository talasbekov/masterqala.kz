import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-3xl font-bold text-ink">Страница не найдена</h1>
      <p className="text-ink-soft">Такой страницы нет — возможно, ссылка устарела.</p>
      <Link href="/" className="rounded-pill bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-hover">
        На главную
      </Link>
    </main>
  );
}
