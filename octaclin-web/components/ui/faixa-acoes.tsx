import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FaixaAcoesProps extends HTMLAttributes<HTMLDivElement> {
  rotulo: string;
  envolverEmTelasMaiores?: boolean;
}

export function FaixaAcoes({
  rotulo,
  envolverEmTelasMaiores = true,
  className,
  children,
  ...props
}: FaixaAcoesProps) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn(
        'flex min-h-11 max-w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]',
        '[&>*]:shrink-0',
        envolverEmTelasMaiores && 'sm:flex-wrap sm:overflow-visible sm:pb-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
