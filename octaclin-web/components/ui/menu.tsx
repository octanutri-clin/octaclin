'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MenuProps {
  gatilho: React.ReactElement;
  children: React.ReactNode;
  className?: string;
  alinhamento?: 'inicio' | 'fim';
}

export function Menu({ gatilho, children, className, alinhamento = 'fim' }: MenuProps) {
  const [aberto, setAberto] = React.useState(false);
  const raizRef = React.useRef<HTMLDivElement>(null);
  const idBotao = React.useId();

  React.useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false);
    }

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raizRef} className="relative inline-block">
      {React.cloneElement(gatilho, {
        id: idBotao,
        'aria-haspopup': 'menu',
        'aria-expanded': aberto,
        onClick: (evento: React.MouseEvent) => {
          gatilho.props.onClick?.(evento);
          setAberto((atual) => !atual);
        }
      })}
      {aberto ? (
        <div
          role="menu"
          aria-labelledby={idBotao}
          onClick={() => setAberto(false)}
          className={cn(
            'absolute z-40 mt-2 min-w-48 rounded-lg border border-linha bg-white p-1 shadow-lg',
            alinhamento === 'fim' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ItemMenu({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-tinta transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
        className
      )}
      {...props}
    />
  );
}
