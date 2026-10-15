'use client';
import type {ReactNode} from 'react';
import {useLocale} from './Locale';
import type {OwnedOrderLinkProps} from './OwnedOrdersView';
export function ServiceAvailabilityView({kind,authenticated,renderLink}: {kind: 'support' | 'notifications'; authenticated: boolean; renderLink: (props: OwnedOrderLinkProps) => ReactNode}) {
  const {t} = useLocale();
  const support = kind === 'support';
  const primary = 'inline-flex min-h-[56px] w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-center text-base font-semibold leading-[1.4] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-[52px]';
  const secondary = 'inline-flex min-h-[56px] w-full items-center justify-center rounded-md bg-fill-soft px-4 py-3 text-center text-base font-semibold leading-[1.4] text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-[52px]';
  return <section className="mx-auto flex w-full max-w-[560px] min-w-0 flex-col gap-6 px-6 py-6" aria-labelledby="service-page-heading">
    {renderLink({href:'/',children:t('back'),ariaLabel:t('homeDestination'),className:'inline-flex min-h-11 w-fit items-center rounded-md px-2 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary'})}
    <h1 id="service-page-heading" className={support ? 'break-words text-2xl font-semibold leading-[1.4] text-primary' : 'break-words text-[28px] font-medium leading-[34px] text-primary'}>{t(support ? 'serviceHelp' : 'serviceNotifications')}</h1>
    {support ? <>
      <p className="text-sm leading-[21px] text-ink-soft">{t('serviceHelpChoose')}</p>
      <p className="rounded-2xl bg-fill-soft p-4 text-sm leading-[21px] text-ink-soft" data-service-unavailable>{t('serviceHelpUnavailable')}</p>
      <div className="flex min-w-0 flex-col gap-4">
        {renderLink({href:'/orders',children:t('serviceOrderQuestion'),className:primary})}
        {renderLink({href:authenticated ? '/profile' : '/login',children:t(authenticated ? 'serviceAccount' : 'serviceSignIn'),className:secondary})}
      </div>
    </> : <>
      <div className="flex min-w-0 flex-col gap-3" data-service-unavailable><h2 className="break-words text-xl font-semibold leading-[1.4] text-primary">{t('serviceFeedUnavailable')}</h2><p className="text-sm leading-[21px] text-ink-soft">{t('serviceFeedNote')}</p></div>
      <div className="rounded-2xl bg-fill-soft p-4"><h2 className="text-sm font-semibold leading-[1.3] text-primary">{t('serviceOrderStatuses')}</h2><p className="mt-3 text-sm leading-[21px] text-ink-soft">{t('serviceOrderStatusesNote')}</p></div>
      <div className="flex min-w-0 flex-col gap-4">{renderLink({href:'/orders',children:t('orders'),className:primary})}{renderLink({href:'/support',children:t('serviceHelp'),className:secondary})}</div>
    </>}
  </section>;
}
