import {cookies} from 'next/headers';import type {Metadata} from 'next';import type {Locale} from '@masterqala/ui';
import {SiteShell} from '../components/SiteShell';import {getAppUrl,getContactEmail,getContactPhone} from '../lib/env';import './globals.css';
export const metadata:Metadata={title:'MasterQala',description:'MasterQala'};
export default async function RootLayout({children}:{children:React.ReactNode}) {
 const value=(await cookies()).get('mq_locale')?.value,language:Locale=value==='kk'||value==='en'?value:'ru';
 return <html lang={language}><body className="flex min-h-screen flex-col"><SiteShell initialLanguage={language} appUrl={getAppUrl()} phone={getContactPhone()} email={getContactEmail()}>{children}</SiteShell></body></html>;
}
