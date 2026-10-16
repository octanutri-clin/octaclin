'use client';

import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface RefeicaoOrdenavelProps {
  id: string;
  nome: string;
  posicao: number;
  acoes: ReactNode;
  children: ReactNode;
  aberto: boolean;
  aoAlternar: () => void;
  subtotalVisual: string;
  subtotalAcessivel: string;
  arrasteDesabilitado?: boolean;
}

export function RefeicaoOrdenavel({ id, nome, posicao, acoes, children, aberto, aoAlternar, subtotalVisual, subtotalAcessivel, arrasteDesabilitado = false }: RefeicaoOrdenavelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: arrasteDesabilitado });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined
  };
  const nomeAcessivel = nome.trim() || `sem nome, posição ${posicao + 1}`;
  const idConteudo = `${id}-conteudo`;

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`Refeição: ${nomeAcessivel}`}
      className={`grid gap-4 rounded-md border border-linha bg-white p-4 ${isDragging ? 'relative opacity-80 shadow-lg' : ''}`}
      data-testid="refeicao-editor"
      data-refeicao-id={id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className="text-sm font-semibold text-tinta">Refeição {posicao + 1}{nome.trim() ? ` — ${nome.trim()}` : ''}</h4>
          <p className="min-w-0 text-xs tabular-nums text-texto-suave" aria-label={subtotalAcessivel}>
            {subtotalVisual}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={idConteudo}
            aria-label={`${aberto ? 'Recolher' : 'Expandir'} refeição ${nomeAcessivel}`}
            onClick={aoAlternar}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium text-primaria hover:bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            {aberto ? 'Recolher' : 'Expandir'}
          </button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastar refeição ${nomeAcessivel}`}
            disabled={arrasteDesabilitado}
            title="Arraste para reordenar; use as setas do teclado para mover"
            className="inline-flex min-h-11 min-w-11 touch-none items-center justify-center rounded-md text-texto-suave hover:bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
          {acoes}
        </div>
      </div>
      <div id={idConteudo} hidden={!aberto} data-refeicao-conteudo="true">
        {children}
      </div>
    </section>
  );
}
