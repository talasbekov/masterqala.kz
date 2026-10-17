'use client';
import {useEffect,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {operatorText} from '../lib/operator-copy';
export function AuthGuard({children}:{children:ReactNode}) {
  const {ready,user,logout}=useAuth(),router=useRouter(),{language}=useLocale();
  useEffect(()=>{if(ready&&!user)router.replace('/login');},[ready,user,router]);
  if(!ready||!user)return <p role="status" className="p-6 text-ink-soft">{operatorText(language,'loading')}</p>;
  if(user.role!=='OPERATOR')return <section className="flex flex-col items-start gap-3 p-8"><h1 className="text-xl font-semibold text-danger">{operatorText(language,'denied')}</h1><p>{operatorText(language,'roleRequired')}</p><button type="button" onClick={logout} className="min-h-[52px] rounded-md bg-primary px-4 py-3 font-semibold text-white">{operatorText(language,'otherAccount')}</button></section>;
  return <>{children}</>;
}
