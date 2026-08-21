'use client';

import { CloudUpload, Download, WifiOff } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { usePwa } from './pwa-runtime';

export function StatusPwaPortal() {
  const { online, instalavel, instalar, pendentes, processando } = usePwa();
  if (online && !instalavel && pendentes === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {!online ? (
        <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-alerta-borda bg-alerta-suave px-3 text-sm font-medium text-alerta-forte">
          <WifiOff className="h-4 w-4" /> Sem conexão
        </span>
      ) : null}
      {pendentes > 0 ? (
        <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-texto-forte">
          <CloudUpload className="h-4 w-4" /> {processando ? 'Sincronizando' : `${pendentes} pendente${pendentes > 1 ? 's' : ''}`}
        </span>
      ) : null}
      {instalavel ? (
        <Botao type="button" onClick={() => void instalar()}>
          <Download className="h-4 w-4" /> Instalar
        </Botao>
      ) : null}
    </div>
  );
}
