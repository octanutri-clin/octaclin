'use client';

import { ClipboardList, Download, RefreshCcw, TrendingUp } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { formatarDataResposta, formatarValorResposta } from './usar-workspace-questionarios';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

export function AreaRespostas({ workspace }: { workspace: WorkspaceQuestionarios }) {
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
              <a
                href={`/api/questionarios/${questionarioAtual.id}/respostas/exportar.csv`}
                className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-linha bg-superficie px-3 text-sm font-medium text-texto-forte hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </a>
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
            <label className="space-y-1.5">
              <Rotulo htmlFor="busca-respostas">Busca</Rotulo>
              <Campo
                id="busca-respostas"
                value={buscaRespostas}
                onChange={(event) => setBuscaRespostas(event.target.value)}
                placeholder="Paciente, pergunta ou resposta"
              />
            </label>
          </div>

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
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pergunta.distribuicao.slice(0, 4).map((item) => (
                        <span key={`${pergunta.perguntaId}-${item.valor}`} className="rounded-full border border-linha bg-white px-2 py-1 text-xs text-texto-suave">
                          {item.valor}: {item.total}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {pergunta.textosRecentes.length ? (
                    <p className="mt-3 line-clamp-2 text-xs text-texto-suave">{pergunta.textosRecentes[0]}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {respostasVisiveis.length ? (
            <div className="grid gap-3">
              {respostasVisiveis.map((resposta) => {
                const paciente = pacientesPorId.get(resposta.pacienteId);
                return (
                  <article key={resposta.respostaId} className="rounded-md border border-linha bg-superficie p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-tinta">{paciente?.nome ?? 'Paciente nao identificado'}</p>
                        <p className="text-xs text-texto-suave">Finalizado em {formatarDataResposta(resposta.finalizadoEm)}</p>
                      </div>
                      <span className="rounded-full border border-linha bg-white px-3 py-1 text-xs font-semibold text-texto-suave">
                        {resposta.totalRespostas} respostas
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-2 md:grid-cols-2">
                      {resposta.respostas.map((item) => (
                        <div key={`${resposta.respostaId}-${item.perguntaId}`} className="rounded-md border border-linha bg-white p-3">
                          <dt className="text-xs font-medium text-texto-suave">{item.enunciado}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-tinta">{formatarValorResposta(item.valor)}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-2 text-sm text-texto-suave">
              {carregandoRespostas ? 'Carregando respostas.' : 'Nenhuma resposta encontrada para os filtros atuais.'}
            </div>
          )}
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
              <Rotulo htmlFor="matriz-questionario">Questionario</Rotulo>
              <Selecao id="matriz-questionario" value={questionarioFiltroMatriz} onChange={(event) => setQuestionarioFiltroMatriz(event.target.value)}>
                <option value="">Todos os questionarios</option>
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
                          {typeof indicador.delta === 'number' ? (
                            <span className={indicador.delta >= 0 ? 'text-sm font-semibold text-sucesso-forte' : 'text-sm font-semibold text-perigo'}>
                              {indicador.delta >= 0 ? '+' : ''}{indicador.delta}
                            </span>
                          ) : null}
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
