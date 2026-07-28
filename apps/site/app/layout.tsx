import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MasterQala',
  description: 'Мастер на дом — быстро и по понятной цене',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
