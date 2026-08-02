import * as React from 'react';
import { cn } from '@/lib/utils';

type VarianteEtiqueta = 'neutra' | 'primaria' | 'sucesso' | 'alerta' | 'perigo';

const estilos: Record<VarianteEtiqueta, string> = {
  neutra: 'border-linha bg-superficie text-texto-suave',
  primaria: 'border-primaria-suave bg-primaria-suave text-primaria-forte',
  sucesso: 'border-sucesso-borda bg-sucesso-suave text-sucesso-forte',
  alerta: 'border-alerta-borda bg-alerta-suave text-alerta-forte',
  perigo: 'border-perigo-borda bg-perigo-suave text-perigo'
};

export interface EtiquetaProps extends React.HTMLAttributes<HTMLSpanElement> {
  variante?: VarianteEtiqueta;
}

export function Etiqueta({ variante = 'neutra', className, ...props }: EtiquetaProps) {
  return <span className={cn('inline-flex min-h-6 items-center rounded-sm border px-2 text-xs font-semibold', estilos[variante], className)} {...props} />;
}

export interface StatusEtiquetaConfig {
  rotulo: string;
  variante?: VarianteEtiqueta;
}

interface EtiquetaStatusProps<T extends string> extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: T;
  mapa: Record<T, StatusEtiquetaConfig>;
}

export function EtiquetaStatus<T extends string>({ status, mapa, className, ...props }: EtiquetaStatusProps<T>) {
  const configuracao = mapa[status];
  return (
    <Etiqueta variante={configuracao.variante ?? 'neutra'} className={className} {...props}>
      {configuracao.rotulo}
    </Etiqueta>
  );
}
