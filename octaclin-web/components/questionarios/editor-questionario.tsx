'use client';

import { useState } from 'react';
import { closestCenter, DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Archive, BookOpen, CalendarClock, Check, ClipboardList, Copy, Eye, LibraryBig, Link2, Plus, RefreshCcw, Save, Settings2, Trash2, TrendingUp, Wand2 } from 'lucide-react';
import { Abas } from '@/components/ui/abas';
import { Botao } from '@/components/ui/botao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ModalConfirmacao } from '@/components/ui/modal';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso } from '@/components/ui/feedback';
import { TipoPergunta } from '@/lib/questionarios-api';
import { PerguntaOrdenavel } from './pergunta-ordenavel';
import { PreviewQuestionarioPaciente } from './preview-questionario-paciente';
import {
  booleanoConfig,
  formatarDataResposta,
  formatarValorResposta,
  listaTextoConfig,
  numeroConfig,
  textoConfig,
  useWorkspaceQuestionarios
} from './usar-workspace-questionarios';

const tipos: { valor: TipoPergunta; rotulo: string }[] = [
  { valor: 'likert', rotulo: 'Likert 1-5' },
  { valor: 'multipla_escolha', rotulo: 'Multipla escolha' },
  { valor: 'linear', rotulo: 'Slider linear' },
  { valor: 'metrica', rotulo: 'Metrica' },
  { valor: 'upload_midia', rotulo: 'Upload de midia' },
  { valor: 'texto_longo', rotulo: 'Texto aberto' },
  { valor: 'sim_nao', rotulo: 'Sim/Nao' }
];

type AreaQuestionarios = 'montagem' | 'biblioteca' | 'distribuicao' | 'respostas';

const areasQuestionarios: { id: AreaQuestionarios; rotulo: string }[] = [
  { id: 'montagem', rotulo: 'Montagem' },
  { id: 'biblioteca', rotulo: 'Biblioteca' },
  { id: 'distribuicao', rotulo: 'Distribuicao' },
  { id: 'respostas', rotulo: 'Respostas' }
];

export function EditorQuestionario() {
  const workspace = useWorkspaceQuestionarios();
  const {
    categorias, pacientes, questionarios, modelos, questionarioAtual,
    perguntas, buscaBiblioteca, setBuscaBiblioteca,
    categoriaBibliotecaId, setCategoriaBibliotecaId, selecionadaId, setSelecionadaId,
    titulo, setTitulo, descricao, setDescricao, status, setStatus,
    pacienteAgendamentoId, setPacienteAgendamentoId, pacienteEnvioId, setPacienteEnvioId,
    linkFormulario, erro, sucesso, carregando, salvando,
    confirmandoArquivarQuestionario, setConfirmandoArquivarQuestionario,
    previewAberto, setPreviewAberto,
    alteracoesQuestionarioPendentes, alteracoesPerguntaPendentes,
    leituraClinica, carregandoRespostas,
    pacienteFiltroRespostas, setPacienteFiltroRespostas, buscaRespostas, setBuscaRespostas,
    matrizLongitudinal, carregandoMatriz, pacienteFiltroMatriz, setPacienteFiltroMatriz,
    questionarioFiltroMatriz, setQuestionarioFiltroMatriz, categoriaFiltroMatriz, setCategoriaFiltroMatriz,
    inicioFiltroMatriz, setInicioFiltroMatriz, fimFiltroMatriz, setFimFiltroMatriz,
    areaAtiva, setAreaAtiva, sensors, perguntaSelecionada, categoriasPorId, pacientesPorId,
    scoreTotal, perguntasBibliotecaVisiveis, perguntasLeituraFiltradas, respostasVisiveis,
    carregarRespostas, carregarMatrizLongitudinal, selecionarQuestionario, carregar,
    duplicarAtual, criarAPartirModelo, adicionarPergunta, salvarPergunta, agendar,
    arquivarQuestionario, aoFinalizarArraste, atualizarPerguntaLocal, gerarLinkFormulario,
    incluirDaBiblioteca, trocarTipoPergunta, atualizarConfiguracao, atualizarOpcao,
    adicionarOpcao, removerOpcao, salvarQuestionario, setAlteracoesQuestionarioPendentes
  } = workspace;

  const [regraCron, setRegraCron] = useState('0 8 * * 1');

  return (
    <section className="grid gap-4">
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}

      {alteracoesQuestionarioPendentes || alteracoesPerguntaPendentes ? (
        <p className="text-sm text-alerta-forte" role="status">
          Alteracoes pendentes: {alteracoesQuestionarioPendentes ? 'formulario' : ''}
          {alteracoesQuestionarioPendentes && alteracoesPerguntaPendentes ? ' e ' : ''}
          {alteracoesPerguntaPendentes ? 'pergunta selecionada' : ''}. Salve antes de trocar de formulario.
        </p>
      ) : null}

      <Abas identificador="questionarios" abas={areasQuestionarios} ativaId={areaAtiva} aoMudar={(id) => setAreaAtiva(id as AreaQuestionarios)} rotulo="Areas de trabalho dos questionarios" />

      <div id={`questionarios-${areaAtiva}-painel`} role="tabpanel" aria-labelledby={`questionarios-${areaAtiva}-aba`}>

      {areaAtiva === 'montagem' ? <div className="flex justify-end gap-2">
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw className="h-4 w-4" />
          {carregando ? 'Atualizando' : 'Atualizar'}
        </Botao>
        <Botao type="button" onClick={() => setPreviewAberto((valor) => !valor)}>
          <Eye className="h-4 w-4" />
          {previewAberto ? 'Ocultar preview' : 'Preview paciente'}
        </Botao>
        <Botao type="button" onClick={() => void duplicarAtual()} disabled={salvando || !questionarioAtual}>
          <Copy className="h-4 w-4" />
          Duplicar
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          onClick={() => setConfirmandoArquivarQuestionario(true)}
          disabled={salvando || !questionarioAtual || status === 'arquivado'}
        >
          <Archive className="h-4 w-4" />
          Arquivar
        </Botao>
        <Botao variante="primario" onClick={salvarQuestionario} disabled={salvando}>
          <Save className="h-4 w-4" />
          {questionarioAtual ? 'Salvar questionario' : 'Criar questionario'}
        </Botao>
      </div> : null}

      {areaAtiva === 'montagem' && previewAberto ? <PreviewQuestionarioPaciente titulo={titulo} descricao={descricao} perguntas={perguntas} /> : null}

      {areaAtiva === 'biblioteca' ? (
        <Cartao className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <LibraryBig className="h-4 w-4 text-primaria" />
            <h2 className="text-sm font-semibold text-tinta">Biblioteca de perguntas</h2>
          </div>
          <div className="grid gap-3 p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
              <Campo type="search" value={buscaBiblioteca} onChange={(event) => setBuscaBiblioteca(event.target.value)} placeholder="Buscar por enunciado ou chave clinica" aria-label="Buscar na biblioteca de perguntas" />
              <Selecao value={categoriaBibliotecaId} onChange={(event) => setCategoriaBibliotecaId(event.target.value)} aria-label="Filtrar categoria da biblioteca">
                <option value="">Todas as categorias</option>
                {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
              </Selecao>
            </div>
            <p className="text-sm text-texto-suave">Selecione um formulario em Montagem para incluir uma copia independente da pergunta.</p>
            <ul className="grid gap-2">
              {perguntasBibliotecaVisiveis.length ? perguntasBibliotecaVisiveis.map((pergunta) => (
                <li key={pergunta.id} className="flex items-center justify-between gap-3 rounded-md border border-linha bg-white p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-tinta">{pergunta.enunciado}</span>
                    <span className="block truncate text-xs text-texto-suave">{categoriasPorId.get(pergunta.categoriaId)?.nome ?? 'Sem categoria'}{pergunta.chaveClinica ? ` - ${pergunta.chaveClinica}` : ''}</span>
                  </span>
                  <Botao type="button" onClick={() => void incluirDaBiblioteca(pergunta.id)} disabled={salvando || !questionarioAtual} aria-label={`Incluir ${pergunta.enunciado}`}>
                    <Plus className="h-4 w-4" /> Incluir
                  </Botao>
                </li>
              )) : <li className="rounded-md border border-linha p-4 text-sm text-texto-suave">Nenhuma pergunta reutilizavel encontrada.</li>}
            </ul>
          </div>
        </Cartao>
      ) : null}

      {areaAtiva === 'distribuicao' ? (
        <Cartao className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <Link2 className="h-4 w-4 text-primaria" />
            <h2 className="text-sm font-semibold text-tinta">Distribuicao do formulario</h2>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
              <div>
                <p className="text-sm font-semibold text-tinta">Check-in recorrente</p>
                <p className="text-xs text-texto-suave">Agenda um envio para um paciente especifico.</p>
              </div>
              <Selecao value={pacienteAgendamentoId} onChange={(event) => setPacienteAgendamentoId(event.target.value)} aria-label="Paciente do check-in recorrente">
                <option value="">Selecione o paciente</option>
                {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
              </Selecao>
              <div className="flex gap-2">
                <Campo value={regraCron} onChange={(event) => setRegraCron(event.target.value)} aria-label="Regra cron do check-in" />
                <Botao type="button" onClick={() => void agendar({ regraCron })} disabled={salvando || !questionarioAtual} aria-label="Criar check-in recorrente"><CalendarClock className="h-4 w-4" /></Botao>
              </div>
            </div>
            <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
              <div>
                <p className="text-sm font-semibold text-tinta">Envio individual</p>
                <p className="text-xs text-texto-suave">Gera o link publico para uma resposta unica.</p>
              </div>
              <Selecao value={pacienteEnvioId} onChange={(event) => setPacienteEnvioId(event.target.value)} aria-label="Paciente do envio individual">
                <option value="">Selecione o paciente</option>
                {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
              </Selecao>
              <Botao type="button" onClick={() => void gerarLinkFormulario()} disabled={salvando || !questionarioAtual}><Link2 className="h-4 w-4" /> Gerar link</Botao>
              {linkFormulario ? <Campo readOnly value={linkFormulario} onFocus={(event) => event.currentTarget.select()} aria-label="Link publico do formulario" /> : null}
            </div>
          </div>
        </Cartao>
      ) : null}

      {areaAtiva === 'montagem' ? <section className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(420px,1fr)_360px]">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Questionario</CartaoTitulo>
            <div className="flex items-center gap-2">
              <span className="text-xs text-texto-suave">Versao {questionarioAtual?.versao ?? 1}</span>
              <Etiqueta variante={status === 'publicado' ? 'sucesso' : status === 'arquivado' ? 'neutra' : 'alerta'}>{status}</Etiqueta>
            </div>
          </CartaoCabecalho>
          <CartaoConteudo className="space-y-4">
            <div className="space-y-1.5">
              <Rotulo htmlFor="questionario">Selecionar</Rotulo>
              <Selecao
                id="questionario"
                value={questionarioAtual?.id ?? ''}
                onChange={(event) => {
                  const escolhido = questionarios.find((item) => item.id === event.target.value);
                  if (escolhido) void selecionarQuestionario(escolhido);
                }}
              >
                <option value="">Novo questionario</option>
                {questionarios.map((questionario) => (
                  <option key={questionario.id} value={questionario.id}>
                    {questionario.titulo}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-2 rounded-md border border-linha bg-superficie p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-texto-suave" />
                <p className="text-sm font-semibold text-tinta">Modelos</p>
              </div>
              <div className="grid gap-2">
                {modelos.map((modelo) => (
                  <button
                    key={modelo.id}
                    type="button"
                    onClick={() => void criarAPartirModelo(modelo)}
                    disabled={salvando}
                    className="grid gap-1 rounded-md border border-linha bg-white p-3 text-left transition-colors hover:bg-superficie-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-tinta">{modelo.titulo}</span>
                      <Wand2 className="h-4 w-4 shrink-0 text-primaria" />
                    </span>
                    <span className="text-xs text-texto-suave">{modelo.totalPerguntas} perguntas - {modelo.estimativaMinutos} min</span>
                    <span className="line-clamp-2 text-xs text-texto-suave">{modelo.objetivo}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="titulo">Titulo</Rotulo>
              <Campo id="titulo" value={titulo} onChange={(event) => { setTitulo(event.target.value); setAlteracoesQuestionarioPendentes(true); }} />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="descricao">Descricao</Rotulo>
              <AreaTexto id="descricao" value={descricao} onChange={(event) => { setDescricao(event.target.value); setAlteracoesQuestionarioPendentes(true); }} />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="status">Status</Rotulo>
              <Selecao
                id="status"
                value={status}
                onChange={(event) => { setStatus(event.target.value as 'rascunho' | 'publicado' | 'arquivado'); setAlteracoesQuestionarioPendentes(true); }}
              >
                <option value="rascunho">Rascunho</option>
                <option value="publicado">Publicado</option>
                <option value="arquivado">Arquivado</option>
              </Selecao>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-linha bg-fundo p-3">
                <p className="text-xs text-texto-suave">Perguntas</p>
                <p className="text-2xl font-semibold text-tinta">{perguntas.length}</p>
              </div>
              <div className="rounded-md border border-linha bg-fundo p-3">
                <p className="text-xs text-texto-suave">Peso total</p>
                <p className="text-2xl font-semibold text-tinta">{scoreTotal}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="cron">Cron</Rotulo>
              <div className="grid gap-2">
                <Selecao
                  id="paciente-agendamento"
                  value={pacienteAgendamentoId}
                  onChange={(event) => setPacienteAgendamentoId(event.target.value)}
                  aria-label="Paciente do check-in recorrente"
                >
                  <option value="">Selecione o paciente</option>
                  {pacientes.map((paciente) => (
                    <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>
                  ))}
                </Selecao>
                <div className="flex gap-2">
                  <Campo id="cron" value={regraCron} onChange={(event) => setRegraCron(event.target.value)} />
                  <Botao type="button" aria-label="Criar check-in recorrente" onClick={() => void agendar({ regraCron })} disabled={salvando}>
                  <CalendarClock className="h-4 w-4" />
                  </Botao>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-md border border-linha bg-superficie p-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-texto-suave" />
                <p className="text-sm font-semibold text-tinta">Envio ao paciente</p>
              </div>
              <div className="space-y-1.5">
                <Rotulo htmlFor="paciente-envio">Paciente</Rotulo>
                <Selecao id="paciente-envio" value={pacienteEnvioId} onChange={(event) => setPacienteEnvioId(event.target.value)}>
                  <option value="">Selecione</option>
                  {pacientes.map((paciente) => (
                    <option key={paciente.id} value={paciente.id}>
                      {paciente.nome}
                    </option>
                  ))}
                </Selecao>
              </div>
              <Botao type="button" className="w-full" onClick={() => void gerarLinkFormulario()} disabled={salvando || !questionarioAtual}>
                <Link2 className="h-4 w-4" />
                Gerar link
              </Botao>
              {linkFormulario ? (
                <Campo readOnly value={linkFormulario} onFocus={(event) => event.currentTarget.select()} aria-label="Link publico do formulario" />
              ) : null}
            </div>
          </CartaoConteudo>
        </Cartao>

        <Cartao className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-linha px-4 py-3">
            <h2 className="text-sm font-semibold text-tinta">Perguntas</h2>
            <Botao variante="primario" onClick={adicionarPergunta} disabled={salvando || !questionarioAtual}>
              <Plus className="h-4 w-4" />
              Nova
            </Botao>
          </div>
          <details className="border-b border-linha bg-superficie px-4 py-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-tinta">
              <LibraryBig className="h-4 w-4 text-primaria" />
              Biblioteca de perguntas
            </summary>
            <div className="mt-3 grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <Campo
                  type="search"
                  value={buscaBiblioteca}
                  onChange={(event) => setBuscaBiblioteca(event.target.value)}
                  placeholder="Buscar por enunciado ou chave clinica"
                  aria-label="Buscar na biblioteca de perguntas"
                />
                <Selecao
                  value={categoriaBibliotecaId}
                  onChange={(event) => setCategoriaBibliotecaId(event.target.value)}
                  aria-label="Filtrar categoria da biblioteca"
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                  ))}
                </Selecao>
              </div>
              <ul className="grid gap-2">
                {perguntasBibliotecaVisiveis.length ? perguntasBibliotecaVisiveis.map((pergunta) => (
                  <li key={pergunta.id} className="flex items-center justify-between gap-3 rounded-md border border-linha bg-white px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-tinta">{pergunta.enunciado}</span>
                      <span className="block truncate text-xs text-texto-suave">
                        {categoriasPorId.get(pergunta.categoriaId)?.nome ?? 'Sem categoria'}
                        {pergunta.chaveClinica ? ` - ${pergunta.chaveClinica}` : ''}
                      </span>
                    </span>
                    <Botao
                      type="button"
                      aria-label={`Incluir ${pergunta.enunciado}`}
                      onClick={() => void incluirDaBiblioteca(pergunta.id)}
                      disabled={salvando || !questionarioAtual}
                    >
                      <Plus className="h-4 w-4" />
                      Incluir
                    </Botao>
                  </li>
                )) : <li className="py-2 text-sm text-texto-suave">Nenhuma pergunta reutilizavel encontrada.</li>}
              </ul>
            </div>
          </details>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoFinalizarArraste}>
            <SortableContext items={perguntas.map((pergunta) => pergunta.id)} strategy={verticalListSortingStrategy}>
              <ul className="max-h-[calc(100vh-230px)] overflow-auto">
                {perguntas.length ? (
                  perguntas.map((pergunta) => {
                    const categoria = categoriasPorId.get(pergunta.categoriaId) ?? categorias[0];
                    return (
                      <PerguntaOrdenavel
                        key={pergunta.id}
                        pergunta={pergunta}
                        selecionada={pergunta.id === selecionadaId}
                        categoriaNome={categoria?.nome ?? 'Categoria'}
                        categoriaCor={categoria?.corHex ?? '#247BA0'}
                        aoSelecionar={setSelecionadaId}
                      />
                    );
                  })
                ) : (
                  <li className="px-4 py-8 text-sm text-texto-suave">Nenhuma pergunta carregada.</li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo icone={<Settings2 className="h-4 w-4" />}>Propriedades</CartaoTitulo>
          </CartaoCabecalho>
          {perguntaSelecionada ? (
            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Rotulo htmlFor="enunciado">Enunciado</Rotulo>
                <AreaTexto
                  id="enunciado"
                  value={perguntaSelecionada.enunciado}
                  onChange={(event) => atualizarPerguntaLocal('enunciado', event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Rotulo htmlFor="tipo">Tipo</Rotulo>
                  <Selecao
                    id="tipo"
                    value={perguntaSelecionada.tipo}
                    onChange={(event) => trocarTipoPergunta(event.target.value as TipoPergunta)}
                  >
                    {tipos.map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.rotulo}
                      </option>
                    ))}
                  </Selecao>
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="peso">Peso</Rotulo>
                  <Campo
                    id="peso"
                    type="number"
                    min={0}
                    max={100}
                    value={perguntaSelecionada.peso}
                    onChange={(event) => atualizarPerguntaLocal('peso', Number(event.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Rotulo htmlFor="categoria">Categoria</Rotulo>
                <Selecao
                  id="categoria"
                  value={perguntaSelecionada.categoriaId}
                  onChange={(event) => atualizarPerguntaLocal('categoriaId', event.target.value)}
                >
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div className="space-y-1.5">
                <Rotulo htmlFor="chave-clinica">Chave clinica</Rotulo>
                <Campo
                  id="chave-clinica"
                  value={perguntaSelecionada.chaveClinica ?? ''}
                  onChange={(event) => atualizarPerguntaLocal('chaveClinica', event.target.value)}
                  placeholder="Ex.: adesao-semanal"
                />
              </div>
              <div className="space-y-1.5">
                <Rotulo htmlFor="secao">Secao</Rotulo>
                <Campo
                  id="secao"
                  value={textoConfig(perguntaSelecionada.configuracao, 'secao', 'Sem secao')}
                  onChange={(event) => atualizarConfiguracao('secao', event.target.value)}
                />
              </div>
              <label className="flex items-center justify-between rounded-md border border-linha bg-fundo px-3 py-2">
                <span className="text-sm font-medium text-tinta">Obrigatoria</span>
                <input
                  type="checkbox"
                  checked={perguntaSelecionada.obrigatoria}
                  onChange={(event) => atualizarPerguntaLocal('obrigatoria', event.target.checked)}
                  className="h-5 w-5 accent-primaria"
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-linha bg-fundo px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-tinta">Disponivel na biblioteca</span>
                  <span className="block text-xs text-texto-suave">Permite reutilizar uma copia desta pergunta em outros formularios.</span>
                </span>
                <input
                  type="checkbox"
                  checked={perguntaSelecionada.visivelBiblioteca ?? false}
                  onChange={(event) => atualizarPerguntaLocal('visivelBiblioteca', event.target.checked)}
                  className="h-5 w-5 accent-primaria"
                />
              </label>

              <div className="space-y-3 rounded-md border border-linha bg-superficie p-3">
                <div>
                  <p className="text-sm font-semibold text-tinta">Configuracao do tipo</p>
                  <p className="text-xs text-texto-suave">Ajuste como esta pergunta sera respondida pelo paciente.</p>
                </div>

                {perguntaSelecionada.tipo === 'likert' ? (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1.5">
                        <Rotulo>Escala minima</Rotulo>
                        <Campo
                          type="number"
                          value={numeroConfig(perguntaSelecionada.configuracao, 'escalaMin', 1)}
                          onChange={(event) => atualizarConfiguracao('escalaMin', Number(event.target.value))}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <Rotulo>Escala maxima</Rotulo>
                        <Campo
                          type="number"
                          value={numeroConfig(perguntaSelecionada.configuracao, 'escalaMax', 5)}
                          onChange={(event) => atualizarConfiguracao('escalaMax', Number(event.target.value))}
                        />
                      </label>
                    </div>
                    <label className="space-y-1.5">
                      <Rotulo>Rotulo minimo</Rotulo>
                      <Campo
                        value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMin', 'Discordo totalmente')}
                        onChange={(event) => atualizarConfiguracao('rotuloMin', event.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <Rotulo>Rotulo maximo</Rotulo>
                      <Campo
                        value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMax', 'Concordo totalmente')}
                        onChange={(event) => atualizarConfiguracao('rotuloMax', event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                {perguntaSelecionada.tipo === 'multipla_escolha' ? (
                  <div className="grid gap-3">
                    <label className="flex items-center justify-between rounded-md border border-linha bg-white px-3 py-2">
                      <span className="text-sm font-medium text-tinta">Permitir varias respostas</span>
                      <input
                        type="checkbox"
                        checked={booleanoConfig(perguntaSelecionada.configuracao, 'multipla')}
                        onChange={(event) => atualizarConfiguracao('multipla', event.target.checked)}
                        className="h-5 w-5 accent-primaria"
                      />
                    </label>
                    <div className="grid gap-2">
                      {perguntaSelecionada.opcoes.map((opcao, indice) => (
                        <div key={`${opcao.id ?? 'nova'}-${indice}`} className="grid grid-cols-[1fr_1fr_36px] gap-2">
                          <Campo
                            value={opcao.rotulo}
                            aria-label={`Rotulo da opcao ${indice + 1}`}
                            onChange={(event) => atualizarOpcao(indice, 'rotulo', event.target.value)}
                          />
                          <Campo
                            value={opcao.valor}
                            aria-label={`Valor da opcao ${indice + 1}`}
                            onChange={(event) => atualizarOpcao(indice, 'valor', event.target.value)}
                          />
                          <Botao
                            type="button"
                            variante="fantasma"
                            aria-label="Remover opcao"
                            onClick={() => removerOpcao(indice)}
                            disabled={perguntaSelecionada.opcoes.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Botao>
                        </div>
                      ))}
                    </div>
                    <Botao type="button" onClick={adicionarOpcao}>
                      <Plus className="h-4 w-4" />
                      Adicionar opcao
                    </Botao>
                  </div>
                ) : null}

                {perguntaSelecionada.tipo === 'linear' || perguntaSelecionada.tipo === 'metrica' ? (
                  <div className="grid gap-3">
                    {perguntaSelecionada.tipo === 'metrica' ? (
                      <label className="space-y-1.5">
                        <Rotulo>Unidade</Rotulo>
                        <Campo
                          value={textoConfig(perguntaSelecionada.configuracao, 'unidade')}
                          onChange={(event) => atualizarConfiguracao('unidade', event.target.value)}
                        />
                      </label>
                    ) : null}
                    <div className="grid grid-cols-3 gap-2">
                      <label className="space-y-1.5">
                        <Rotulo>Minimo</Rotulo>
                        <Campo
                          type="number"
                          value={numeroConfig(perguntaSelecionada.configuracao, 'minimo', 0)}
                          onChange={(event) => atualizarConfiguracao('minimo', Number(event.target.value))}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <Rotulo>Maximo</Rotulo>
                        <Campo
                          type="number"
                          value={numeroConfig(perguntaSelecionada.configuracao, 'maximo', perguntaSelecionada.tipo === 'linear' ? 10 : 100)}
                          onChange={(event) => atualizarConfiguracao('maximo', Number(event.target.value))}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <Rotulo>Passo</Rotulo>
                        <Campo
                          type="number"
                          step="0.01"
                          value={numeroConfig(perguntaSelecionada.configuracao, 'passo', 1)}
                          onChange={(event) => atualizarConfiguracao('passo', Number(event.target.value))}
                        />
                      </label>
                    </div>
                    {perguntaSelecionada.tipo === 'linear' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1.5">
                          <Rotulo>Rotulo minimo</Rotulo>
                          <Campo
                            value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMin')}
                            onChange={(event) => atualizarConfiguracao('rotuloMin', event.target.value)}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <Rotulo>Rotulo maximo</Rotulo>
                          <Campo
                            value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMax')}
                            onChange={(event) => atualizarConfiguracao('rotuloMax', event.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {perguntaSelecionada.tipo === 'upload_midia' ? (
                  <div className="grid gap-3">
                    <label className="space-y-1.5">
                      <Rotulo>Tipos aceitos</Rotulo>
                      <Campo
                        value={listaTextoConfig(perguntaSelecionada.configuracao, 'tiposAceitos', ['image/*']).join(', ')}
                        onChange={(event) =>
                          atualizarConfiguracao(
                            'tiposAceitos',
                            event.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <Rotulo>Maximo de arquivos</Rotulo>
                      <Campo
                        type="number"
                        min={1}
                        max={10}
                        value={numeroConfig(perguntaSelecionada.configuracao, 'maxArquivos', 1)}
                        onChange={(event) => atualizarConfiguracao('maxArquivos', Number(event.target.value))}
                      />
                    </label>
                  </div>
                ) : null}

                {perguntaSelecionada.tipo === 'texto_longo' ? (
                  <div className="grid gap-3">
                    <label className="space-y-1.5">
                      <Rotulo>Limite de caracteres</Rotulo>
                      <Campo
                        type="number"
                        min={1}
                        max={5000}
                        value={numeroConfig(perguntaSelecionada.configuracao, 'limiteCaracteres', 1000)}
                        onChange={(event) => atualizarConfiguracao('limiteCaracteres', Number(event.target.value))}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <Rotulo>Placeholder</Rotulo>
                      <Campo
                        value={textoConfig(perguntaSelecionada.configuracao, 'placeholder')}
                        onChange={(event) => atualizarConfiguracao('placeholder', event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                {perguntaSelecionada.tipo === 'sim_nao' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1.5">
                      <Rotulo>Rotulo sim</Rotulo>
                      <Campo
                        value={textoConfig(perguntaSelecionada.configuracao, 'rotuloSim', 'Sim')}
                        onChange={(event) => atualizarConfiguracao('rotuloSim', event.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <Rotulo>Rotulo nao</Rotulo>
                      <Campo
                        value={textoConfig(perguntaSelecionada.configuracao, 'rotuloNao', 'Nao')}
                        onChange={(event) => atualizarConfiguracao('rotuloNao', event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <Botao type="button" variante="primario" className="w-full" onClick={salvarPergunta} disabled={salvando}>
                <Save className="h-4 w-4" />
                Salvar pergunta
              </Botao>
              <div className="rounded-md border border-linha bg-sucesso-suave p-3 text-sm text-sucesso-forte">
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4" />
                  Contrato valido
                </div>
                <p className="mt-1 text-xs">Edicoes sao persistidas em `PATCH /questionarios/:id/perguntas/:perguntaId`.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-texto-suave">Selecione ou crie uma pergunta.</div>
          )}
        </Cartao>
      </section> : null}

      {areaAtiva === 'respostas' ? <>
      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-texto-suave" />
            <h2 className="text-sm font-semibold text-tinta">Leitura clinica das respostas</h2>
          </div>
          <Botao
            type="button"
            onClick={() => void carregarRespostas(questionarioAtual?.id, pacienteFiltroRespostas)}
            disabled={carregandoRespostas || !questionarioAtual}
          >
            <RefreshCcw className="h-4 w-4" />
            {carregandoRespostas ? 'Atualizando respostas' : 'Atualizar respostas'}
          </Botao>
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
                <p className="text-xs text-texto-suave">Ultima resposta</p>
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
                        Nao {pergunta.totalNao ?? 0}
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
              <Rotulo htmlFor="matriz-fim">Ate</Rotulo>
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
      </> : null}

      <ModalConfirmacao
        aberto={confirmandoArquivarQuestionario}
        titulo="Arquivar questionario"
        mensagem={questionarioAtual ? `Arquivar o questionario ${questionarioAtual.titulo}?` : ''}
        rotuloConfirmar="Arquivar"
        confirmando={salvando}
        aoConfirmar={() => void arquivarQuestionario()}
        aoCancelar={() => setConfirmandoArquivarQuestionario(false)}
      />
      </div>
    </section>
  );
}
