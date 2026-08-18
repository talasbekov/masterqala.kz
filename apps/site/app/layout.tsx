import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getSiteUrl, OG_IMAGE } from '@/lib/env';
import './globals.css';

const TITLE = 'MasterQala — мастер на дом в Астане';
const DESCRIPTION =
  'Сантехник, электрик, мастер по ремонту техники и мелкому ремонту на дом в Астане. Стоимость выезда видна заранее, работу вы оплачиваете мастеру напрямую.';

export const metadata: Metadata = {
  // metadataBase нужен, чтобы относительные ссылки в openGraph/canonical
  // разворачивались в абсолютные — иначе Next отдаёт их как есть и соцсети их
  // не резолвят.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: TITLE,
    template: '%s — MasterQala',
  },
  description: DESCRIPTION,
  applicationName: 'MasterQala',
  keywords: ['мастер на дом', 'сантехник Астана', 'электрик Астана', 'ремонт бытовой техники', 'MasterQala'],
  authors: [{ name: 'MasterQala' }],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'MasterQala',
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col">
        {/* Стиль .skip-link живёт в base.css: ссылка видна только при фокусе. */}
        <a href="#main" className="skip-link">
          К основному содержимому
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
