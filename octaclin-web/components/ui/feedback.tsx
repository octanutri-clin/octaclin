import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertaOperacionalProps {
  mensagem: string;
  className?: string;
}

export function AlertaOperacional({ mensagem, className }: AlertaOperacionalProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo',
        className
      )}
    >
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{mensagem}</span>
    </div>
  );
}

interface BarraCarregamentoProps {
  visivel: boolean;
  rotulo?: string;
}

export function BarraCarregamento({ visivel, rotulo = 'Atualizando dados' }: BarraCarregamentoProps) {
  if (!visivel) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-linha bg-white px-4 py-3 text-sm text-[#596273]">
      <Loader2 size={16} className="animate-spin text-primaria" />
      <span>{rotulo}</span>
    </div>
  );
}

interface EstadoVazioProps {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}

export function EstadoVazio({ titulo, descricao, acao, className }: EstadoVazioProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}>
      <Inbox size={24} className="text-[#8a94a3]" />
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {descricao ? <p className="max-w-sm text-sm text-[#596273]">{descricao}</p> : null}
      {acao ? <div className="pt-1">{acao}</div> : null}
    </div>
  );
}
