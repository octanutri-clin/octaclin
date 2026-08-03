import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';
type TamanhoBotao = 'sm' | 'md' | 'lg';

const estilos: Record<VarianteBotao, string> = {
  primario: 'bg-primaria text-white hover:bg-primaria-forte',
  secundario: 'border border-linha bg-white text-tinta hover:bg-superficie-hover',
  fantasma: 'text-tinta hover:bg-superficie-hover',
  perigo: 'bg-perigo text-white hover:bg-perigo-forte'
};

const tamanhos: Record<TamanhoBotao, string> = {
  sm: 'min-h-9 px-2.5 text-xs',
  md: 'min-h-11 px-3 text-sm',
  lg: 'min-h-12 px-4 text-base'
};

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
}

interface ClassesBotaoOptions {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  className?: string;
}

export function classesBotao({ variante = 'secundario', tamanho = 'md', className }: ClassesBotaoOptions = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:translate-y-px',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
    estilos[variante],
    tamanhos[tamanho],
    className
  );
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variante = 'secundario', tamanho = 'md', carregando = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classesBotao({ variante, tamanho, className })}
      {...props}
    >
      {carregando ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
);

Botao.displayName = 'Botao';
