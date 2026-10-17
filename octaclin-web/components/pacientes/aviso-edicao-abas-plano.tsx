'use client';

import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import type { EstadoCoordenacaoAbasPlano } from '@/lib/coordenacao-abas-plano';

interface AvisoEdicaoAbasPlanoProps {
  estado: EstadoCoordenacaoAbasPlano;
  aoAssumir: () => Promise<void>;
  aoRecarregar: () => void;
}

export function AvisoEdicaoAbasPlano({ estado, aoAssumir, aoRecarregar }: AvisoEdicaoAbasPlanoProps) {
  const [solicitando, setSolicitando] = useState(false);
  const [falha, setFalha] = useState(false);

  if (estado === 'editando' || estado === 'encerrado') return null;

  const retomar = async () => {
    if (solicitando) return;
    setSolicitando(true);
    setFalha(false);
    try {
      await aoAssumir();
    } catch {
      setFalha(true);
    } finally {
      setSolicitando(false);
    }
  };

  if (estado === 'consulta' || estado === 'transferindo') {
    return (
      <div data-pa07-aviso="true" role="status" aria-live="polite" className="flex flex-col items-start gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-4 text-sm text-alerta-forte sm:flex-row sm:items-center sm:justify-between">
        <p>{estado === 'transferindo' || solicitando
          ? 'Aguardando a outra aba liberar a edição deste plano.'
          : 'A edição está em outra aba. Esta aba está em modo de consulta.'}</p>
        <Botao type="button" tamanho="sm" onClick={() => void retomar()} carregando={solicitando} disabled={estado === 'transferindo' || solicitando}>
          Editar nesta aba
        </Botao>
        {falha ? <span role="alert" className="basis-full">Não foi possível retomar a edição. Confira a outra aba e tente novamente.</span> : null}
      </div>
    );
  }

  if (estado === 'reconferir') {
    return (
      <div data-pa07-aviso="true" role="alert" className="grid gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-4 text-sm text-alerta-forte">
        <p>O rascunho precisa ser reconferido. As alterações locais foram preservadas e não serão salvas automaticamente.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Botao type="button" tamanho="sm" onClick={aoRecarregar}>Recarregar rascunho</Botao>
        </div>
        {falha ? <p role="alert">Não foi possível retomar a edição. Confira o estado do rascunho e tente novamente.</p> : null}
      </div>
    );
  }

  if (estado === 'indisponivel') {
    return (
      <div data-pa07-aviso="true" role="alert" className="rounded-md border border-alerta-borda bg-alerta-suave p-4 text-sm text-alerta-forte">
        Não foi possível coordenar a edição entre abas. Evite editar este plano simultaneamente em outra aba.
      </div>
    );
  }

  return <div role="status" aria-live="polite" className="rounded-md border border-linha bg-superficie p-4 text-sm text-texto-suave">Verificando a edição deste plano nesta aba…</div>;
}
