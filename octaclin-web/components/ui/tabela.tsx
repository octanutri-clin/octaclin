import * as React from 'react';
import { cn } from '@/lib/utils';

export const Tabela = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-x-auto rounded-lg border border-linha bg-white', className)} {...props} />
  )
);
Tabela.displayName = 'Tabela';

interface TabelaConteudoProps extends React.HTMLAttributes<HTMLDivElement> {
  larguraMinima?: string;
}

export function TabelaConteudo({ className, larguraMinima = '840px', style, ...props }: TabelaConteudoProps) {
  return <div className={cn('min-w-0', className)} style={{ minWidth: larguraMinima, ...style }} {...props} />;
}

export const TabelaCabecalho = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid gap-3 border-b border-linha px-4 py-3 text-xs font-semibold uppercase text-texto-suave',
        className
      )}
      {...props}
    />
  )
);
TabelaCabecalho.displayName = 'TabelaCabecalho';

export const TabelaLinhas = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('divide-y divide-linha', className)} {...props} />
);
TabelaLinhas.displayName = 'TabelaLinhas';

export const TabelaLinha = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('grid gap-3 px-4 py-3 text-sm', className)} {...props} />
);
TabelaLinha.displayName = 'TabelaLinha';

interface TabelaVaziaProps {
  mensagem: string;
  className?: string;
}

export function TabelaVazia({ mensagem, className }: TabelaVaziaProps) {
  return <div className={cn('px-4 py-8 text-sm text-texto-suave', className)}>{mensagem}</div>;
}
