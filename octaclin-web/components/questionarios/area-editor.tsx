'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Check, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { TipoPergunta } from '@/lib/questionarios-api';
import { PerguntaOrdenavel } from './pergunta-ordenavel';
import { PreviewQuestionarioPaciente } from './preview-questionario-paciente';
import {
  booleanoConfig,
  listaTextoConfig,
  numeroConfig,
  textoConfig
} from './usar-workspace-questionarios';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

const tipos: { valor: TipoPergunta; rotulo: string }[] = [
  { valor: 'likert', rotulo: 'Likert 1-5' },
  { valor: 'multipla_escolha', rotulo: 'Multipla escolha' },
  { valor: 'linear', rotulo: 'Slider linear' },
  { valor: 'metrica', rotulo: 'Metrica' },
  { valor: 'upload_midia', rotulo: 'Upload de midia' },
  { valor: 'texto_longo', rotulo: 'Texto aberto' },
  { valor: 'sim_nao', rotulo: 'Sim/Não' }
];

export function AreaEditor({ workspace }: { workspace: WorkspaceQuestionarios }) {
  const {
    perguntas, questionarioAtual, salvando, adicionarPergunta, aoFinalizarArraste,
    categoriasPorId, categorias, selecionadaId, setSelecionadaId, perguntaSelecionada,
    atualizarPerguntaLocal, trocarTipoPergunta, atualizarConfiguracao, atualizarOpcao,
    adicionarOpcao, removerOpcao, salvarPergunta, titulo, descricao
  } = workspace;
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)_minmax(360px,1fr)]">
      <Cartao className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-linha px-4 py-3">
          <h2 className="text-sm font-semibold text-tinta">Perguntas</h2>
          <Botao variante="primario" onClick={adicionarPergunta} disabled={salvando || !questionarioAtual}>
            <Plus className="h-4 w-4" />
            Nova
          </Botao>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoFinalizarArraste}>
          <SortableContext items={perguntas.map((pergunta) => pergunta.id)} strategy={verticalListSortingStrategy}>
            <ul className="max-h-[calc(100vh-230px)] overflow-auto">
              {perguntas.length ? perguntas.map((pergunta) => {
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
              }) : <li className="px-4 py-8 text-sm text-texto-suave">Nenhuma pergunta carregada.</li>}
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
              <Rotulo htmlFor="chave-clinica">Chave clínica</Rotulo>
              <Campo
                id="chave-clinica"
                value={perguntaSelecionada.chaveClinica ?? ''}
                onChange={(event) => atualizarPerguntaLocal('chaveClinica', event.target.value)}
                placeholder="Ex.: adesão-semanal"
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="secao">Seção</Rotulo>
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
                <span className="block text-sm font-medium text-tinta">Disponível na biblioteca</span>
                <span className="block text-xs text-texto-suave">Permite reutilizar uma cópia desta pergunta em outros formulários.</span>
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
                <p className="text-sm font-semibold text-tinta">Configuração do tipo</p>
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
                    <Rotulo>Rótulo minimo</Rotulo>
                    <Campo
                      value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMin', 'Discordo totalmente')}
                      onChange={(event) => atualizarConfiguracao('rotuloMin', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <Rotulo>Rótulo maximo</Rotulo>
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
                          aria-label="Remover opção"
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
                    Adicionar opção
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
                        <Rotulo>Rótulo minimo</Rotulo>
                        <Campo
                          value={textoConfig(perguntaSelecionada.configuracao, 'rotuloMin')}
                          onChange={(event) => atualizarConfiguracao('rotuloMin', event.target.value)}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <Rotulo>Rótulo maximo</Rotulo>
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
                    <Rotulo>Rótulo sim</Rotulo>
                    <Campo
                      value={textoConfig(perguntaSelecionada.configuracao, 'rotuloSim', 'Sim')}
                      onChange={(event) => atualizarConfiguracao('rotuloSim', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <Rotulo>Rótulo não</Rotulo>
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
                Contrato válido
              </div>
              <p className="mt-1 text-xs">Edicoes sao persistidas em `PATCH /questionarios/:id/perguntas/:perguntaId`.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-texto-suave">Selecione ou crie uma pergunta.</div>
        )}
      </Cartao>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <PreviewQuestionarioPaciente titulo={titulo} descricao={descricao} perguntas={perguntas} />
      </div>
    </div>
  );
}
