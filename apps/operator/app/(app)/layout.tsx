import {AuthGuard} from '../../components/AuthGuard';
import {OperatorMetricsProvider} from '../../lib/operatorMetrics';
import {OperatorShell} from '../../components/OperatorShell';
export default function AppLayout({children}:{children:React.ReactNode}) {
  return <AuthGuard><OperatorMetricsProvider><OperatorShell>{children}</OperatorShell></OperatorMetricsProvider></AuthGuard>;
}
