import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import { AppHeader } from '@/components/AppHeader';
import './globals.css';

// Plus Jakarta Sans — Papaya's typeface — for both UI and large display headings
// (the display treatment is tight tracking in CSS). IBM Plex Mono for the ledger
// figures (amounts, thresholds, dates, version numbers) and the console aesthetic.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Papaya Keystone — Tenant Configuration',
  description: 'Admin-configurable multi-tenant claims processing — one engine, one schema, per-tenant policy.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AntdRegistry>
          <Providers>
            <AppHeader />
            <main className="app-main">{children}</main>
          </Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
