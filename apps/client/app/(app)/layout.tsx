import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Мобильный порядок: навигация сверху, контент под ней. С md — колонками.
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Обход навигации с клавиатуры: класс .skip-link описан в base.css. */}
      <a href="#main" className="skip-link">
        К основному содержимому
      </a>
      <Sidebar />
      <main id="main" className="min-w-0 flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
