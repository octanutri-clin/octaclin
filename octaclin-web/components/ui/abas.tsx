'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface Aba {
  id: string;
  rotulo: string;
}

interface AbasProps {
  identificador: string;
  abas: Aba[];
  ativaId: string;
  aoMudar: (id: string) => boolean | void;
  rotulo: string;
  className?: string;
}

export function Abas({ identificador, abas, ativaId, aoMudar, rotulo, className }: AbasProps) {
  const referencias = React.useRef(new Map<string, HTMLButtonElement>());

  function aoTeclar(evento: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const indice = abas.findIndex((aba) => aba.id === id);
    if (indice < 0) return;
    const destino = evento.key === 'Home'
      ? 0
      : evento.key === 'End'
        ? abas.length - 1
        : evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
          ? (indice + 1) % abas.length
          : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
            ? (indice - 1 + abas.length) % abas.length
            : -1;
    if (destino < 0) return;
    evento.preventDefault();
    const proxima = abas[destino];
    const aceita = aoMudar(proxima.id);
    if (aceita !== false) referencias.current.get(proxima.id)?.focus();
  }

  return (
    <nav
      role="tablist"
      aria-label={rotulo}
      aria-orientation="horizontal"
      className={cn(
        'flex max-w-full flex-nowrap gap-2 overflow-x-auto border-b border-linha pb-3 [scrollbar-width:thin]',
        'md:flex-wrap md:overflow-visible',
        className
      )}
    >
      {abas.map((aba) => {
        const ativa = ativaId === aba.id;
        return (
          <button
            key={aba.id}
            ref={(elemento) => {
              if (elemento) referencias.current.set(aba.id, elemento);
              else referencias.current.delete(aba.id);
            }}
            id={`${identificador}-${aba.id}-aba`}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={`${identificador}-${aba.id}-painel`}
            tabIndex={ativa ? 0 : -1}
            onClick={() => aoMudar(aba.id)}
            onKeyDown={(evento) => aoTeclar(evento, aba.id)}
            className={cn(
              'min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
              ativa ? 'bg-primaria text-white' : 'border border-linha bg-white text-texto-suave hover:bg-superficie-hover'
            )}
          >
            {aba.rotulo}
          </button>
        );
      })}
    </nav>
  );
}
