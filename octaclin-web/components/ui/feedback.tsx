import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Info, Loader2, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type VarianteAviso = 'info' | 'sucesso' | 'alerta' | 'erro';

const iconePorVarianteAviso: Record<VarianteAviso, typeof Info> = {
  info: Info,
  sucesso: CheckCircle2,
  alerta: AlertTriangle,
  erro: AlertTriangle
};

const estiloPorVarianteAviso: Record<VarianteAviso, string> = {
  info: 'border-linha bg-white text-tinta',
  sucesso: 'border-sucesso-borda bg-sucesso-suave text-sucesso-forte',
  alerta: 'border-alerta-borda bg-alerta-suave text-alerta-forte',
  erro: 'border-perigo-borda bg-perigo-suave text-perigo'
};

interface AvisoProps {
  variante?: VarianteAviso;
  mensagem: string;
  aoFechar?: () => void;
  className?: string;
}

export function Aviso({ variante = 'info', mensagem, aoFechar, className }: AvisoProps) {
  const Icone = iconePorVarianteAviso[variante];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
        estiloPorVarianteAviso[variante],
        className
      )}
    >
      <Icone size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{mensagem}</span>
      {aoFechar ? (
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar aviso"
          className="pointer-events-auto shrink-0 rounded text-current/70 hover:text-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function AvisoRegiao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end',
        className
      )}
    >
      {children}
    </div>
  );
}

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

export function EsqueletoPagina({ rotulo = 'Carregando conteúdo' }: { rotulo?: string }) {
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
      <p className="text-sm font-medium text-tinta">Acesso não autorizado</p>
      <p className="max-w-sm text-sm text-texto-suave">Seu perfil não possui permissão para visualizar este conteúdo.</p>
    </div>
  );
}
