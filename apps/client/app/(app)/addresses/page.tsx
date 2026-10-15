'use client';
import {useRouter} from 'next/navigation';
import {useTranslation} from 'react-i18next';
import {AccountAddressBook} from '@masterqala/ui';
import {api} from '../../../lib/api';
import {useAuth} from '../../../lib/auth';
export default function AddressesPage(){const {user}=useAuth();const {t}=useTranslation();const router=useRouter();return <AccountAddressBook ownerId={user?.id??null} api={api} t={key=>t(key)} onBack={()=>router.push('/profile')}/>;}
