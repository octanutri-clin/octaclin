import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CabecalhoSecaoProps {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}

export function CabecalhoSecao({ titulo, descricao, acoes, className }: CabecalhoSecaoProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-tinta">{titulo}</h2>
        {descricao ? <p className="mt-1 text-sm text-texto-suave">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
