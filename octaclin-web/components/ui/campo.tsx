import * as React from 'react';
import { cn } from '@/lib/utils';

export function Rotulo({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-semibold uppercase text-texto-suave', className)} {...props} />;
}

const focoVisivel =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria';

export const Campo = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-md border border-linha bg-white px-3 text-sm text-tinta shadow-none',
        focoVisivel,
        className
      )}
      {...props}
    />
  )
);

Campo.displayName = 'Campo';

export const AreaTexto = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full resize-none rounded-md border border-linha bg-white px-3 py-2 text-sm text-tinta shadow-none',
        focoVisivel,
        className
      )}
      {...props}
    />
  )
);

AreaTexto.displayName = 'AreaTexto';

export const Selecao = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('min-h-11 w-full rounded-md border border-linha bg-white px-3 text-sm text-tinta', focoVisivel, className)}
      {...props}
    />
  )
);

Selecao.displayName = 'Selecao';
