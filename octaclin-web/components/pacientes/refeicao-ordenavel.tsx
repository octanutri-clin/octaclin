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
}

export function RefeicaoOrdenavel({ id, nome, posicao, acoes, children }: RefeicaoOrdenavelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined
  };
  const nomeAcessivel = nome.trim() || `sem nome, posição ${posicao + 1}`;

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`Refeição: ${nomeAcessivel}`}
      className={`grid gap-4 rounded-md border border-linha bg-white p-4 ${isDragging ? 'relative opacity-80 shadow-lg' : ''}`}
      data-testid="refeicao-editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-tinta">Refeição {posicao + 1}</h4>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Arrastar refeição ${nomeAcessivel}`}
            title="Arraste para reordenar; use as setas do teclado para mover"
            className="inline-flex min-h-11 min-w-11 touch-none items-center justify-center rounded-md text-texto-suave hover:bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
          {acoes}
        </div>
      </div>
      {children}
    </section>
  );
}
