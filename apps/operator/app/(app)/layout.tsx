import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { OperatorMetricsProvider } from '@/lib/operatorMetrics';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorMetricsProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </OperatorMetricsProvider>
  );
}
