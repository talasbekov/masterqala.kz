import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { OperatorMetricsProvider } from '@/lib/operatorMetrics';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorMetricsProvider>
      {/* Ссылка «к основному содержимому»: первый Tab на странице пропускает
          девять пунктов меню. Стили .skip-link живут в base.css. */}
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </OperatorMetricsProvider>
  );
}
