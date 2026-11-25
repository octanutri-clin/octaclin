'use client';

import { useEffect, useRef, useState } from 'react';
import { compararRetornosQuestionario, ErroApiQuestionarios } from '@/lib/questionarios-api';
import type { ComparacaoRetornosApi, RespostaQuestionarioRecebidaApi } from '@/lib/questionarios-api';

type Selecionada = Pick<RespostaQuestionarioRecebidaApi, 'respostaId' | 'envioId' | 'pacienteId' | 'finalizadoEm'> & { timezone?: string };
type Estado = { contexto: string; versao: number; selecionadas: Selecionada[]; resultado: ComparacaoRetornosApi | null; carregando: boolean; erro: string | null };
const vazio = (contexto: string, versao: number): Estado => ({ contexto, versao, selecionadas: [], resultado: null, carregando: false, erro: null });

export function useComparacaoRetornos(contexto: string, questionarioId?: string) {
  const [estado, setEstado] = useState(() => vazio(contexto, 0));
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  // A versão monotônica também invalida respostas A→B→A. Nenhum dado vai para storage.
  if (estado.contexto !== contexto) setEstado(vazio(contexto, estado.versao + 1));
  const atual = estado.contexto === contexto ? estado : vazio(contexto, estado.versao + 1);

  function podeSelecionar(resposta: RespostaQuestionarioRecebidaApi) {
    return resposta.questionarioId === questionarioId && (atual.selecionadas.some(s => s.respostaId === resposta.respostaId)
      || (atual.selecionadas.length < 2 && (!atual.selecionadas.length || atual.selecionadas[0].pacienteId === resposta.pacienteId)));
  }
  function alternar(resposta: RespostaQuestionarioRecebidaApi, timezone?: string) {
    setEstado(s => {
      if (s.contexto !== contexto || resposta.questionarioId !== questionarioId) return s;
      const existe = s.selecionadas.some(x => x.respostaId === resposta.respostaId);
      if (!existe && (s.selecionadas.length === 2 || (s.selecionadas.length && s.selecionadas[0].pacienteId !== resposta.pacienteId))) return s;
      const selecionadas = existe ? s.selecionadas.filter(x => x.respostaId !== resposta.respostaId) : [...s.selecionadas,
        { respostaId: resposta.respostaId, envioId: resposta.envioId, pacienteId: resposta.pacienteId, finalizadoEm: resposta.finalizadoEm, timezone }];
      return { ...s, selecionadas, resultado: null, erro: null, carregando: false, versao: s.versao + 1 };
    });
  }
  function remover(id: string) {
    setEstado(s => s.contexto === contexto ? { ...s, selecionadas: s.selecionadas.filter(x => x.respostaId !== id), resultado: null, carregando: false, erro: null, versao: s.versao + 1 } : s);
  }
  function fechar(limpar = false) {
    setEstado(s => s.contexto === contexto ? { ...s, selecionadas: limpar ? [] : s.selecionadas, resultado: null, carregando: false, erro: null, versao: s.versao + 1 } : s);
  }
  async function comparar() {
    if (!questionarioId || atual.selecionadas.length !== 2 || atual.carregando) return;
    const versao = atual.versao + 1;
    const par = atual.selecionadas;
    setEstado(s => s.contexto === contexto && s.versao === atual.versao ? { ...s, versao, resultado: null, erro: null, carregando: true } : s);
    try {
      const resultado = await compararRetornosQuestionario(questionarioId, par[0].pacienteId, par.map(s => s.respostaId));
      if (montado.current) setEstado(s => s.contexto === contexto && s.versao === versao ? { ...s, resultado, carregando: false } : s);
    } catch (e) {
      const status = e instanceof ErroApiQuestionarios ? e.status : 0;
      const mensagens: Record<number, string> = {
        400: 'Confira a seleção de dois retornos do mesmo paciente.',
        401: 'Sua sessão precisa ser renovada. Entre novamente para consultar os retornos.',
        403: 'O acesso aos retornos não está disponível. Confira suas permissões.',
        404: 'Os retornos selecionados não estão disponíveis. Atualize a lista e selecione novamente.',
        409: 'Os retornos foram alterados. Atualize a lista e confira uma nova seleção.',
        413: 'Os retornos excedem o limite da comparação. Consulte cada envio individualmente.'
      };
      if (montado.current) setEstado(s => s.contexto === contexto && s.versao === versao ? { ...s, resultado: null, carregando: false,
        selecionadas: [401, 403, 404, 409].includes(status) ? [] : s.selecionadas,
        erro: mensagens[status] ?? 'Não foi possível comparar os retornos. Tente novamente.' } : s);
    }
  }
  return { ...atual, alternar, podeSelecionar, remover, limpar: () => fechar(true), fechar: () => fechar(), comparar };
}

export type ControleComparacaoRetornos = ReturnType<typeof useComparacaoRetornos>;
