import { cookies } from 'next/headers';
import type { Locale } from '@masterqala/ui';
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterQala — панель оператора',
  description: 'Заявки, пользователи, мастера, споры и журнал действий оператора MasterQala',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const value=(await cookies()).get('mq_locale')?.value;
  const language:Locale=value==='kk'||value==='en'?value:'ru';
  return (
    <html lang={language}>
      <body>
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
