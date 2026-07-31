'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMetrics, type DashboardMetrics } from './metrics';
import { useAuth } from './auth';

const POLL_INTERVAL_MS = 30_000;

interface OperatorMetricsCtx {
  metrics: DashboardMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const Ctx = createContext<OperatorMetricsCtx>({
  metrics: null,
  loading: true,
  error: null,
  refetch: () => {},
});

export function OperatorMetricsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'OPERATOR') return;
    let cancelled = false;
    setLoading(true);
    fetchMetrics()
      .then((data) => {
        if (!cancelled) {
          setMetrics(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  useEffect(() => {
    if (!user || user.role !== 'OPERATOR') return;
    const interval = setInterval(() => setTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  const refetch = () => setTick((t) => t + 1);

  return <Ctx.Provider value={{ metrics, loading, error, refetch }}>{children}</Ctx.Provider>;
}

export function useOperatorMetrics() {
  return useContext(Ctx);
}
