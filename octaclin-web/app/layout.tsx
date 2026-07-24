import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap'
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'OctaClin - Console Operacional',
  description: 'Console operacional para jornadas clinicas, automacoes, mobile, gamificacao e acompanhamento do OctaClin.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} ${notoSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
