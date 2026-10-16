'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { SelecaoCalculoLocal, PlanoAlimentarResumoApi, ResultadoCalculoCombinadoApi } from '@/lib/plano-alimentar-api';
import { ErroApiPlanoAlimentar } from '@/lib/plano-alimentar-api';
import { calcularPlanosCombinados, obterSelecaoCalculoPlano } from '@/lib/calculo-combinado-planos-api';
import { atualizarSelecaoCalculo, iniciarSelecaoCalculo, montarEntradaCalculoCombinado } from '@/lib/calculo-combinado-planos';
import { CAMPOS_MICRONUTRIENTES_PLANO, formatarNutrientePlano } from '@/lib/micronutrientes-plano';

const ROTULOS: Record<string, { nome: string; unidade: string }> = {
  energiaKcal: { nome: 'Energia', unidade: 'kcal' }, proteinasG: { nome: 'Proteínas', unidade: 'g' },
  carboidratosG: { nome: 'Carboidratos', unidade: 'g' }, gordurasG: { nome: 'Gorduras', unidade: 'g' },
  fibrasG: { nome: 'Fibras', unidade: 'g' }, sodioMg: { nome: 'Sódio', unidade: 'mg' }
};
const LIMITE_PLANOS_SELECIONADOS = 25;
for (const item of CAMPOS_MICRONUTRIENTES_PLANO) ROTULOS[item.codigo] = { nome: item.rotulo, unidade: item.unidade };

function formatarDataPublicacao(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

interface Props {
  pacienteId: string;
  planos: PlanoAlimentarResumoApi[];
  selecoes: SelecaoCalculoLocal[];
  aoMudarSelecoes: Dispatch<SetStateAction<SelecaoCalculoLocal[]>>;
  revisaoOperacional: number;
  versaoPublicadaSelecionada?: string;
}

export function CalculoCombinadoPlanos({ pacienteId, planos, selecoes, aoMudarSelecoes, revisaoOperacional, versaoPublicadaSelecionada }: Props) {
  const [planoParaAdicionar, setPlanoParaAdicionar] = useState('');
  const [resultadoEstado, setResultadoEstado] = useState<{ chave: string; resultado: ResultadoCalculoCombinadoApi } | null>(null);
  const [erroEstado, setErroEstado] = useState<{ chave: string; mensagem: string } | null>(null);
  const [conflitoChave, setConflitoChave] = useState<string | null>(null);
  const [calculandoChave, setCalculandoChave] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const controlador = useRef<AbortController | null>(null);
  const controladorRevalidacao = useRef<AbortController | null>(null);
  const controladorSelecao = useRef<AbortController | null>(null);
  const geracao = useRef(0);
  const selecoesRef = useRef(selecoes);
  const chaveAtual = JSON.stringify({ pacienteId, selecoes, revisaoOperacional, versaoPublicadaSelecionada });
  const chaveAtualRef = useRef(chaveAtual);
  useLayoutEffect(() => {
    selecoesRef.current = selecoes;
    chaveAtualRef.current = chaveAtual;
  }, [chaveAtual, selecoes]);
  const resultado = resultadoEstado?.chave === chaveAtual ? resultadoEstado.resultado : null;
  const erro = erroEstado?.chave === chaveAtual ? erroEstado.mensagem : null;
  const conflito = conflitoChave === chaveAtual;
  const calculando = calculandoChave === chaveAtual;
  const opcoesDisponiveis = useMemo(() => planos.filter(plano => plano.ativoParaPaciente === true && !selecoes.some(item => item.planoId === plano.id)), [planos, selecoes]);

  const cancelarCalculo = useCallback(() => {
    geracao.current += 1;
    controlador.current?.abort();
    controlador.current = null;
  }, []);

  const invalidar = useCallback(() => {
    cancelarCalculo();
    setResultadoEstado(null);
  }, [cancelarCalculo]);

  const calcular = useCallback(async () => {
    const selecoesAtuais = selecoesRef.current;
    const chaveCalculo = chaveAtualRef.current;
    invalidar();
    const idGeracao = geracao.current;
    setErroEstado(null);
    setConflitoChave(null);
    if (selecoesAtuais.length === 0) {
      setCalculandoChave(null);
      return;
    }
    const abortController = new AbortController();
    controlador.current = abortController;
    setCalculandoChave(chaveCalculo);
    try {
      const resposta = await calcularPlanosCombinados(pacienteId, montarEntradaCalculoCombinado(selecoesAtuais), abortController.signal);
      if (abortController.signal.aborted || idGeracao !== geracao.current || chaveCalculo !== chaveAtualRef.current) return;
      setResultadoEstado({ chave: chaveCalculo, resultado: resposta });
    } catch (falha) {
      if (abortController.signal.aborted || idGeracao !== geracao.current || chaveCalculo !== chaveAtualRef.current) return;
      if (falha instanceof ErroApiPlanoAlimentar && falha.status === 409) {
        setConflitoChave(chaveCalculo);
        setErroEstado({ chave: chaveCalculo, mensagem: 'A publicação, a ativação ou as refeições mudaram. Atualize a seleção antes de calcular novamente.' });
      } else setErroEstado({ chave: chaveCalculo, mensagem: 'Não foi possível calcular os planos selecionados. Tente novamente.' });
    } finally {
      if (!abortController.signal.aborted && idGeracao === geracao.current) setCalculandoChave(null);
    }
  }, [invalidar, pacienteId]);

  useEffect(() => {
    cancelarCalculo();
    if (!selecoes.length) return;
    const timer = window.setTimeout(() => { void calcular(); }, 300);
    return () => window.clearTimeout(timer);
  }, [calcular, cancelarCalculo, chaveAtual, selecoes.length]);

  useEffect(() => () => {
    geracao.current += 1;
    controlador.current?.abort();
    controladorRevalidacao.current?.abort();
    controladorSelecao.current?.abort();
  }, []);

  const revalidarNoFoco = useCallback(async () => {
    const atuais = selecoesRef.current;
    if (!atuais.length) return;
    const chaveRevalidada = chaveAtualRef.current;
    invalidar();
    setCalculandoChave(chaveRevalidada);
    controladorRevalidacao.current?.abort();
    const signalController = new AbortController();
    controladorRevalidacao.current = signalController;
    const resultadoAtual = await Promise.all(atuais.map(async selecao => {
      try { return await obterSelecaoCalculoPlano(pacienteId, selecao.planoId, signalController.signal); }
      catch { return null; }
    }));
    if (signalController.signal.aborted || chaveRevalidada !== chaveAtualRef.current) return;
    const mudou = resultadoAtual.some((atual, indice) => !atual || atual.versao?.id !== atuais[indice].versaoId || atual.ativacaoRevisao !== atuais[indice].ativacaoRevisao);
    if (mudou) {
      invalidar();
      const chave = chaveAtualRef.current;
      setCalculandoChave(null);
      setConflitoChave(chave);
      setErroEstado({ chave, mensagem: 'Há alterações remotas neste cálculo. Atualize a seleção para revisar as versões e refeições disponíveis.' });
    } else await calcular();
  }, [calcular, invalidar, pacienteId]);

  useEffect(() => {
    window.addEventListener('focus', revalidarNoFoco);
    window.addEventListener('online', revalidarNoFoco);
    return () => {
      window.removeEventListener('focus', revalidarNoFoco);
      window.removeEventListener('online', revalidarNoFoco);
    };
  }, [revalidarNoFoco]);

  async function adicionarPlano() {
    if (selecoesRef.current.length >= LIMITE_PLANOS_SELECIONADOS) {
      setErroEstado({ chave: chaveAtualRef.current, mensagem: `O cálculo combinado aceita até ${LIMITE_PLANOS_SELECIONADOS} planos por vez.` });
      return;
    }
    const plano = planos.find(item => item.id === planoParaAdicionar);
    if (!plano || selecoes.some(item => item.planoId === plano.id)) return;
    setErroEstado(null);
    setAtualizando(true);
    const controller = new AbortController();
    controladorSelecao.current?.abort();
    controladorSelecao.current = controller;
    try {
      const remoto = await obterSelecaoCalculoPlano(pacienteId, plano.id, controller.signal);
      if (controller.signal.aborted) return;
      const nova = iniciarSelecaoCalculo(remoto, plano.titulo);
      if (!nova) setErroEstado({ chave: chaveAtualRef.current, mensagem: 'Este plano não está ativo ou ainda não tem uma versão publicada para cálculo.' });
      else {
        invalidar();
        aoMudarSelecoes(atuais => atuais.length >= LIMITE_PLANOS_SELECIONADOS || atuais.some(item => item.planoId === nova.planoId) ? atuais : [...atuais, nova]);
      }
    } catch {
      if (!controller.signal.aborted) setErroEstado({ chave: chaveAtualRef.current, mensagem: 'Não foi possível carregar a publicação atual deste plano.' });
    } finally {
      setAtualizando(false);
      setPlanoParaAdicionar('');
    }
  }

  async function atualizarSelecao() {
    setAtualizando(true);
    setErroEstado(null);
    const antigas = selecoesRef.current;
    const chaveAtualizada = chaveAtualRef.current;
    const controller = new AbortController();
    controladorSelecao.current?.abort();
    controladorSelecao.current = controller;
    try {
      const respostas = await Promise.all(antigas.map(async selecao => {
        try { return await obterSelecaoCalculoPlano(pacienteId, selecao.planoId, controller.signal); }
        catch { return null; }
      }));
      if (controller.signal.aborted || chaveAtualizada !== chaveAtualRef.current) return;
      if (respostas.some(resposta => !resposta)) throw new Error('atualizacao indisponivel');
      const novas = antigas.flatMap((antiga, indice) => {
        const resposta = respostas[indice];
        const atualizada = resposta ? atualizarSelecaoCalculo(antiga, resposta) : null;
        return atualizada ? [atualizada] : [];
      });
      invalidar();
      aoMudarSelecoes(novas);
      setConflitoChave(null);
    } catch {
      if (!controller.signal.aborted && chaveAtualizada === chaveAtualRef.current) setErroEstado({ chave: chaveAtualRef.current, mensagem: 'Não foi possível atualizar todos os planos. A seleção anterior foi mantida.' });
    } finally { setAtualizando(false); }
  }

  function marcarRefeicao(planoId: string, identidadeId: string, selecionada: boolean) {
    invalidar();
    aoMudarSelecoes(atuais => atuais.map(plano => plano.planoId !== planoId ? plano : {
      ...plano,
      refeicoes: plano.refeicoes.map(refeicao => refeicao.identidadeId === identidadeId ? { ...refeicao, selecionada } : refeicao)
    }));
  }

  function removerPlano(planoId: string) {
    invalidar();
    aoMudarSelecoes(atuais => atuais.filter(plano => plano.planoId !== planoId));
  }

  return (
    <section className="grid gap-3 rounded-lg border border-linha bg-white p-4" aria-labelledby="calculo-combinado-titulo">
      <div>
        <h2 id="calculo-combinado-titulo" className="text-base font-semibold text-tinta">Cálculo combinado de planos publicados</h2>
        <p className="mt-1 text-sm text-texto-suave">Soma factual dos alimentos previstos nas refeições escolhidas. Não representa consumo. Somente a publicação atual e itens ativos são considerados.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-sm font-medium text-tinta" htmlFor="calculo-plano-adicionar">Adicionar plano desta página
          <select id="calculo-plano-adicionar" value={planoParaAdicionar} onChange={evento => setPlanoParaAdicionar(evento.target.value)} className="min-h-11 rounded-md border border-linha bg-white px-3 text-sm">
            <option value="">Selecione um plano</option>
            {opcoesDisponiveis.map(plano => <option key={plano.id} value={plano.id}>{plano.titulo}</option>)}
          </select>
        </label>
        <Botao type="button" onClick={() => void adicionarPlano()} disabled={!planoParaAdicionar || atualizando || selecoes.length >= LIMITE_PLANOS_SELECIONADOS} className="self-end min-h-11">Adicionar</Botao>
      </div>
      {selecoes.length ? <ul className="grid gap-3" aria-label="Planos selecionados para o cálculo combinado">
        {selecoes.map(plano => (
          <li key={plano.planoId} className="rounded-md border border-linha p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="font-semibold text-tinta">{plano.titulo}</h3><p className="text-xs text-texto-suave">Versão publicada {plano.numeroVersao} em {formatarDataPublicacao(plano.publicadaEm)} · {plano.ativoParaPaciente ? 'ativa para o paciente' : 'desativada; não entra na soma'}</p></div>
              <button type="button" className="min-h-11 px-2 text-sm font-medium text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" onClick={() => removerPlano(plano.planoId)}>Remover do cálculo</button>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {plano.refeicoes.map(refeicao => <li key={refeicao.identidadeId}>
                <label className={`flex min-h-11 items-center gap-2 rounded px-2 text-sm ${!refeicao.ativa ? 'text-texto-suave' : 'text-tinta'}`}>
                  <input type="checkbox" checked={refeicao.selecionada} onChange={evento => marcarRefeicao(plano.planoId, refeicao.identidadeId, evento.target.checked)} className="h-4 w-4 accent-primaria" />
                  <span>{refeicao.nome}</span>{!refeicao.ativa ? <span className="text-xs">(desativada; não soma)</span> : null}
                </label>
              </li>)}
            </ul>
          </li>
        ))}
      </ul> : <p className="rounded-md bg-superficie p-3 text-sm text-texto-suave">Nenhum plano selecionado. A seleção fica apenas neste prontuário durante a sessão.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Botao type="button" onClick={() => void calcular()} disabled={!selecoes.length || calculando || atualizando} className="min-h-11">{calculando ? 'Calculando…' : 'Recalcular agora'}</Botao>
        {conflito ? <Botao type="button" variante="secundario" onClick={() => void atualizarSelecao()} disabled={atualizando} className="min-h-11"><RefreshCcw size={15} />Atualizar seleção</Botao> : null}
        {calculando ? <span role="status" className="text-sm text-texto-suave">Atualizando resultado…</span> : null}
      </div>
      {erro ? <p role="alert" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">{erro}</p> : null}
      {resultado ? <div className="grid gap-3" aria-live="polite">
        <p className="text-sm text-texto-suave">{resultado.estado === 'calculado' ? `${resultado.itensIncluidos} alimentos previstos somados · cálculo em ${new Date(resultado.calculadoEm).toLocaleString('pt-BR')}` : resultado.estado === 'sem_selecao' ? 'Selecione planos e refeições para calcular.' : 'Nenhum alimento ativo incluído no cálculo.'}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(resultado.nutrientes).map(([codigo, nutriente]) => {
            const label = ROTULOS[codigo] ?? { nome: codigo, unidade: nutriente.unidade };
            const valor = nutriente.estado === 'completo' ? nutriente.total : nutriente.estado === 'parcial' ? nutriente.quantidadeConhecida : undefined;
            const estado = nutriente.estado === 'completo' ? 'Completo' : nutriente.estado === 'parcial' ? `Parcial · ${nutriente.itensComValor}/${nutriente.itensIncluidos} itens com valor` : 'Indisponível';
            const sufixo = nutriente.estado === 'parcial' ? `conhecido ${label.unidade}` : label.unidade;
            return <div key={codigo} className="rounded-md border border-linha p-2"><p className="text-xs text-texto-suave">{label.nome} ({label.unidade})</p><p className="text-base font-semibold tabular-nums text-tinta">{formatarNutrientePlano(codigo, valor)} {sufixo}</p><p className="text-xs text-texto-suave">{estado}</p></div>;
          })}
        </div>
        {resultado.exclusoes.length ? <p className="text-xs text-texto-suave">Há planos ou refeições desativados fora da soma; revise a seleção se necessário.</p> : null}
      </div> : null}
    </section>
  );
}
