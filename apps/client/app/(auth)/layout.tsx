import {ClientShell} from '../../components/ClientShell';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mq-auth-shell"><ClientShell showMobileNavigation={false}><div className="mq-auth-main">{children}</div></ClientShell></div>;
}
