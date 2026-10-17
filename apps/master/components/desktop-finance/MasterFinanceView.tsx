'use client';
import Link from 'next/link';
import { Button, useLocale } from '@masterqala/ui';
import { masterDesignCopy } from '../../lib/masterDesignCopy';
/** No financial API integration until the payment model is approved. */
export function MasterFinanceView({ kind }: { kind: 'wallet' | 'credits' }) {
 const {language}=useLocale(),c=masterDesignCopy(language),wallet=kind==='wallet';
 return <div className="mq-master-dashboard mq-master-finance mq-master-current-page" data-master-finance={kind}>
  <p className="mq-master-current-page__status">{wallet?c.pilot:c.creditPilot}</p>
  <h1>{wallet?c.wallet:c.credits}</h1><p className="mq-master-current-page__intro">{wallet?c.walletIntro:c.creditIntro}</p>
  <div className="mq-master-current-grid"><div className="mq-master-current-stack">
   <section className="mq-master-card"><h2>{wallet?c.walletTitle:c.creditTitle}</h2><p id="finance-unavailable-note">{wallet?c.walletBody:c.creditBody}</p></section>
   <nav className="mq-master-current-actions" aria-label={c.workspace}><Link className="mq-master-finance__action" href={wallet?'/history':'/?tab=planned'}>{wallet?c.orders:c.planned}</Link><Link className="mq-master-finance__action" href={wallet?'/lead-credits':'/wallet'}>{wallet?c.credits:c.wallet}</Link><Button disabled aria-describedby="finance-unavailable-note">{wallet?c.payout:c.purchase}</Button></nav>
  </div><aside className="mq-master-current-stack"><section className="mq-master-card"><h2>{wallet?c.walletAside:c.creditAside}</h2><p>{wallet?c.walletAsideBody:c.creditAsideBody}</p></section><section className="mq-master-card"><h2>{wallet?c.next:c.current}</h2><p>{wallet?c.nextBody:c.currentBody}</p></section></aside></div>
 </div>;
}
export function MasterFinanceLinks(){const {language}=useLocale(),c=masterDesignCopy(language);return <nav className="mq-master-card mq-master-finance__profile" aria-label={c.wallet}><h2>{c.wallet}</h2><Link href="/wallet">{c.wallet}</Link><Link href="/lead-credits">{c.credits}</Link></nav>;}