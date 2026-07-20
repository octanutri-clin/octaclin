'use client';

import { useEffect, useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertTriangle, Archive, CalendarClock, Check, CheckCircle2, Eye, Plus, RefreshCcw, Save, Settings2, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import {
  CategoriaPerguntaApi,
  PerguntaApi,
  QuestionarioApi,
  TipoPergunta,
  atualizarPergunta,
  atualizarQuestionario,
  carregarBootstrapQuestionarios,
  criarAgendamentoQuestionario,
  criarPergunta,
  criarQuestionario,
  listarPerguntas,
  reordenarPerguntas
} from '@/lib/questionarios-api';
import { ProfissionalResumo } from '@/lib/cadastros-api';
import { PerguntaOrdenavel } from './pergunta-ordenavel';
import { PreviewQuestionarioPaciente } from './preview-questionario-paciente';
import { PerguntaEditor } from './tipos';

const tipos: { valor: TipoPergunta; rotulo: string }[] = [
  { valor: 'likert', rotulo: 'Likert 1-5' },
  { valor: 'multipla_escolha', rotulo: 'Multipla escolha' },
  { valor: 'linear', rotulo: 'Slider linear' },
  { valor: 'metrica', rotulo: 'Metrica' },
  { valor: 'upload_midia', rotulo: 'Upload de midia' },
  { valor: 'texto_longo', rotulo: 'Texto aberto' },
  { valor: 'sim_nao', rotulo: 'Sim/Nao' }
];

function mapearPergunta(pergunta: PerguntaApi): PerguntaEditor {
  return {
    id: pergunta.id,
    tipo: pergunta.tipo,
    categoriaId: pergunta.categoriaId,
    enunciado: pergunta.enunciado,
    peso: Number(pergunta.peso),
    obrigatoria: pergunta.obrigatoria,
    configuracao: pergunta.configuracao ?? configuracaoPadrao(pergunta.tipo),
    opcoes: (pergunta.opcoes ?? []).map((opcao) => ({
      id: opcao.id,
      rotulo: opcao.rotulo,
      valor: opcao.valor,
      imagemUrl: opcao.imagemUrl,
      ordem: opcao.ordem
    })),
    ordem: pergunta.ordem
  };
}

function categoriaFallback(categorias: CategoriaPerguntaApi[]): CategoriaPerguntaApi {
  return categorias[0] ?? { id: '', tenantId: '', nome: 'Categoria', iconeSvg: '', corHex: '#247BA0', ordem: 0 };
}

function configuracaoPadrao(tipo: TipoPergunta): Record<string, unknown> {
  if (tipo === 'likert') {
    return { escalaMin: 1, escalaMax: 5, rotuloMin: 'Discordo totalmente', rotuloMax: 'Concordo totalmente' };
  }
  if (tipo === 'multipla_escolha') return { multipla: false };
  if (tipo === 'linear') return { minimo: 0, maximo: 10, passo: 1, rotuloMin: '', rotuloMax: '' };
  if (tipo === 'metrica') return { unidade: '', minimo: 0, maximo: 100, passo: 1 };
  if (tipo === 'upload_midia') return { tiposAceitos: ['image/*'], maxArquivos: 1 };
  if (tipo === 'texto_longo') return { limiteCaracteres: 1000, placeholder: '' };
  return { rotuloSim: 'Sim', rotuloNao: 'Nao' };
}

function opcoesPadraoMultipla() {
  return [
    { rotulo: 'Opcao 1', valor: 'opcao_1', ordem: 1 },
    { rotulo: 'Opcao 2', valor: 'opcao_2', ordem: 2 }
  ];
}

function textoConfig(configuracao: Record<string, unknown>, chave: string, padrao = '') {
  const valor = configuracao[chave];
  return typeof valor === 'string' ? valor : padrao;
}

function numeroConfig(configuracao: Record<string, unknown>, chave: string, padrao: number) {
  const valor = Number(configuracao[chave]);
  return Number.isFinite(valor) ? valor : padrao;
}

function booleanoConfig(configuracao: Record<string, unknown>, chave: string, padrao = false) {
  return typeof configuracao[chave] === 'boolean' ? Boolean(configuracao[chave]) : padrao;
}

function listaTextoConfig(configuracao: Record<string, unknown>, chave: string, padrao: string[]) {
  const valor = configuracao[chave];
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : padrao;
}

export function EditorQuestionario() {
  const [categorias, setCategorias] = useState<CategoriaPerguntaApi[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [questionarios, setQuestionarios] = useState<QuestionarioApi[]>([]);
  const [questionarioAtual, setQuestionarioAtual] = useState<QuestionarioApi | null>(null);
  const [perguntas, setPerguntas] = useState<PerguntaEditor[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('Check-in semanal de adesao');
  const [descricao, setDescricao] = useState('Protocolo operacional de acompanhamento clinico.');
  const [status, setStatus] = useState<'rascunho' | 'publicado' | 'arquivado'>('rascunho');
  const [regraCron, setRegraCron] = useState('0 8 * * 1');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const perguntaSelecionada = perguntas.find((pergunta) => pergunta.id === selecionadaId) ?? perguntas[0];
  const categoriasPorId = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria])), [categorias]);
  const scoreTotal = perguntas.reduce((total, pergunta) => total + pergunta.peso, 0);

  async function carregarPerguntas(questionarioId: string) {
    const resposta = await listarPerguntas(questionarioId);
    const mapeadas = resposta.map(mapearPergunta);
    setPerguntas(mapeadas);
    setSelecionadaId(mapeadas[0]?.id ?? null);
  }

  async function selecionarQuestionario(questionario: QuestionarioApi) {
    setQuestionarioAtual(questionario);
    setTitulo(questionario.titulo);
    setDescricao(questionario.descricao ?? '');
    setStatus(questionario.status);
    await carregarPerguntas(questionario.id);
  }

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapQuestionarios();
      setCategorias(bootstrap.categorias);
      setProfissionais(bootstrap.profissionais);
      setQuestionarios(bootstrap.questionarios.itens);

      const primeiro = bootstrap.questionarios.itens[0];
      if (primeiro) {
        await selecionarQuestionario(primeiro);
      } else {
        setQuestionarioAtual(null);
        setPerguntas([]);
        setSelecionadaId(null);
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar questionarios.');
    } finally {
      setCarregando(false);
    }
  }

  async function criarNovoQuestionario() {
    const profissionalId = profissionais[0]?.id;
    if (!profissionalId) {
      setErro('Cadastre um profissional antes de criar questionarios.');
      setSucesso(null);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarQuestionario({ profissionalId, titulo, descricao });
      const atualizados = [criado, ...questionarios];
      setQuestionarios(atualizados);
      await selecionarQuestionario(criado);
      setSucesso('Questionario criado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar questionario.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarQuestionario() {
    if (!questionarioAtual) {
      await criarNovoQuestionario();
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizado = await atualizarQuestionario(questionarioAtual.id, { titulo, descricao, status });
      setQuestionarioAtual(atualizado);
      setQuestionarios((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setSucesso('Questionario salvo.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar questionario.');
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarPergunta() {
    if (!questionarioAtual) {
      setErro('Crie um questionario antes de adicionar perguntas.');
      setSucesso(null);
      return;
    }

    const categoria = categoriaFallback(categorias);
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criada = await criarPergunta(questionarioAtual.id, {
        categoriaId: categoria.id,
        tipo: 'likert',
        enunciado: 'Nova pergunta',
        peso: 1,
        obrigatoria: true,
        configuracao: configuracaoPadrao('likert')
      });
      const mapeada = mapearPergunta(criada);
      setPerguntas((atuais) => [...atuais, mapeada]);
      setSelecionadaId(mapeada.id);
      setSucesso('Pergunta criada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar pergunta.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarPergunta() {
    if (!questionarioAtual || !perguntaSelecionada) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizada = await atualizarPergunta(questionarioAtual.id, perguntaSelecionada.id, {
        categoriaId: perguntaSelecionada.categoriaId,
        tipo: perguntaSelecionada.tipo,
        enunciado: perguntaSelecionada.enunciado,
        peso: perguntaSelecionada.peso,
        obrigatoria: perguntaSelecionada.obrigatoria,
        configuracao: perguntaSelecionada.configuracao,
        opcoes:
          perguntaSelecionada.tipo === 'multipla_escolha'
            ? perguntaSelecionada.opcoes.map((opcao) => ({
                rotulo: opcao.rotulo,
                valor: opcao.valor,
                imagemUrl: opcao.imagemUrl
              }))
            : []
      });
      setPerguntas((atuais) => atuais.map((pergunta) => (pergunta.id === atualizada.id ? mapearPergunta(atualizada) : pergunta)));
      setSucesso('Pergunta salva.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar pergunta.');
    } finally {
      setSalvando(false);
    }
  }

  async function agendar() {
    if (!questionarioAtual) {
      setErro('Crie um questionario antes de agendar.');
      setSucesso(null);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarAgendamentoQuestionario({
        questionarioId: questionarioAtual.id,
        regraCron,
        timezone: 'America/Sao_Paulo'
      });
      setSucesso('Agendamento criado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar agendamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function arquivarQuestionario() {
    if (!questionarioAtual) return;

    const confirmado = window.confirm(`Arquivar o questionario ${questionarioAtual.titulo}?`);
    if (!confirmado) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizado = await atualizarQuestionario(questionarioAtual.id, { titulo, descricao, status: 'arquivado' });
      setStatus('arquivado');
      setQuestionarioAtual(atualizado);
      setQuestionarios((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setSucesso('Questionario arquivado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao arquivar questionario.');
    } finally {
      setSalvando(false);
    }
  }

  async function aoFinalizarArraste(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !questionarioAtual) return;

    const reordenadas = arrayMove(
      perguntas,
      perguntas.findIndex((pergunta) => pergunta.id === active.id),
      perguntas.findIndex((pergunta) => pergunta.id === over.id)
    ).map((pergunta, indice) => ({ ...pergunta, ordem: indice + 1 }));

    setPerguntas(reordenadas);
    setErro(null);
    setSucesso(null);
    try {
      const persistidas = await reordenarPerguntas(
        questionarioAtual.id,
        reordenadas.map((pergunta) => ({ id: pergunta.id, ordem: pergunta.ordem }))
      );
      setPerguntas(persistidas.map(mapearPergunta));
      setSucesso('Ordem salva.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reordenar perguntas.');
      await carregarPerguntas(questionarioAtual.id);
    }
  }

  function atualizarPerguntaLocal(campo: keyof PerguntaEditor, valor: string | number | boolean) {
    setPerguntas((atuais) =>
      atuais.map((pergunta) => (pergunta.id === selecionadaId ? { ...pergunta, [campo]: valor } : pergunta))
    );
  }

  function trocarTipoPergunta(tipo: TipoPergunta) {
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId
          ? {
              ...pergunta,
              tipo,
              configuracao: configuracaoPadrao(tipo),
              opcoes: tipo === 'multipla_escolha' ? pergunta.opcoes.length >= 2 ? pergunta.opcoes : opcoesPadraoMultipla() : []
            }
          : pergunta
      )
    );
  }

  function atualizarConfiguracao(chave: string, valor: unknown) {
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId ? { ...pergunta, configuracao: { ...pergunta.configuracao, [chave]: valor } } : pergunta
      )
    );
  }

  function atualizarOpcao(indice: number, campo: 'rotulo' | 'valor' | 'imagemUrl', valor: string) {
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId
          ? {
              ...pergunta,
              opcoes: pergunta.opcoes.map((opcao, indiceAtual) =>
                indiceAtual === indice ? { ...opcao, [campo]: valor } : opcao
              )
            }
          : pergunta
      )
    );
  }

  function adicionarOpcao() {
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId
          ? {
              ...pergunta,
              opcoes: [
                ...pergunta.opcoes,
                {
                  rotulo: `Opcao ${pergunta.opcoes.length + 1}`,
                  valor: `opcao_${pergunta.opcoes.length + 1}`,
                  ordem: pergunta.opcoes.length + 1
                }
              ]
            }
          : pergunta
      )
    );
  }

  function removerOpcao(indice: number) {
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId
          ? {
              ...pergunta,
              opcoes: pergunta.opcoes
                .filter((_opcao, indiceAtual) => indiceAtual !== indice)
                .map((opcao, indiceAtual) => ({ ...opcao, ordem: indiceAtual + 1 }))
            }
          : pergunta
      )
    );
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="grid gap-4">
      {erro ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
          <AlertTriangle size={16} />
          {erro}
        </div>
      ) : null}
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw className="h-4 w-4" />
          {carregando ? 'Atualizando' : 'Atualizar'}
        </Botao>
        <Botao type="button" onClick={() => setPreviewAberto((valor) => !valor)}>
          <Eye className="h-4 w-4" />
          {previewAberto ? 'Ocultar preview' : 'Preview paciente'}
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          onClick={() => void arquivarQuestionario()}
          disabled={salvando || !questionarioAtual || status === 'arquivado'}
        >
          <Archive className="h-4 w-4" />
          Arquivar
        </Botao>
        <Botao variante="primario" onClick={salvarQuestionario} disabled={salvando}>
          <Save className="h-4 w-4" />
          {questionarioAtual ? 'Salvar questionario' : 'Criar questionario'}
        </Botao>
      </div>

      {previewAberto ? <PreviewQuestionarioPaciente titulo={titulo} descricao={descricao} perguntas={perguntas} /> : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(420px,1fr)_360px]">
        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h2 className="text-sm font-semibold text-tinta">Questionario</h2>
          </div>
          <div className="space-y-4 p-4">
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
            <div className="space-y-1.5">
              <Rotulo htmlFor="titulo">Titulo</Rotulo>
              <Campo id="titulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="descricao">Descricao</Rotulo>
              <AreaTexto id="descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="status">Status</Rotulo>
              <Selecao
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as 'rascunho' | 'publicado' | 'arquivado')}
              >
                <option value="rascunho">Rascunho</option>
                <option value="publicado">Publicado</option>
                <option value="arquivado">Arquivado</option>
              </Selecao>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-linha bg-[#f7f8fa] p-3">
                <p className="text-xs text-[#596273]">Perguntas</p>
                <p className="text-2xl font-semibold text-tinta">{perguntas.length}</p>
              </div>
              <div className="rounded-md border border-linha bg-[#f7f8fa] p-3">
                <p className="text-xs text-[#596273]">Peso total</p>
                <p className="text-2xl font-semibold text-tinta">{scoreTotal}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="cron">Cron</Rotulo>
              <div className="flex gap-2">
                <Campo id="cron" value={regraCron} onChange={(event) => setRegraCron(event.target.value)} />
                <Botao type="button" aria-label="Agendar" onClick={agendar} disabled={salvando}>
                  <CalendarClock className="h-4 w-4" />
                </Botao>
              </div>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-linha bg-white">
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
                {perguntas.length ? (
                  perguntas.map((pergunta) => {
                    const categoria = categoriasPorId.get(pergunta.categoriaId) ?? categoriaFallback(categorias);
                    return (
                      <PerguntaOrdenavel
                        key={pergunta.id}
                        pergunta={pergunta}
                        selecionada={pergunta.id === selecionadaId}
                        categoriaNome={categoria.nome}
                        categoriaCor={categoria.corHex}
                        aoSelecionar={setSelecionadaId}
                      />
                    );
                  })
                ) : (
                  <li className="px-4 py-8 text-sm text-[#596273]">Nenhuma pergunta carregada.</li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </section>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <Settings2 className="h-4 w-4 text-[#596273]" />
            <h2 className="text-sm font-semibold text-tinta">Propriedades</h2>
          </div>
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
              <label className="flex items-center justify-between rounded-md border border-linha bg-[#f7f8fa] px-3 py-2">
                <span className="text-sm font-medium text-tinta">Obrigatoria</span>
                <input
                  type="checkbox"
                  checked={perguntaSelecionada.obrigatoria}
                  onChange={(event) => atualizarPerguntaLocal('obrigatoria', event.target.checked)}
                  className="h-5 w-5 accent-primaria"
                />
              </label>

              <div className="space-y-3 rounded-md border border-linha bg-[#f8fafb] p-3">
                <div>
                  <p className="text-sm font-semibold text-tinta">Configuracao do tipo</p>
                  <p className="text-xs text-[#596273]">Ajuste como esta pergunta sera respondida pelo paciente.</p>
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
              <div className="rounded-md border border-linha bg-[#eef7f0] p-3 text-sm text-[#245b33]">
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4" />
                  Contrato valido
                </div>
                <p className="mt-1 text-xs">Edicoes sao persistidas em `PATCH /questionarios/:id/perguntas/:perguntaId`.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-[#596273]">Selecione ou crie uma pergunta.</div>
          )}
        </aside>
      </section>
    </section>
  );
}
