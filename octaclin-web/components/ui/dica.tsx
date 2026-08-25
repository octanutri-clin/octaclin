'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type PropsElementoInteragivel = React.HTMLAttributes<HTMLElement>;

interface DicaProps {
  texto: string;
  children: React.ReactElement<PropsElementoInteragivel>;
  className?: string;
}

export function Dica({ texto, children, className }: DicaProps) {
  const [visivel, setVisivel] = React.useState(false);
  const id = React.useId();

  return (
    <span className="relative inline-flex">
      {React.cloneElement(children, {
        'aria-describedby': visivel ? id : undefined,
        onMouseEnter: (evento: React.MouseEvent<HTMLElement>) => {
          children.props.onMouseEnter?.(evento);
          setVisivel(true);
        },
        onMouseLeave: (evento: React.MouseEvent<HTMLElement>) => {
          children.props.onMouseLeave?.(evento);
          setVisivel(false);
        },
        onFocus: (evento: React.FocusEvent<HTMLElement>) => {
          children.props.onFocus?.(evento);
          setVisivel(true);
        },
        onBlur: (evento: React.FocusEvent<HTMLElement>) => {
          children.props.onBlur?.(evento);
          setVisivel(false);
        },
        onKeyDown: (evento: React.KeyboardEvent<HTMLElement>) => {
          children.props.onKeyDown?.(evento);
          if (evento.key === 'Escape') setVisivel(false);
        }
      })}
      {visivel ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutro-900 px-2 py-1 text-xs text-white shadow-lg',
            className
          )}
        >
          {texto}
        </span>
      ) : null}
    </span>
  );
}
