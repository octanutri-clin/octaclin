'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList, RefreshCcw, TrendingUp } from 'lucide-react';
import { CompletudeHistorica } from './completude-historica';
import { ExportacaoRespostas } from './exportacao-respostas';
import { DistribuicaoRespostas } from './distribuicao-respostas';
import { Botao } from '@/components/ui/botao';
import { Abas } from '@/components/ui/abas';
import { Cartao } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { formatarDataResposta, formatarValorResposta } from './usar-workspace-questionarios';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

function TextoComRealce({ texto, busca }: { texto: string; busca: string }) {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  if (!termo) return texto;
  const normalizado = texto.toLocaleLowerCase('pt-BR');
  // Mapear offsets preserva Unicode quando o lower-case expande um caractere.
  const limites: { inicio: number; fim: number }[] = [];
  let posicao = 0;
  for (const caractere of texto) {
    for (let i = 0; i < caractere.toLocaleLowerCase('pt-BR').length; i += 1) {
      limites.push({ inicio: posicao, fim: posicao + caractere.length });
    }
    posicao += caractere.length;
  }
  const partes = [];
  let fimAnterior = 0;
  let indice = normalizado.indexOf(termo);
  while (indice !== -1) {
    const inicio = limites[indice].inicio;
    const fim = limites[indice + termo.length - 1].fim;
    if (inicio >= fimAnterior) {
      partes.push(texto.slice(fimAnterior, inicio));
      partes.push(<mark key={inicio} className="rounded-sm bg-alerta-suave text-tinta">{texto.slice(inicio, fim)}</mark>);
      fimAnterior = fim;
    }
    indice = normalizado.indexOf(termo, indice + termo.length);
  }
  partes.push(texto.slice(fimAnterior));
  return partes;
}

function ListaRespostas({
  respostasVisiveis, pacientesPorId, carregandoRespostas, buscaRespostas
}: Pick<WorkspaceQuestionarios, 'respostasVisiveis' | 'pacientesPorId' | 'carregandoRespostas' | 'buscaRespostas'>) {
  const idLista = useId();
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());

  const [leituraId, setLeituraId] = useState<string | null>(null);
  const grupoRef = useRef<HTMLDivElement>(null);
  const tituloLeituraRef = useRef<HTMLHeadingElement>(null);
  const gatilhosRef = useRef(new Map<string, HTMLButtonElement>());
  const origemRef = useRef<string | null>(null);
  const devolverFocoRef = useRef(false);
  const indiceLeitura = respostasVisiveis.findIndex((resposta) => resposta.respostaId === leituraId);
  const respostaLeitura = respostasVisiveis[indiceLeitura];
  // Ajuste condicional do próprio estado: um envio removido não pode reabrir
  // quando o filtro voltar. A identidade, e não a posição, controla a seleção.
  if (leituraId !== null && indiceLeitura === -1) setLeituraId(null);

  useEffect(() => {
    if (leituraId !== null) {
      if (grupoRef.current) grupoRef.current.scrollTop = 0;
      tituloLeituraRef.current?.focus();
    } else if (origemRef.current) {
      if (devolverFocoRef.current || document.activeElement === document.body) {
        const gatilho = gatilhosRef.current.get(origemRef.current);
        (gatilho && !gatilho.disabled ? gatilho : grupoRef.current)?.focus();
      }
      origemRef.current = null;
      devolverFocoRef.current = false;
    }
  }, [leituraId]);

  function alternarResposta(respostaId: string) {
    setRecolhidas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(respostaId)) proximas.delete(respostaId);
      else proximas.add(respostaId);
      return proximas;
    });
  }

  function organizarExibidas(recolher: boolean) {
    setRecolhidas((atuais) => {
      const proximas = new Set(atuais);
      respostasVisiveis.forEach(({ respostaId }) => {
        if (recolher) proximas.add(respostaId);
        else proximas.delete(respostaId);
      });
      return proximas;
    });
  }

  return (
    <div ref={grupoRef} tabIndex={-1} role="group" aria-label="Leitura dos envios" className={respostaLeitura ? 'flex min-w-0 flex-col gap-3 md:max-h-[75vh] md:overflow-y-auto' : 'grid min-w-0 gap-3'} data-qst01-respostas data-qst-p02-leitura={respostaLeitura ? true : undefined}>
      {respostasVisiveis.length ? (
        <>
          {respostaLeitura ? (
            <div className="z-10 grid min-w-0 shrink-0 gap-2 rounded-md border border-linha bg-white p-3 md:sticky md:top-0">
              <h3 ref={tituloLeituraRef} tabIndex={-1} className="text-sm font-semibold text-tinta">Leitura individual</h3>
              <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0 break-words text-sm text-tinta">
                <p>{carregandoRespostas ? 'Atualizando envios...' : `Envio ${indiceLeitura + 1} de ${respostasVisiveis.length}`}</p>
                <p>{pacientesPorId.get(respostaLeitura.pacienteId)?.nome ?? 'Paciente não identificado'}</p>
                <p>Finalizado em {formatarDataResposta(respostaLeitura.finalizadoEm)}</p>
              </div>
              <div role="group" aria-label="Navegação entre envios" className="flex flex-wrap gap-2">
                <Botao type="button" disabled={carregandoRespostas || indiceLeitura === 0} onClick={() => setLeituraId(respostasVisiveis[indiceLeitura - 1].respostaId)}>Anterior</Botao>
                <Botao type="button" disabled={carregandoRespostas || indiceLeitura === respostasVisiveis.length - 1} onClick={() => setLeituraId(respostasVisiveis[indiceLeitura + 1].respostaId)}>Próximo</Botao>
                <Botao type="button" onClick={() => { devolverFocoRef.current = true; setLeituraId(null); }}>Voltar à lista</Botao>
              </div>
            </div>
          ) : (
          <div role="group" aria-label="Organizar respostas exibidas" className="flex flex-wrap items-center gap-2">
            <p className="w-full text-xs text-texto-suave">As ações abaixo se aplicam aos resultados exibidos.</p>
            <Botao type="button" tamanho="sm" disabled={carregandoRespostas} onClick={() => organizarExibidas(false)}>Expandir tudo</Botao>
            <Botao type="button" tamanho="sm" disabled={carregandoRespostas} onClick={() => organizarExibidas(true)}>Recolher tudo</Botao>
          </div>
          )}
          {respostaLeitura && <CompletudeHistorica key={`${respostaLeitura.questionarioId}:${respostaLeitura.respostaId}`} questionarioId={respostaLeitura.questionarioId} respostaId={respostaLeitura.respostaId} />}
          {(respostaLeitura ? [respostaLeitura] : respostasVisiveis).map((resposta) => {
            const paciente = pacientesPorId.get(resposta.pacienteId);
            const aberta = Boolean(respostaLeitura) || !recolhidas.has(resposta.respostaId);
            const conteudoId = `${idLista}-${resposta.respostaId}`;
            return (
              <article key={resposta.respostaId} className="min-w-0 shrink-0 rounded-md border border-linha bg-superficie p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold text-tinta"><TextoComRealce texto={paciente?.nome ?? 'Paciente não identificado'} busca={buscaRespostas} /></p>
                    <p className="text-xs text-texto-suave">Finalizado em {formatarDataResposta(resposta.finalizadoEm)}</p>
                  </div>
                  <span className="rounded-full border border-linha bg-white px-3 py-1 text-xs font-semibold text-texto-suave">
                    {resposta.totalRespostas} {resposta.totalRespostas === 1 ? 'resposta' : 'respostas'}
                  </span>
                  {!respostaLeitura ? <Botao
                    type="button" tamanho="sm" disabled={carregandoRespostas}
                    aria-expanded={aberta} aria-controls={conteudoId}
                    aria-label={`${aberta ? 'Recolher' : 'Expandir'} respostas de ${paciente?.nome ?? 'paciente não identificado'}`}
                    onClick={() => alternarResposta(resposta.respostaId)}
                  >
                    {aberta ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    {aberta ? 'Recolher respostas' : 'Expandir respostas'}
                  </Botao> : null}
                  {!respostaLeitura ? <Botao
                    ref={(elemento) => { if (elemento) gatilhosRef.current.set(resposta.respostaId, elemento); else gatilhosRef.current.delete(resposta.respostaId); }}
                    type="button" tamanho="sm" disabled={carregandoRespostas}
                    onClick={() => { origemRef.current = resposta.respostaId; setLeituraId(resposta.respostaId); }}
                  >Ler envio</Botao> : null}
                </div>
                <div id={conteudoId} hidden={!aberta}>
                  <dl className="mt-4 grid gap-2 md:grid-cols-2">
                    {resposta.respostas.map((item) => (
                      <div key={`${resposta.respostaId}-${item.perguntaId}`} className="min-w-0 rounded-md border border-linha bg-white p-3">
                        <dt className="text-xs font-medium text-texto-suave"><TextoComRealce texto={item.enunciado} busca={buscaRespostas} /></dt>
                        <dd className="mt-1 break-words text-sm font-semibold text-tinta"><TextoComRealce texto={formatarValorResposta(item.valor)} busca={buscaRespostas} /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            );
          })}
        </>
      ) : (
        <div className="p-2 text-sm text-texto-suave">
          {carregandoRespostas ? 'Carregando respostas.' : 'Nenhuma resposta encontrada para os filtros atuais.'}
        </div>
      )}
    </div>
  );
}

export function AreaRespostas({ workspace }: { workspace: WorkspaceQuestionarios }) {
  const buscaRef = useRef<HTMLInputElement>(null);
  const abasId = useId();
  const contexto = JSON.stringify([workspace.questionarioAtual?.id, workspace.pacienteFiltroRespostas]);
  const [visualizacao, setVisualizacao] = useState({ contexto, aba: 'envios' });
  if (visualizacao.contexto !== contexto) setVisualizacao({ contexto, aba: 'envios' });
  const aba = visualizacao.contexto === contexto ? visualizacao.aba : 'envios';
  const {
    respostasVisiveis, leituraClinica, carregandoRespostas, pacienteFiltroRespostas,
    setPacienteFiltroRespostas, carregarRespostas, questionarioAtual, buscaRespostas,
    setBuscaRespostas, perguntasLeituraFiltradas, matrizLongitudinal, carregandoMatriz,
    carregarMatrizLongitudinal, pacienteFiltroMatriz, setPacienteFiltroMatriz,
    questionarioFiltroMatriz, setQuestionarioFiltroMatriz, categoriaFiltroMatriz,
    setCategoriaFiltroMatriz, inicioFiltroMatriz, setInicioFiltroMatriz, fimFiltroMatriz,
    setFimFiltroMatriz, pacientes, pacientesPorId, questionarios, categorias
  } = workspace;

  return (
    <>
      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-texto-suave" />
            <h2 className="text-sm font-semibold text-tinta">Leitura clínica das respostas</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Botao
              type="button"
              onClick={() => void carregarRespostas(questionarioAtual?.id, pacienteFiltroRespostas)}
              disabled={carregandoRespostas || !questionarioAtual}
            >
              <RefreshCcw className="h-4 w-4" />
              {carregandoRespostas ? 'Atualizando respostas' : 'Atualizar respostas'}
            </Botao>
            {questionarioAtual ? (
              <ExportacaoRespostas
                key={JSON.stringify([questionarioAtual.id, pacienteFiltroRespostas, buscaRespostas, respostasVisiveis.map(r => r.respostaId)])}
                questionarioId={questionarioAtual.id} respostaIds={respostasVisiveis.map(r => r.respostaId)} carregando={carregandoRespostas}
              />
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,300px)_minmax(220px,1fr)]">
            <label className="space-y-1.5">
              <Rotulo htmlFor="filtro-paciente-respostas">Paciente</Rotulo>
              <Selecao
                id="filtro-paciente-respostas"
                value={pacienteFiltroRespostas}
                onChange={(event) => {
                  const pacienteId = event.target.value;
                  setPacienteFiltroRespostas(pacienteId);
                  void carregarRespostas(questionarioAtual?.id, pacienteId);
                }}
                disabled={!questionarioAtual}
              >
                <option value="">Todos os pacientes</option>
                {pacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </label>
            <div className="min-w-0 space-y-1.5" data-qst-p01-busca>
              <Rotulo htmlFor="busca-respostas">Busca</Rotulo>
              <div className="flex min-w-0 flex-wrap gap-2">
              <Campo
                ref={buscaRef}
                className="min-w-0 flex-1"
                id="busca-respostas"
                value={buscaRespostas}
                onChange={(event) => setBuscaRespostas(event.target.value)}
                placeholder="Paciente, pergunta ou resposta"
              />
              <Botao type="button" disabled={!buscaRespostas} onClick={() => {
                setBuscaRespostas('');
                buscaRef.current?.focus();
              }}>Limpar busca</Botao>
              </div>
            </div>
          </div>

          <div data-qst-p01-contagem>
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-texto-suave">
              {carregandoRespostas ? 'Atualizando envios...' : `${respostasVisiveis.length} ${respostasVisiveis.length === 1 ? 'envio exibido' : 'envios exibidos'}`}
            </p>
            <p className="text-xs text-texto-suave">A contagem considera apenas a lista carregada.</p>
          </div>

          <div data-qst10-leitura>
          <Abas identificador={abasId} abas={[{ id: 'envios', rotulo: 'Envios' }, { id: 'resumo', rotulo: 'Resumo por pergunta' }]} ativaId={aba} aoMudar={id => setVisualizacao({ contexto, aba: id })} rotulo="Visualização das respostas" />
          <div id={`${abasId}-resumo-painel`} role="tabpanel" aria-labelledby={`${abasId}-resumo-aba`} hidden={aba !== 'resumo'} className="space-y-4 pt-3">
            <p className="text-sm font-semibold text-tinta">Resumo da consulta</p>
            <p className="text-xs text-texto-suave">Os totais consideram os envios da consulta. A busca apenas localiza perguntas e respostas.</p>
          {leituraClinica ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-linha bg-superficie p-3">
                <p className="text-xs text-texto-suave">Envios respondidos</p>
                <p className="text-2xl font-semibold text-tinta">{leituraClinica.resumo.totalRespostas}</p>
              </div>
              <div className="rounded-md border border-linha bg-superficie p-3">
                <p className="text-xs text-texto-suave">Pacientes</p>
                <p className="text-2xl font-semibold text-tinta">{leituraClinica.resumo.totalPacientes}</p>
              </div>
              <div className="rounded-md border border-linha bg-superficie p-3">
                <p className="text-xs text-texto-suave">Media por envio</p>
                <p className="text-2xl font-semibold text-tinta">{leituraClinica.resumo.mediaRespostasPorEnvio}</p>
              </div>
              <div className="rounded-md border border-linha bg-superficie p-3">
                <p className="text-xs text-texto-suave">Última resposta</p>
                <p className="text-base font-semibold text-tinta">{formatarDataResposta(leituraClinica.resumo.ultimaRespostaEm)}</p>
              </div>
            </div>
          ) : null}

          {perguntasLeituraFiltradas.length ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {perguntasLeituraFiltradas.map((pergunta) => (
                <article key={pergunta.perguntaId} className="rounded-md border border-linha bg-superficie p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-tinta">{pergunta.enunciado}</p>
                      <p className="text-xs text-texto-suave">{pergunta.totalRespostas} respostas</p>
                    </div>
                    {typeof pergunta.mediaNumerica === 'number' ? (
                      <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                        Media {pergunta.mediaNumerica}
                      </span>
                    ) : null}
                  </div>
                  {typeof pergunta.totalSim === 'number' || typeof pergunta.totalNao === 'number' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <span className="rounded-md border border-linha bg-white px-3 py-2 font-semibold text-sucesso-forte">
                        Sim {pergunta.totalSim ?? 0}
                      </span>
                      <span className="rounded-md border border-linha bg-white px-3 py-2 font-semibold text-perigo">
                        Não {pergunta.totalNao ?? 0}
                      </span>
                    </div>
                  ) : null}
                  {pergunta.distribuicao.length ? (
                    <DistribuicaoRespostas
                      key={JSON.stringify([questionarioAtual?.id, pacienteFiltroRespostas, pergunta.perguntaId])}
                      distribuicao={pergunta.distribuicao} enunciado={pergunta.enunciado}
                    />
                  ) : null}
                  {pergunta.textosRecentes.length ? (
                    <p className="mt-3 line-clamp-2 text-xs text-texto-suave">{pergunta.textosRecentes[0]}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          </div>
          <div id={`${abasId}-envios-painel`} role="tabpanel" aria-labelledby={`${abasId}-envios-aba`} hidden={aba !== 'envios'} className="pt-3">
          <ListaRespostas
            key={`${questionarioAtual?.id ?? ''}:${pacienteFiltroRespostas}`}
            respostasVisiveis={respostasVisiveis}
            pacientesPorId={pacientesPorId}
            buscaRespostas={buscaRespostas}
            carregandoRespostas={carregandoRespostas}
          />
          </div>
          </div>
        </div>
      </Cartao>

      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-texto-suave" />
            <h2 className="text-sm font-semibold text-tinta">Matriz longitudinal</h2>
          </div>
          <Botao type="button" onClick={() => void carregarMatrizLongitudinal()} disabled={carregandoMatriz}>
            <RefreshCcw className="h-4 w-4" />
            {carregandoMatriz ? 'Atualizando matriz' : 'Atualizar matriz'}
          </Botao>
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5">
              <Rotulo htmlFor="matriz-paciente">Paciente</Rotulo>
              <Selecao id="matriz-paciente" value={pacienteFiltroMatriz} onChange={(event) => setPacienteFiltroMatriz(event.target.value)}>
                <option value="">Todos os pacientes</option>
                {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
              </Selecao>
            </label>
            <label className="space-y-1.5">
              <Rotulo htmlFor="matriz-questionario">Questionário</Rotulo>
              <Selecao id="matriz-questionario" value={questionarioFiltroMatriz} onChange={(event) => setQuestionarioFiltroMatriz(event.target.value)}>
                <option value="">Todos os questionários</option>
                {questionarios.map((questionario) => <option key={questionario.id} value={questionario.id}>{questionario.titulo}</option>)}
              </Selecao>
            </label>
            <label className="space-y-1.5">
              <Rotulo htmlFor="matriz-categoria">Categoria</Rotulo>
              <Selecao id="matriz-categoria" value={categoriaFiltroMatriz} onChange={(event) => setCategoriaFiltroMatriz(event.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
              </Selecao>
            </label>
            <label className="space-y-1.5">
              <Rotulo htmlFor="matriz-inicio">De</Rotulo>
              <Campo id="matriz-inicio" type="date" value={inicioFiltroMatriz} onChange={(event) => setInicioFiltroMatriz(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <Rotulo htmlFor="matriz-fim">Até</Rotulo>
              <Campo id="matriz-fim" type="date" value={fimFiltroMatriz} onChange={(event) => setFimFiltroMatriz(event.target.value)} />
            </label>
          </div>

          {matrizLongitudinal ? (
            <>
              <p className="text-sm text-texto-suave">
                {matrizLongitudinal.resumo.totalIndicadores} indicadores comparaveis em {matrizLongitudinal.resumo.totalRespostas} respostas.
              </p>
              {matrizLongitudinal.indicadores.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {matrizLongitudinal.indicadores.map((indicador) => {
                    const paciente = pacientesPorId.get(indicador.pacienteId);
                    return (
                      <article key={`${indicador.pacienteId}-${indicador.questionarioId}-${indicador.perguntaId}`} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-tinta">{indicador.enunciado}</p>
                            <p className="text-xs text-texto-suave">{paciente?.nome ?? 'Paciente'} · {indicador.questionarioTitulo}</p>
                          </div>
                          <span className="text-sm font-semibold text-tinta">
                            {indicador.anterior && typeof indicador.delta === 'number' && Number.isFinite(indicador.delta)
                              ? indicador.delta > 0 ? `Aumentou: +${indicador.delta}`
                                : indicador.delta < 0 ? `Diminuiu: ${indicador.delta}` : 'Sem alteração: 0'
                              : 'Sem comparação'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md border border-linha bg-white px-3 py-2">
                            <p className="text-xs text-texto-suave">Atual</p>
                            <p className="font-semibold text-tinta">{formatarValorResposta(indicador.atual.valor)} {indicador.unidade ?? ''}</p>
                          </div>
                          <div className="rounded-md border border-linha bg-white px-3 py-2">
                            <p className="text-xs text-texto-suave">Anterior</p>
                            <p className="font-semibold text-tinta">{indicador.anterior ? `${formatarValorResposta(indicador.anterior.valor)} ${indicador.unidade ?? ''}` : 'Sem comparacao'}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-texto-suave">Atualizado em {formatarDataResposta(indicador.atual.finalizadoEm)}</p>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-texto-suave">Nenhum indicador numerico comparavel foi encontrado para os filtros atuais.</p>}
            </>
          ) : <p className="text-sm text-texto-suave">Escolha os filtros e atualize para comparar as duas respostas mais recentes de cada indicador.</p>}
        </div>
      </Cartao>
    </>
  );
}
