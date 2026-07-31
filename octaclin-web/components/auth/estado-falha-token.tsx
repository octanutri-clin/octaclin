import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstadoFalhaToken as TipoFalhaToken } from '@/lib/classificar-falha-token';

interface ConteudoFalhaToken {
  titulo: string;
  mensagem: string;
  detalhe: string;
}

interface AcaoFalhaToken {
  label: string;
  href: string;
}

interface EstadoFalhaTokenProps {
  tipo: TipoFalhaToken;
  conteudo: Record<TipoFalhaToken, ConteudoFalhaToken>;
  erro?: string | null;
  acoes: AcaoFalhaToken[];
}

export function EstadoFalhaToken({ tipo, conteudo, erro, acoes }: EstadoFalhaTokenProps) {
  const item = conteudo[tipo];

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-md border border-perigo-borda bg-perigo-suave px-3 py-3 text-sm text-perigo-forte">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-perigo" aria-hidden="true" />
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-perigo-forte">{item.titulo}</h2>
          <p>{item.mensagem}</p>
          <p className="text-xs text-perigo-forte">{erro || item.detalhe}</p>
        </div>
      </div>

      <div className={cn('grid gap-2', acoes.length > 1 ? 'sm:grid-cols-2' : undefined)}>
        {acoes.map((acao, indice) => (
          <Link
            key={acao.href}
            href={acao.href as Route}
            className={
              indice === 0
                ? 'inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte'
                : 'inline-flex h-9 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie'
            }
          >
            {acao.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
