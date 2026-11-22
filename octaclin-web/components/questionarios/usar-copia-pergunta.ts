import { useLayoutEffect, useRef, useState } from 'react';
import { confirmarCopiaPergunta, prepararCopiaPergunta, listarPerguntas, type PerguntaApi, type PreviaCopiaPergunta } from '@/lib/questionarios-api';

export interface ContextoCopiaPergunta {
  questionarioId?: string;
  origemId?: string;
  bloqueio: string;
}
/** O chamador memoiza o contexto também por conteúdo/pendências/área, não só IDs. */
export function useCopiaPergunta(contexto: ContextoCopiaPergunta, aplicar: (perguntas: PerguntaApi[], novaId?: string, versao?: number) => void) {
  const atual = useRef(contexto), montado = useRef(false), emVoo = useRef(false);
  const [fase, setFase] = useState<'preparando' | 'confirmando' | 'conferindo' | null>(null);
  const [previa, setPrevia] = useState<{ contexto: ContextoCopiaPergunta; dados: PreviaCopiaPergunta } | null>(null);
  const [erro, setErro] = useState<{ contexto: ContextoCopiaPergunta; texto: string } | null>(null);
  const [conferencias, setConferencias] = useState<string[]>([]);
  useLayoutEffect(() => { atual.current = contexto; });
  useLayoutEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const valido = () => montado.current && atual.current === contexto;
  const precisaConferir = conferencias.includes(contexto.questionarioId ?? '');
  const exigirConferencia = (id: string) => { if (montado.current) setConferencias(ids => ids.includes(id) ? ids : [...ids, id]); };

  async function preparar() {
    if (contexto.bloqueio || precisaConferir || emVoo.current || !contexto.questionarioId || !contexto.origemId) return;
    emVoo.current = true; setFase('preparando'); setErro(null);
    try {
      const dados = await prepararCopiaPergunta(contexto.questionarioId, contexto.origemId);
      if (valido()) setPrevia({ contexto, dados });
    } catch {
      if (valido()) setErro({ contexto, texto: 'Não foi possível preparar a cópia. Confira o acesso e o estado do formulário.' });
    } finally { emVoo.current = false; if (montado.current) setFase(null); }
  }
  async function confirmar() {
    if (contexto.bloqueio || precisaConferir || emVoo.current || previa?.contexto !== contexto || !contexto.questionarioId || !contexto.origemId) return;
    emVoo.current = true; setFase('confirmando'); setErro(null);
    const id = contexto.questionarioId;
    try {
      const ack = await confirmarCopiaPergunta(id, contexto.origemId, previa.dados.revisao);
      const perguntas = await listarPerguntas(id);
      if (!perguntas.some(p => p.id === ack.perguntaId)) throw new Error('ACK sem confirmação de leitura');
      if (valido()) aplicar(perguntas, ack.perguntaId, ack.versaoQuestionario);
      else exigirConferencia(id);
    } catch {
      exigirConferencia(id);
      if (valido()) setErro({ contexto, texto: 'O resultado da cópia precisa ser conferido. Confira a lista antes de tentar novamente.' });
    } finally {
      emVoo.current = false;
      if (montado.current) { setPrevia(null); setFase(null); }
    }
  }
  async function conferir() {
    if (contexto.bloqueio || emVoo.current || !contexto.questionarioId) return;
    emVoo.current = true; setFase('conferindo'); setErro(null);
    try {
      const perguntas = await listarPerguntas(contexto.questionarioId);
      if (valido()) {
        aplicar(perguntas);
        setConferencias(ids => ids.filter(id => id !== contexto.questionarioId));
      }
    } catch {
      if (valido()) setErro({ contexto, texto: 'Não foi possível conferir a lista. Suas alterações foram preservadas.' });
    } finally { emVoo.current = false; if (montado.current) setFase(null); }
  }
  return {
    fase, preparar, confirmar, conferir, precisaConferir,
    previa: previa?.contexto === contexto ? previa.dados : null,
    erro: erro?.contexto === contexto ? erro.texto : null,
    bloqueio: contexto.bloqueio,
    cancelar: () => { if (!emVoo.current) setPrevia(null); }
  };
}
