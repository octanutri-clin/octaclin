import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Loader2, ShieldAlert } from 'lucide-react';
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
        'flex items-start gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo',
        className
      )}
    >
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{mensagem}</span>
    </div>
  );
}

export function AlertaSucesso({ mensagem, className }: AlertaOperacionalProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte',
        className
      )}
    >
      <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
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
    <div role="status" aria-live="polite" aria-busy="true" className="flex items-center gap-2 rounded-lg border border-linha bg-white px-4 py-3 text-sm text-texto-suave">
      <Loader2 aria-hidden="true" size={16} className="animate-spin text-primaria" />
      <span>{rotulo}</span>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-linha/70', className)} />;
}

export function EsqueletoPagina({ rotulo = 'Carregando conteudo' }: { rotulo?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={rotulo} className="grid gap-4">
      <span className="sr-only">{rotulo}</span>
      <div className="flex items-center justify-between gap-4">
        <div className="grid w-full max-w-md gap-2">
          <Esqueleto className="h-5 w-40" />
          <Esqueleto className="h-4 w-full" />
        </div>
        <Esqueleto className="h-11 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, indice) => <Esqueleto key={indice} className="h-28 w-full" />)}
      </div>
      <Esqueleto className="h-48 w-full" />
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
      <Inbox size={24} className="text-texto-sutil" />
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {descricao ? <p className="max-w-sm text-sm text-texto-suave">{descricao}</p> : null}
      {acao ? <div className="pt-1">{acao}</div> : null}
    </div>
  );
}

export function EstadoPermissaoNegada({ className }: Pick<EstadoVazioProps, 'className'>) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)} role="status">
      <ShieldAlert size={24} className="text-alerta" aria-hidden="true" />
      <p className="text-sm font-medium text-tinta">Acesso nao autorizado</p>
      <p className="max-w-sm text-sm text-texto-suave">Seu perfil nao possui permissao para visualizar este conteudo.</p>
    </div>
  );
}
