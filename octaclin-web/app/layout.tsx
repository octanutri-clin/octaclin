import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'OctaClin - Console Operacional',
  description: 'Console operacional para jornadas clinicas, automacoes, mobile, gamificacao e acompanhamento do OctaClin.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
