'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { criarAlternativasAplicadasGrupo, prepararOpcoesAplicacaoGrupo, type AlternativaAplicadaGrupo, type AlternativaAplicacaoGrupo, type OpcaoAplicacaoGrupo } from '@/lib/aplicacao-grupo-substituicoes';
import { consultarGruposSubstituicoes, obterGrupoSubstituicoes } from '@/lib/plano-alimentar-api';
import type { GrupoSubstituicoesDetalhe, GrupoSubstituicoesResumo } from '@/lib/grupos-substituicoes-tipos';

interface AplicarGrupoSubstituicoesProps {
  identidadePrincipal: { origem: 'catalogo' | 'custom'; alimentoId: string };
  existentes: Array<{ origem: 'catalogo' | 'custom'; alimentoId?: string; alimentoComposicaoId?: string; porcaoGramas: number | string }>;
  aoAplicar: (alternativas: AlternativaAplicadaGrupo[], contexto: string, signal: AbortSignal) => Promise<boolean>;
  aoDesfazer?: (contexto: string) => Promise<boolean>;
  podeDesfazer?: boolean;
  contexto: string;
  desabilitado?: boolean;
}

export function AplicarGrupoSubstituicoes({ identidadePrincipal, existentes, aoAplicar, aoDesfazer, podeDesfazer = false, contexto, desabilitado = false }: AplicarGrupoSubstituicoesProps) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [grupos, setGrupos] = useState<GrupoSubstituicoesResumo[]>([]);
  const [buscaGrupo, setBuscaGrupo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalGrupos, setTotalGrupos] = useState(0);
  const [grupoId, setGrupoId] = useState('');
  const [detalhe, setDetalhe] = useState<GrupoSubstituicoesDetalhe | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoAplicacaoGrupo[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [porcoes, setPorcoes] = useState<Record<string, number>>({});
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const controladorGrupo = useRef<AbortController | null>(null);
  const sequenciaGrupo = useRef(0);
  const controladorAplicacao = useRef<AbortController | null>(null);
  useEffect(() => () => {
    controladorGrupo.current?.abort();
    controladorAplicacao.current?.abort();
    sequenciaGrupo.current += 1;
  }, [contexto]);
  useEffect(() => {
    if (!aberto) return;
    const controlador = new AbortController();
    void consultarGruposSubstituicoes({ pagina, limite: 25, estado: 'ativo', busca: buscaGrupo.trim().length >= 3 ? buscaGrupo.trim() : undefined }, controlador.signal)
      .then((resposta) => { if (!controlador.signal.aborted) { setGrupos(resposta.itens); setTotalGrupos(resposta.total); } })
      .catch((falha) => { if (!controlador.signal.aborted) setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar a biblioteca.')); });
    return () => controlador.abort();
  }, [aberto, contexto, buscaGrupo, pagina]);

  async function carregarGrupo(valor: string) {
    controladorGrupo.current?.abort();
    controladorGrupo.current = null;
    const sequencia = ++sequenciaGrupo.current;
    setGrupoId(valor); setDetalhe(null); setOpcoes([]); setSelecionadas(new Set()); setConfirmadas(new Set()); setErro(null);
    if (!valor) { setOcupado(false); return; }
    const controlador = new AbortController();
    controladorGrupo.current = controlador;
    setOcupado(true);
    try {
      const grupo = await obterGrupoSubstituicoes(valor, controlador.signal);
      if (controlador.signal.aborted || sequencia !== sequenciaGrupo.current) return;
      const disponiveis: AlternativaAplicacaoGrupo[] = [];
      for (const entrada of grupo.entradas) if ('composicao' in entrada && entrada.disponivel) {
        disponiveis.push({ ...entrada, entradaId: entrada.id, descricao: entrada.composicao.descricao, nutrientesPor100g: entrada.composicao.nutrientesPor100g as Record<string, number>, micronutrientesPor100g: entrada.composicao.micronutrientesPor100g as Record<string, number> | undefined });
      }
      const candidatas = prepararOpcoesAplicacaoGrupo(disponiveis, existentes, identidadePrincipal);
      setDetalhe(grupo); setOpcoes(candidatas); setPorcoes(Object.fromEntries(candidatas.map((opcao) => [opcao.entradaId, opcao.porcaoGramas])));
    } catch (falha) { if (!controlador.signal.aborted && sequencia === sequenciaGrupo.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir este grupo. Atualize a biblioteca e tente novamente.')); }
    finally { if (!controlador.signal.aborted && sequencia === sequenciaGrupo.current) setOcupado(false); }
  }

  function cancelarPrevia() {
    controladorAplicacao.current?.abort();
    controladorAplicacao.current = null;
    controladorGrupo.current?.abort();
    controladorGrupo.current = null;
    sequenciaGrupo.current += 1;
    setOcupado(false); setAberto(false); setErro(null); setGrupoId(''); setDetalhe(null); setOpcoes([]);
  }

  async function confirmar() {
    if (!detalhe || selecionadas.size === 0) { setErro('Selecione pelo menos uma alternativa disponível.'); return; }
    controladorAplicacao.current?.abort();
    const controlador = new AbortController();
    controladorAplicacao.current = controlador;
    setOcupado(true); setErro(null);
    try {
      const alternativas = criarAlternativasAplicadasGrupo(opcoes, selecionadas, porcoes, {
        grupoId: detalhe.id, revisao: detalhe.revisao, aplicacaoId: crypto.randomUUID()
      }, () => `alimento-${crypto.randomUUID()}`, confirmadas);
      const aplicada = await aoAplicar(alternativas, contexto, controlador.signal);
      if (controlador.signal.aborted || controladorAplicacao.current !== controlador) return;
      if (!aplicada) throw new Error('O plano mudou, a edição foi assumida em outra aba ou o acesso deixou de estar disponível. Reabra a prévia antes de aplicar.');
      setAberto(false); setDetalhe(null); setAvisoAplicado();
    } catch (falha) { if (!controlador.signal.aborted && controladorAplicacao.current === controlador) setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar as alternativas.')); }
    finally { if (controladorAplicacao.current === controlador) { controladorAplicacao.current = null; setOcupado(false); } }
  }
  const [sucesso, setSucesso] = useState(false);
  function setAvisoAplicado() { setSucesso(true); }

  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2"><Botao type="button" variante="fantasma" tamanho="sm" onClick={() => { setAberto(true); setErro(null); setSucesso(false); }} disabled={desabilitado}><Plus size={15} /> Aplicar grupo de alternativas</Botao>{sucesso ? <><span role="status" className="self-center text-sm text-texto-suave">Alternativas acrescentadas ao rascunho e ainda não liberadas ao paciente.</span><Botao type="button" variante="fantasma" tamanho="sm" onClick={async () => { if (aoDesfazer && await aoDesfazer(contexto)) setSucesso(false); else setErro('Não é possível desfazer: o rascunho foi salvo, as alternativas mudaram ou o contexto de edição mudou.'); }} disabled={!podeDesfazer}>Desfazer</Botao></> : null}</div>
    {aberto ? <section className="grid gap-3 rounded-md border border-primaria/30 bg-superficie p-3" aria-label="Prévia da aplicação do grupo" aria-busy={ocupado}>
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Aplicar alternativas de um grupo</h4><Botao type="button" variante="fantasma" onClick={cancelarPrevia}>Cancelar</Botao></div>
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-busca`}>Buscar grupo por nome (3 caracteres)<Campo id={`${id}-busca`} value={buscaGrupo} onChange={(event) => { setBuscaGrupo(event.target.value); setPagina(1); setGrupoId(''); setDetalhe(null); }} /></label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-grupo`}>Grupo ativo<select id={`${id}-grupo`} value={grupoId} onChange={(event) => void carregarGrupo(event.target.value)} disabled={ocupado} className="min-h-11 rounded-md border border-linha bg-white px-2"><option value="">Selecione</option>{grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome} · {grupo.escopo === 'clinica' ? 'Clínica' : 'Pessoal'} · {grupo.quantidadeEntradas} alimentos</option>)}</select></label><div className="flex items-center gap-1"><Botao type="button" variante="fantasma" onClick={() => setPagina((atual) => Math.max(1, atual - 1))} disabled={pagina === 1}>Anterior</Botao><span className="text-xs" aria-live="polite">{pagina}/{Math.max(1, Math.ceil(totalGrupos / 25))}</span><Botao type="button" variante="fantasma" onClick={() => setPagina((atual) => atual + 1)} disabled={pagina * 25 >= totalGrupos}>Próxima</Botao></div></div>
      {detalhe ? <><p className="text-xs text-texto-suave">Escolha somente as alternativas desejadas. A porção é ajustável; a aplicação não substitui o alimento principal nem altera o grupo original.</p>{opcoes.length ? opcoes.map((opcao) => <div key={opcao.entradaId} className="grid gap-2 rounded border border-linha bg-white p-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center"><label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={selecionadas.has(opcao.entradaId)} disabled={opcao.estado === 'existente'} onChange={(event) => setSelecionadas((atual) => { const proximo = new Set(atual); if (event.target.checked) proximo.add(opcao.entradaId); else proximo.delete(opcao.entradaId); return proximo; })} /><span><strong>{opcao.descricao}</strong><span className="block text-xs text-texto-suave">{opcao.estado === 'existente' ? 'Já presente com a mesma porção; não será duplicado.' : opcao.estado === 'porcao-divergente' ? 'Já existe com porção diferente. Confirme para acrescentar sem sobrescrever.' : `${opcao.origem === 'custom' ? 'Personalizado' : 'Catálogo'} · ${opcao.porcaoGramas} g`}</span></span></label><label className="grid gap-1 text-xs font-semibold">Porção (g)<Campo type="number" min="0.001" max="10000" step="0.001" value={porcoes[opcao.entradaId] ?? ''} disabled={opcao.estado === 'existente'} onChange={(event) => setPorcoes((atual) => ({ ...atual, [opcao.entradaId]: Number(event.target.value) }))} /></label>{opcao.estado === 'porcao-divergente' && selecionadas.has(opcao.entradaId) ? <label className="flex gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={confirmadas.has(opcao.entradaId)} onChange={(event) => setConfirmadas((atual) => { const proximo = new Set(atual); if (event.target.checked) proximo.add(opcao.entradaId); else proximo.delete(opcao.entradaId); return proximo; })} /> Confirmo acrescentar esta porção diferente; manter a existente.</label> : null}</div>) : <p className="text-sm text-texto-suave">Não há alternativas disponíveis novas neste grupo. O alimento principal é omitido da lista; entradas indisponíveis não podem ser aplicadas.</p>}<Botao type="button" variante="primario" onClick={() => void confirmar()} carregando={ocupado} disabled={desabilitado || selecionadas.size === 0}>Acrescentar selecionadas</Botao></> : null}
    </section> : null}
  </div>;
}
