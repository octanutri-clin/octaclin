import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';

interface AuthShellProps {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  rodape?: ReactNode;
}

export function AuthShell({ titulo, subtitulo, children, rodape }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center bg-fundo px-5 py-8 text-tinta sm:px-8">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primaria text-white">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <p className="mt-5 text-sm font-semibold text-primaria-forte">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">{titulo}</h1>
          {subtitulo ? <p className="mt-2 text-sm text-texto-suave">{subtitulo}</p> : null}
        </header>

        <Cartao className="shadow-sm">
          <CartaoConteudo className="p-6">{children}</CartaoConteudo>
        </Cartao>

        {rodape}
      </div>
    </main>
  );
}
