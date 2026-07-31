'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Botao } from '@/components/ui/botao';

const SELETOR_FOCAVEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ aberto, aoFechar, titulo, descricao, children, className }: ModalProps) {
  const conteudoRef = React.useRef<HTMLDivElement>(null);
  const gatilhoAnteriorRef = React.useRef<HTMLElement | null>(null);
  const tituloId = React.useId();
  const descricaoId = React.useId();

  React.useEffect(() => {
    if (!aberto) return;

    gatilhoAnteriorRef.current = document.activeElement as HTMLElement | null;
    const nodo = conteudoRef.current;
    nodo?.querySelector<HTMLElement>(SELETOR_FOCAVEL)?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar();
        return;
      }
      if (evento.key !== 'Tab' || !nodo) return;

      const focaveis = Array.from(nodo.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
        (elemento) => !elemento.hasAttribute('disabled')
      );
      if (!focaveis.length) return;

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowOriginal;
      gatilhoAnteriorRef.current?.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-tinta/40" onClick={aoFechar} aria-hidden="true" />
      <div
        ref={conteudoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao ? descricaoId : undefined}
        className={cn('relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-linha bg-white shadow-lg', className)}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-linha px-4 py-3">
          <h2 id={tituloId} className="text-sm font-semibold text-tinta">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-texto-suave transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <X size={16} />
          </button>
        </div>
        {descricao ? (
          <p id={descricaoId} className="shrink-0 px-4 pt-3 text-sm text-texto-suave">
            {descricao}
          </p>
        ) : null}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  confirmando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Cancelar',
  confirmando = false,
  aoConfirmar,
  aoCancelar
}: ModalConfirmacaoProps) {
  return (
    <Modal aberto={aberto} aoFechar={aoCancelar} titulo={titulo} descricao={mensagem}>
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="secundario" onClick={aoCancelar} disabled={confirmando}>
          {rotuloCancelar}
        </Botao>
        <Botao type="button" variante="perigo" onClick={aoConfirmar} disabled={confirmando}>
          {confirmando ? 'Processando' : rotuloConfirmar}
        </Botao>
      </div>
    </Modal>
  );
}
