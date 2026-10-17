'use client';
import {useRouter} from 'next/navigation';
import {useTranslation} from 'react-i18next';
import {AccountAddressBook,useLocale} from '@masterqala/ui';
import {api} from '../../lib/api';
import {useAuth} from '../../lib/auth';
import {desktopAddressDraftStore} from './address-draft';
import {accountCopy} from './copy';
import './desktop-account.css';
export function DesktopAddresses(){
 const {user}=useAuth(),{t}=useTranslation(),{language}=useLocale(),router=useRouter(),copy=accountCopy[language];
 return <div className="desktop-account desktop-account-addresses"><AccountAddressBook ownerId={user?.id??null} api={api} draftStore={desktopAddressDraftStore} t={key=>(copy as Record<string,string>)[key]??t(key)} onBack={()=>router.push('/profile')}/></div>;
}
