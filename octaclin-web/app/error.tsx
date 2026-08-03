'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Botao } from '@/components/ui/botao';

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertTriangle size={28} className="text-alerta" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-tinta">Algo deu errado</h1>
      <p className="text-sm text-texto-suave">
        Nao foi possivel exibir esta pagina. Tente novamente; se o problema continuar, contate o suporte.
      </p>
      <Botao type="button" variante="primario" onClick={reset}>
        Tentar novamente
      </Botao>
    </div>
  );
}
