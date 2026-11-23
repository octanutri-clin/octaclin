'use client';

import { useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { obterCompletudeHistorica, type CompletudeHistoricaApi } from '@/lib/questionarios-api';

/** Montado por identidade do envio apenas na leitura individual, nunca marca revisão. */
export function CompletudeHistorica({ questionarioId, respostaId }: { questionarioId: string; respostaId: string }) {
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState<{ tentativa: number; dados?: CompletudeHistoricaApi; erro?: boolean } | null>(null);
  useEffect(() => {
    if (!tentativa) return;
    const abort = new AbortController(); let ativo = true;
    void obterCompletudeHistorica(questionarioId, respostaId, abort.signal).then(dados => {
      if (ativo) setEstado({ tentativa, dados });
    }).catch(() => { if (ativo) setEstado({ tentativa, erro: true }); });
    return () => { ativo = false; abort.abort(); };
  }, [questionarioId, respostaId, tentativa]);
  const atual = estado?.tentativa === tentativa ? estado : null;
  const c = atual?.dados?.completude;
  const carregando = tentativa > 0 && !atual;
  return <section aria-label="Preenchimento histórico" aria-busy={carregando} data-qst10-completude className={tentativa ? 'space-y-2 rounded-md border border-linha bg-superficie p-3 text-sm' : 'text-sm'}>
    <Botao tamanho="sm" aria-disabled={carregando} onClick={() => { if (!carregando) setTentativa(n => n + 1); }}>
      {!tentativa ? 'Consultar preenchimento histórico' : carregando ? 'Consultando preenchimento...' : atual?.erro ? 'Tentar consultar novamente' : 'Atualizar preenchimento'}
    </Botao>
    {tentativa > 0 && <div className="space-y-2">
      <p className="font-semibold">Preenchimento do envio</p>
      {!atual && <p role="status">Consultando a estrutura histórica deste envio...</p>}
      {atual?.erro && <p role="alert">Não foi possível consultar o preenchimento deste envio. Confira o acesso e tente novamente.</p>}
      {c?.estado === 'desconhecido' && <p>Preenchimento desconhecido: {c.motivo === 'snapshot_ausente' ? 'a estrutura histórica deste envio não está disponível.' : 'os dados históricos não permitem uma contagem confiável.'} A versão atual do questionário não foi usada para preencher essa ausência.</p>}
      {c?.estado === 'disponivel' && <><p>{c.respondidas} de {c.totalPerguntas} perguntas preenchidas na versão enviada {c.versaoQuestionario}.</p><p>{c.obrigatoriasRespondidas} de {c.obrigatorias} perguntas obrigatórias preenchidas.</p></>}
      <p className="text-xs text-texto-suave">Preenchimento não mede qualidade das respostas nem adesão ao acompanhamento.</p>
    </div>}
  </section>;
}
