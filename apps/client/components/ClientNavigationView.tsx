import type { ComponentProps, ReactNode } from 'react';
type LinkProps = ComponentProps<'a'> & { href: string };
type NavigationLabels = { order: string; orders: string; profile: string; home: string; notifications: string; navigation: string };

export function ClientNavigationView({ pathname, labels, languageControl, showMobileNavigation = true, renderLink = props => <a {...props} /> }: {
  pathname: string; labels: NavigationLabels; languageControl: ReactNode; showMobileNavigation?: boolean; renderLink?: (props: LinkProps) => ReactNode;
}) {
  const orderActive = pathname === '/orders' || /^\/(order|planned)\//.test(pathname);
  const profileActive = ['/profile', '/addresses', '/payments', '/support'].some(path => pathname === path || pathname.startsWith(path + '/'));
  const link = (href: string, text: string, active: boolean) => renderLink({ href, children: text, 'aria-current': active ? 'page' : undefined });
  return <>
    <header className="mq-client-header">
      {renderLink({ href: '/', children: 'MasterQala', className: 'mq-client-brand' })}
      <nav aria-label={labels.navigation} className="mq-client-desktop-nav">
        {link('/order/new', labels.order, pathname === '/order/new')}
        {link('/orders', labels.orders, orderActive && pathname !== '/order/new' && pathname !== '/planned/new')}
        {link('/profile', labels.profile, profileActive)}
      </nav>
      {languageControl}
    </header>
    {/* Width-free functional fallback until original Figma mobile icons are retrievable. */}
    {showMobileNavigation && <nav aria-label={labels.navigation} className="mq-client-mobile-nav">
      {link('/', labels.home, pathname === '/')}
      {link('/orders', labels.orders, orderActive)}
      {link('/notifications', labels.notifications, pathname === '/notifications')}
      {link('/profile', labels.profile, profileActive)}
    </nav>}
  </>;
}
