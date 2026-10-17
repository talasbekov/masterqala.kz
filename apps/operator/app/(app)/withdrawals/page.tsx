'use client';
import Link from 'next/link';
import {Button,useLocale} from '@masterqala/ui';
import {operatorFinanceCopy} from '../../../lib/operator-finance-copy';

export default function WithdrawalsPage(){
 const {language}=useLocale(),t=operatorFinanceCopy[language];
 return <section data-finance-held className="operator-finance-content">
  <p className="operator-finance-status">{t.status}</p><h1>{t.title}</h1><p className="operator-finance-intro">{t.intro}</p>
  <div className="operator-finance-columns"><div className="operator-finance-primary">
   <article className="operator-information-card"><h2>{t.role}</h2><p>{t.roleNote}</p></article>
   <nav className="operator-finance-actions" aria-label={t.access}><Link href="/orders">{t.orders}</Link><Link href="/journal">{t.journal}</Link><Button disabled>{t.confirm}</Button></nav>
  </div><aside className="operator-finance-context">
   <article className="operator-information-card"><h2>{t.queue}</h2><p>{t.queueNote}</p></article>
   <article className="operator-information-card"><h2>{t.access}</h2><p>{t.accessNote}</p></article>
  </aside></div>
 </section>;
}
