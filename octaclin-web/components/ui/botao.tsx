import * as React from 'react';
import { cn } from '@/lib/utils';

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';

const estilos: Record<VarianteBotao, string> = {
  primario: 'bg-primaria text-white hover:bg-primaria-forte',
  secundario: 'border border-linha bg-white text-tinta hover:bg-superficie-hover',
  fantasma: 'text-tinta hover:bg-superficie-hover',
  perigo: 'bg-perigo text-white hover:bg-perigo-forte'
};

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variante = 'secundario', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
        estilos[variante],
        className
      )}
      {...props}
    />
  )
);

Botao.displayName = 'Botao';
