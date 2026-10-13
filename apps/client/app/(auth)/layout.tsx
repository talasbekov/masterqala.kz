export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mq-auth-shell"><main className="mq-auth-main">{children}</main></div>;
}
