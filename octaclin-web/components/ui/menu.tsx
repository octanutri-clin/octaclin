'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MenuProps {
  gatilho: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  children: React.ReactNode;
  className?: string;
  alinhamento?: 'inicio' | 'fim';
}

export function Menu({ gatilho, children, className, alinhamento = 'fim' }: MenuProps) {
  const [aberto, setAberto] = React.useState(false);
  const raizRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const gatilhoRef = React.useRef<HTMLElement | null>(null);
  const idBotao = React.useId();

  const itensDoMenu = React.useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
      .filter((item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true'),
    []
  );

  const focarItem = React.useCallback((indice: number) => {
    const itens = itensDoMenu();
    if (!itens.length) return;
    const alvo = ((indice % itens.length) + itens.length) % itens.length;
    itens[alvo].focus();
  }, [itensDoMenu]);

  const fechar = React.useCallback((devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) gatilhoRef.current?.focus();
  }, []);

  // Padrao ARIA de menu: ao abrir, o foco vai para o primeiro item; sem isso o
  // usuario de teclado abre o menu e continua parado no gatilho.
  React.useEffect(() => {
    if (!aberto) return;
    gatilhoRef.current = raizRef.current?.querySelector<HTMLElement>(`#${CSS.escape(idBotao)}`) ?? null;
    focarItem(0);

    function aoClicarFora(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        fechar(true);
        return;
      }
      const itens = itensDoMenu();
      if (!itens.length) return;
      const atual = itens.indexOf(document.activeElement as HTMLElement);
      if (atual < 0) return;

      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        focarItem(atual + 1);
      } else if (evento.key === 'ArrowUp') {
        evento.preventDefault();
        focarItem(atual - 1);
      } else if (evento.key === 'Home') {
        evento.preventDefault();
        focarItem(0);
      } else if (evento.key === 'End') {
        evento.preventDefault();
        focarItem(itens.length - 1);
      }
    }

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, fechar, focarItem, idBotao, itensDoMenu]);

  return (
    <div ref={raizRef} className="relative inline-block">
      {React.cloneElement(gatilho, {
        id: idBotao,
        'aria-haspopup': 'menu',
        'aria-expanded': aberto,
        onClick: (evento: React.MouseEvent<HTMLElement>) => {
          gatilho.props.onClick?.(evento);
          setAberto((atual) => !atual);
        }
      })}
      {aberto ? (
        <div
          ref={menuRef}
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
