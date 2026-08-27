'use client';

import { Archive, BookOpen, Copy, RefreshCcw, Save, Search, Wand2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ModalConfirmacao } from '@/components/ui/modal';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

export function AreaFormularios({ workspace }: { workspace: WorkspaceQuestionarios }) {
  const {
    carregando, carregar, salvando, duplicarAtual, questionarioAtual, status,
    setConfirmandoArquivarQuestionario, salvarQuestionario,
    questionarios, selecionarQuestionario, modelos, criarAPartirModelo,
    buscaQuestionarios, setBuscaQuestionarios, paginaQuestionarios, totalQuestionarios, carregarPaginaQuestionarios,
    titulo, setTitulo, setAlteracoesQuestionarioPendentes,
    descricao, setDescricao, setStatus, perguntas, scoreTotal,
    confirmandoArquivarQuestionario, arquivarQuestionario
  } = workspace;
  const totalPaginas = Math.max(1, Math.ceil(totalQuestionarios / 25));

  return (
    <div className="grid gap-4">
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw className="h-4 w-4" />
          {carregando ? 'Atualizando' : 'Atualizar'}
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
          {questionarioAtual ? 'Salvar questionário' : 'Criar questionário'}
        </Botao>
      </div>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Questionário</CartaoTitulo>
          <div className="flex items-center gap-2">
            <span className="text-xs text-texto-suave">Versão {questionarioAtual?.versao ?? 1}</span>
            <Etiqueta variante={status === 'publicado' ? 'sucesso' : status === 'arquivado' ? 'neutra' : 'alerta'}>{status}</Etiqueta>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-4">
          <div className="space-y-1.5">
            <Rotulo htmlFor="busca-questionario">Buscar formulário</Rotulo>
            <div className="flex gap-2">
              <Campo
                id="busca-questionario"
                value={buscaQuestionarios}
                onChange={(event) => setBuscaQuestionarios(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void carregarPaginaQuestionarios(1);
                  }
                }}
                placeholder="Título do formulário"
              />
              <Botao type="button" variante="secundario" onClick={() => void carregarPaginaQuestionarios(1)} disabled={carregando} aria-label="Buscar formulários">
                <Search className="h-4 w-4" />
              </Botao>
            </div>
          </div>
          <div className="space-y-1.5">
            <Rotulo htmlFor="questionario">Selecionar</Rotulo>
            <Selecao
              id="questionario"
              value={questionarioAtual?.id ?? ''}
              onChange={(event) => {
                const escolhido = questionarios.find((item) => item.id === event.target.value);
                void selecionarQuestionario(escolhido ?? null);
              }}
            >
              <option value="">Novo questionário</option>
              {questionarios.map((questionario) => (
                <option key={questionario.id} value={questionario.id}>{questionario.titulo}</option>
              ))}
            </Selecao>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-texto-suave">Página {paginaQuestionarios} de {totalPaginas} | {totalQuestionarios} formulários</span>
              <div className="flex gap-2">
                <Botao type="button" variante="fantasma" onClick={() => void carregarPaginaQuestionarios(Math.max(1, paginaQuestionarios - 1))} disabled={carregando || paginaQuestionarios <= 1}>Anterior</Botao>
                <Botao type="button" variante="fantasma" onClick={() => void carregarPaginaQuestionarios(Math.min(totalPaginas, paginaQuestionarios + 1))} disabled={carregando || paginaQuestionarios >= totalPaginas}>Próxima</Botao>
              </div>
            </div>
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
            <Rotulo htmlFor="titulo">Título</Rotulo>
            <Campo id="titulo" value={titulo} onChange={(event) => { setTitulo(event.target.value); setAlteracoesQuestionarioPendentes(true); }} />
          </div>
          <div className="space-y-1.5">
            <Rotulo htmlFor="descricao">Descrição</Rotulo>
            <AreaTexto id="descricao" value={descricao} onChange={(event) => { setDescricao(event.target.value); setAlteracoesQuestionarioPendentes(true); }} />
          </div>
          <div className="space-y-1.5">
            <Rotulo htmlFor="status">Situação</Rotulo>
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
        </CartaoConteudo>
      </Cartao>

      <ModalConfirmacao
        aberto={confirmandoArquivarQuestionario}
        titulo="Arquivar questionário"
        mensagem={questionarioAtual ? `Arquivar o questionario ${questionarioAtual.titulo}?` : ''}
        rotuloConfirmar="Arquivar"
        confirmando={salvando}
        aoConfirmar={() => void arquivarQuestionario()}
        aoCancelar={() => setConfirmandoArquivarQuestionario(false)}
      />
    </div>
  );
}
