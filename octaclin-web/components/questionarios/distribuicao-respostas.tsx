'use client';

import { useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

type Props = Pick<WorkspaceQuestionarios['perguntasLeituraFiltradas'][number], 'distribuicao' | 'enunciado'>;

export function DistribuicaoRespostas({ distribuicao, enunciado }: Props) {
  const listaId = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const [exibicao, setExibicao] = useState({ origem: distribuicao, limite: 4 });
  // Uma nova leitura não herda a expansão da anterior, mesmo com os mesmos IDs.
  if (exibicao.origem !== distribuicao) setExibicao({ origem: distribuicao, limite: 4 });
  const limite = exibicao.origem === distribuicao ? exibicao.limite : 4;
  const quantidade = Math.min(limite, distribuicao.length);
  const completa = quantidade === distribuicao.length;
  const recolher = () => {
    setExibicao({ origem: distribuicao, limite: 4 });
    botaoRef.current?.focus();
  };

  return (
    <div className="mt-3 min-w-0 space-y-2" role="group" aria-label={`Distribuição de respostas: ${enunciado}`} data-qst-distribuicao>
      {distribuicao.length > 4 ? (
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-texto-suave">
          {quantidade} de {distribuicao.length} categorias recebidas
        </p>
      ) : null}
      <ul id={listaId} role="list" className="flex min-w-0 flex-wrap gap-2">
        {distribuicao.slice(0, quantidade).map(item => (
          <li key={item.valor} className="max-w-full rounded-full border border-linha bg-white px-2 py-1 text-xs text-texto-suave [overflow-wrap:anywhere]">
            {item.valor}: {item.total}
          </li>
        ))}
      </ul>
      {distribuicao.length > 4 ? (
        <div className="flex flex-wrap gap-2">
          <Botao
            ref={botaoRef} type="button" tamanho="sm" aria-controls={listaId} aria-expanded={quantidade > 4}
            onClick={completa ? recolher : () => setExibicao({ origem: distribuicao, limite: quantidade + 20 })}
          >
            {completa ? 'Recolher categorias' : 'Mostrar mais categorias'}
          </Botao>
          {quantidade > 4 && !completa ? (
            <Botao type="button" tamanho="sm" aria-controls={listaId} onClick={recolher}>Recolher categorias</Botao>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
