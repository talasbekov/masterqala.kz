'use client';
import {useLocale,WrenchIcon,UserIcon,ListIcon} from '@masterqala/ui';
import {useCommercialMode} from '@/lib/commercial-mode';
import { useEffect, useState } from 'react';
import { NavLink } from './NavLink';
import {MasterAvailabilityControl} from './MasterAvailabilityControl';
import {masterSurfaceText} from '../lib/masterSurfaceCopy';
import { fetchMyDisputes } from '@/lib/disputes';

export function Sidebar() {
  const{t,language}=useLocale();
  const {leadCreditsEnabled,payoutsEnabled}=useCommercialMode();
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => {
    fetchMyDisputes()
      .then((disputes) => setOpenDisputes(disputes.filter((d) => d.status === 'OPEN').length))
      .catch(() => setOpenDisputes(0));
  }, []);

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 md:flex">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon={<WrenchIcon className="h-5 w-5"/>}>
        {t('workHub')}
      </NavLink>
      <NavLink href="/become-master" icon={<UserIcon className="h-5 w-5"/>}>
        {t('application')}
      </NavLink>
      {leadCreditsEnabled&&<NavLink href="/lead-credits" icon="🎫">
        Lead-кредиты
      </NavLink>}
      {payoutsEnabled&&<NavLink href="/wallet" icon="💳">
        Кошелёк
      </NavLink>}
      <NavLink href="/disputes" icon={<ListIcon className="h-5 w-5"/>} badge={openDisputes}>
        {t('disputes')}
      </NavLink>
      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <MasterAvailabilityControl compact/>
        <a
          href="https://client.masterqala.kz"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↗</span>
          {masterSurfaceText(language,'clientAccount')}
        </a>
      </div>
    </aside>
  );
}
