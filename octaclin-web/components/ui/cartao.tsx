import * as React from 'react';
import { cn } from '@/lib/utils';

export const Cartao = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // `min-w-0` porque o Cartao quase sempre e item de grid/flex, e um item de
    // grid herda `min-width: auto` - ou seja, recusa encolher abaixo da largura
    // intrinseca do conteudo. Medido a 320 CSS px em /pacientes: o pai tinha
    // 296px e o Cartao esticava para 581px, empurrando busca, filtros e o link
    // do paciente para fora da viewport (WCAG 1.4.10).
    <div ref={ref} className={cn('min-w-0 rounded-lg bg-white shadow-cartao', className)} {...props} />
  )
);
Cartao.displayName = 'Cartao';

export const CartaoCabecalho = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-3', className)}
      {...props}
    />
  )
);
CartaoCabecalho.displayName = 'CartaoCabecalho';

interface CartaoTituloProps extends React.HTMLAttributes<HTMLHeadingElement> {
  icone?: React.ReactNode;
}

export const CartaoTitulo = React.forwardRef<HTMLHeadingElement, CartaoTituloProps>(
  ({ className, icone, children, ...props }, ref) => (
    <h2 ref={ref} className={cn('flex items-center gap-2 text-md font-semibold text-tinta', className)} {...props}>
      {icone ? <span className="text-texto-suave">{icone}</span> : null}
      {children}
    </h2>
  )
);
CartaoTitulo.displayName = 'CartaoTitulo';

export function CartaoSubtitulo({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-texto-suave', className)} {...props} />;
}

export const CartaoConteudo = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4 sm:p-cartao', className)} {...props} />
);
CartaoConteudo.displayName = 'CartaoConteudo';
