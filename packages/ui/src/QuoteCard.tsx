import {useLocale} from './Locale';
export interface DirectOrder {
  id:string;status:string;lifecycleVersion:number;commercialMode?:string;description:string;address:string;
  workPrice:number|null;materialsPrice:number;calloutPrice:number;quoteTotal:number|null;quoteVersion:number;consentedVersion:number|null;
  workComment:string|null;departedAt:string|null;cancellationAmount:number|null;updatedAt:string;
  master?:{name:string|null;phone:string;rating?:number|null;reviewCount?:number}|null;
  client?:{name:string|null;phone:string}|null;category?:{name:string}|null;review?:{rating:number;comment:string|null}|null;
}
export function QuoteCard({order}:{order:Pick<DirectOrder,'id'|'workPrice'|'materialsPrice'|'calloutPrice'|'quoteTotal'|'workComment'>}) {
  const{t,formatMoney}=useLocale();
  return <section className="flex flex-col gap-3 rounded-lg bg-fill-soft p-4 md:bg-surface md:p-6">
    {order.workComment&&<h2 className="break-words text-xl font-semibold text-primary">{order.workComment}</h2>}
    <p className="text-xs text-ink-soft">{t('orderNumber',{id:order.id.slice(0,8)})}</p>
    {(['work','materials','callout'] as const).map((key,index)=><div key={key} className="flex items-center justify-between gap-3 text-sm"><span className="text-ink-soft">{t(key)}</span><span className="shrink-0 font-semibold text-primary">{formatMoney([order.workPrice??0,order.materialsPrice,order.calloutPrice][index])}</span></div>)}
    <div className="flex justify-between gap-3 border-t border-border pt-3 font-semibold text-primary"><span>{t('total')}</span><span className="text-xl">{formatMoney(order.quoteTotal??0)}</span></div>
  </section>;
}
