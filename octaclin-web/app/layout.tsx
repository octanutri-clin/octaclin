import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import './globals.css';
import { PwaRuntime } from '@/components/pwa/pwa-runtime';

const plexSans = localFont({
  src: [
    { path: './fonts/IBMPlexSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexSans-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/IBMPlexSans-Bold.woff2', weight: '700', style: 'normal' }
  ],
  variable: '--font-plex-sans',
  display: 'swap'
});

const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexMono-SemiBold.woff2', weight: '600', style: 'normal' }
  ],
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

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // CSP com nonce depende de renderizacao por requisicao para que o Next aplique
  // o mesmo nonce aos scripts e estilos internos antes de enviar o HTML.
  await headers();
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body><PwaRuntime>{children}</PwaRuntime></body>
    </html>
  );
}
