'use client';

import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Campo } from '@/components/ui/campo';
import { cn } from '@/lib/utils';

type CampoSenhaProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const CampoSenha = forwardRef<HTMLInputElement, CampoSenhaProps>(function CampoSenha(
  { className, onKeyUp, onKeyDown, id, ...props },
  ref
) {
  const [visivel, setVisivel] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const idAvisoCapsLock = id ? `${id}-caps-lock` : undefined;

  function detectarCapsLock(evento: KeyboardEvent<HTMLInputElement>) {
    if (typeof evento.getModifierState === 'function') {
      setCapsLockAtivo(evento.getModifierState('CapsLock'));
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Campo
          ref={ref}
          id={id}
          type={visivel ? 'text' : 'password'}
          className={cn('pr-11', className)}
          aria-describedby={capsLockAtivo && idAvisoCapsLock ? idAvisoCapsLock : undefined}
          onKeyUp={(evento) => {
            detectarCapsLock(evento);
            onKeyUp?.(evento);
          }}
          onKeyDown={(evento) => {
            detectarCapsLock(evento);
            onKeyDown?.(evento);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-suave hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
        >
          {visivel ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {capsLockAtivo ? (
        <p id={idAvisoCapsLock} role="status" className="rounded-md border border-alerta-borda bg-alerta-suave px-3 py-2 text-xs text-alerta-forte">
          Caps Lock ativado.
        </p>
      ) : null}
    </div>
  );
});
