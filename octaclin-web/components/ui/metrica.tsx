import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TipoDeltaMetrica = 'positivo' | 'negativo' | 'neutro';

const corPorTipoDelta: Record<TipoDeltaMetrica, string> = {
  positivo: 'text-sucesso-forte',
  negativo: 'text-perigo',
  neutro: 'text-texto-suave'
};

interface MetricaProps {
  rotulo: string;
  valor: ReactNode;
  delta?: { valor: string; tipo: TipoDeltaMetrica };
  icone?: ReactNode;
  className?: string;
}

export function Metrica({ rotulo, valor, delta, icone, className }: MetricaProps) {
  return (
    <div className={cn('rounded-lg bg-white p-cartao shadow-cartao', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-texto-suave">{rotulo}</p>
        {icone ? <span className="text-texto-suave">{icone}</span> : null}
      </div>
      <p className="numeros-tabulares mt-2 text-2xl font-semibold text-tinta">{valor}</p>
      {delta ? <p className={cn('mt-1 text-xs font-medium', corPorTipoDelta[delta.tipo])}>{delta.valor}</p> : null}
    </div>
  );
}
