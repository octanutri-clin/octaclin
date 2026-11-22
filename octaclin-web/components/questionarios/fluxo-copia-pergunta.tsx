'use client';

import { useId, useRef } from 'react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import type { useCopiaPergunta } from './usar-copia-pergunta';
import { PreviewQuestionarioPaciente } from './preview-questionario-paciente';

export function FluxoCopiaPergunta({ copia, titulo }: { copia: ReturnType<typeof useCopiaPergunta>; titulo: string }) {
  const motivoId = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  function cancelar() {
    if (copia.fase !== null) return;
    copia.cancelar();
    // A preparação desabilitou o campo de origem antes de o Modal capturar foco.
    requestAnimationFrame(() => botaoRef.current?.focus());
  }
  const motivo = copia.bloqueio || (copia.fase ? 'Aguarde a operação em andamento.' : copia.precisaConferir ? 'Confira a lista de perguntas antes de duplicar novamente.' : 'A cópia será inserida logo após a pergunta original.');
  const d = copia.previa?.definicao;
  return (
    <div className="grid min-w-0 gap-2">
      <Botao ref={botaoRef} type="button" onClick={copia.preparar} aria-describedby={motivoId} disabled={Boolean(copia.bloqueio) || copia.fase !== null || copia.precisaConferir}>Duplicar pergunta</Botao>
      <p id={motivoId} className="text-sm text-texto-suave">{motivo}</p>
      {copia.erro ? <p role="alert" className="text-sm text-alerta-forte">{copia.erro}</p> : null}
      {copia.precisaConferir ? <Botao type="button" onClick={copia.conferir} disabled={Boolean(copia.bloqueio) || copia.fase !== null}>Conferir lista de perguntas</Botao> : null}
      <Modal aberto={Boolean(d)} aoFechar={cancelar} titulo="Duplicar pergunta salva" descricao={copia.fase === 'confirmando' ? 'Confirmando a cópia. Aguarde a conclusão.' : 'Confira a versão salva. Nenhuma alteração será feita antes da confirmação.'}>
        {d ? <div className="grid min-w-0 gap-4" aria-busy={copia.fase === 'confirmando'}>
          <p className="text-sm">Formulário: {titulo}. A cópia ficará no mesmo rascunho, logo após a original, com nova identidade, sem chave clínica e sem publicação na biblioteca.</p>
          <PreviewQuestionarioPaciente titulo="Prévia da cópia salva" perguntas={[{
            ...d, id: 'previa-copia', peso: Number(d.peso), ordem: 1,
            opcoes: d.opcoes.map(o => ({ ...o, imagemUrl: o.imagemUrl ?? undefined }))
          }]} />
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" onClick={cancelar} disabled={copia.fase !== null}>Cancelar</Botao>
            <Botao type="button" variante="primario" onClick={copia.confirmar} disabled={copia.fase !== null}>{copia.fase === 'confirmando' ? 'Confirmando…' : 'Confirmar cópia'}</Botao>
          </div>
        </div> : null}
      </Modal>
    </div>
  );
}
