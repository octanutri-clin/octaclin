'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Image, ListChecks, MessageSquareText, Ruler, SlidersHorizontal, ToggleLeft, Upload } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { PerguntaEditor, TipoPergunta } from './tipos';

const icones: Record<TipoPergunta, ComponentType<{ className?: string }>> = {
  likert: ListChecks,
  multipla_escolha: Image,
  linear: SlidersHorizontal,
  metrica: Ruler,
  upload_midia: Upload,
  texto_longo: MessageSquareText,
  sim_nao: ToggleLeft
};

interface Props {
  pergunta: PerguntaEditor;
  selecionada: boolean;
  categoriaNome: string;
  categoriaCor: string;
  aoSelecionar: (id: string) => void;
}

export function PerguntaOrdenavel({ pergunta, selecionada, categoriaNome, categoriaCor, aoSelecionar }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pergunta.id });
  const Icone = icones[pergunta.tipo];
  const secao = typeof pergunta.configuracao?.secao === 'string' ? pergunta.configuracao.secao : 'Sem secao';
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid min-h-20 grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-linha bg-white px-3 py-2',
        selecionada && 'bg-primaria-suave',
        isDragging && 'relative z-10 shadow-lg'
      )}
    >
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
        aria-label="Reordenar pergunta"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button className="min-w-0 text-left" onClick={() => aoSelecionar(pergunta.id)}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${categoriaCor}22`, color: categoriaCor }}>
            <Icone className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-semibold text-tinta">{pergunta.enunciado}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <span>{secao}</span>
          <span>{categoriaNome}</span>
          <span>Peso {pergunta.peso}</span>
          <span>{pergunta.obrigatoria ? 'Obrigatória' : 'Opcional'}</span>
        </div>
      </button>
      <span className="rounded-md border border-linha bg-fundo px-2 py-1 text-xs text-texto-suave">
        {String(pergunta.ordem).padStart(2, '0')}
      </span>
    </li>
  );
}
