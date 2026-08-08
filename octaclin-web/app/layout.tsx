import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { PwaRuntime } from '@/components/pwa/pwa-runtime';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap'
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'OctaClin',
  description: 'Cuidado clinico, agenda e acompanhamento em um unico lugar.',
  applicationName: 'OctaClin',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'OctaClin' },
  icons: { apple: '/icons/octaclin-192.png' }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body><PwaRuntime>{children}</PwaRuntime></body>
    </html>
  );
}
