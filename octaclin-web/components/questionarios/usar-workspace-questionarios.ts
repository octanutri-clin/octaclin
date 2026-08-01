import { useEffect, useMemo, useState } from 'react';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  CategoriaPerguntaApi,
  LeituraClinicaQuestionarioApi,
  MatrizLongitudinalRespostasApi,
  ModeloQuestionarioApi,
  PerguntaApi,
  QuestionarioApi,
  RespostaQuestionarioRecebidaApi,
  TipoPergunta,
  atualizarPergunta,
  atualizarQuestionario,
  carregarBootstrapQuestionarios,
  criarAgendamentoQuestionario,
  criarEnvioQuestionario,
  criarPergunta,
  criarQuestionarioAPartirModelo,
  criarQuestionario,
  duplicarQuestionario,
  incluirPerguntaBiblioteca,
  listarBibliotecaPerguntas,
  listarPerguntas,
  obterLeituraClinicaQuestionario,
  obterMatrizLongitudinalRespostas,
  reordenarPerguntas
} from '@/lib/questionarios-api';
import { PacienteResumo, ProfissionalResumo } from '@/lib/cadastros-api';
import { PerguntaEditor } from './tipos';

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
    ordem: pergunta.ordem,
    chaveClinica: pergunta.chaveClinica,
    visivelBiblioteca: pergunta.visivelBiblioteca ?? false
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

export function textoConfig(configuracao: Record<string, unknown>, chave: string, padrao = '') {
  const valor = configuracao[chave];
  return typeof valor === 'string' ? valor : padrao;
}

export function numeroConfig(configuracao: Record<string, unknown>, chave: string, padrao: number) {
  const valor = Number(configuracao[chave]);
  return Number.isFinite(valor) ? valor : padrao;
}

export function booleanoConfig(configuracao: Record<string, unknown>, chave: string, padrao = false) {
  return typeof configuracao[chave] === 'boolean' ? Boolean(configuracao[chave]) : padrao;
}

export function listaTextoConfig(configuracao: Record<string, unknown>, chave: string, padrao: string[]) {
  const valor = configuracao[chave];
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : padrao;
}

export function formatarValorResposta(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Sem resposta';
  if (Array.isArray(valor)) return valor.length ? valor.map(formatarValorResposta).join(', ') : 'Sem resposta';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Nao';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR').format(valor);
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

export function formatarDataResposta(valor?: string): string {
  if (!valor) return 'Sem data';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function useWorkspaceQuestionarios() {
  const [categorias, setCategorias] = useState<CategoriaPerguntaApi[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [questionarios, setQuestionarios] = useState<QuestionarioApi[]>([]);
  const [modelos, setModelos] = useState<ModeloQuestionarioApi[]>([]);
  const [questionarioAtual, setQuestionarioAtual] = useState<QuestionarioApi | null>(null);
  const [perguntas, setPerguntas] = useState<PerguntaEditor[]>([]);
  const [bibliotecaPerguntas, setBibliotecaPerguntas] = useState<PerguntaApi[]>([]);
  const [buscaBiblioteca, setBuscaBiblioteca] = useState('');
  const [categoriaBibliotecaId, setCategoriaBibliotecaId] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('Check-in semanal de adesao');
  const [descricao, setDescricao] = useState('Protocolo operacional de acompanhamento clinico.');
  const [status, setStatus] = useState<'rascunho' | 'publicado' | 'arquivado'>('rascunho');
  const [pacienteAgendamentoId, setPacienteAgendamentoId] = useState('');
  const [pacienteEnvioId, setPacienteEnvioId] = useState('');
  const [linkFormulario, setLinkFormulario] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoArquivarQuestionario, setConfirmandoArquivarQuestionario] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [alteracoesQuestionarioPendentes, setAlteracoesQuestionarioPendentes] = useState(false);
  const [alteracoesPerguntaPendentes, setAlteracoesPerguntaPendentes] = useState(false);
  const [respostasRecebidas, setRespostasRecebidas] = useState<RespostaQuestionarioRecebidaApi[]>([]);
  const [leituraClinica, setLeituraClinica] = useState<LeituraClinicaQuestionarioApi | null>(null);
  const [carregandoRespostas, setCarregandoRespostas] = useState(false);
  const [pacienteFiltroRespostas, setPacienteFiltroRespostas] = useState('');
  const [buscaRespostas, setBuscaRespostas] = useState('');
  const [matrizLongitudinal, setMatrizLongitudinal] = useState<MatrizLongitudinalRespostasApi | null>(null);
  const [carregandoMatriz, setCarregandoMatriz] = useState(false);
  const [pacienteFiltroMatriz, setPacienteFiltroMatriz] = useState('');
  const [questionarioFiltroMatriz, setQuestionarioFiltroMatriz] = useState('');
  const [categoriaFiltroMatriz, setCategoriaFiltroMatriz] = useState('');
  const [inicioFiltroMatriz, setInicioFiltroMatriz] = useState('');
  const [fimFiltroMatriz, setFimFiltroMatriz] = useState('');
  const [areaAtiva, setAreaAtiva] = useState<string>('formularios');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const perguntaSelecionada = perguntas.find((pergunta) => pergunta.id === selecionadaId) ?? perguntas[0];
  const categoriasPorId = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria])), [categorias]);
  const pacientesPorId = useMemo(() => new Map(pacientes.map((paciente) => [paciente.id, paciente])), [pacientes]);
  const scoreTotal = perguntas.reduce((total, pergunta) => total + pergunta.peso, 0);
  const perguntasBibliotecaVisiveis = useMemo(() => {
    const busca = buscaBiblioteca.trim().toLocaleLowerCase('pt-BR');
    return bibliotecaPerguntas.filter((pergunta) => {
      if (pergunta.questionarioId === questionarioAtual?.id) return false;
      if (categoriaBibliotecaId && pergunta.categoriaId !== categoriaBibliotecaId) return false;
      return !busca || [pergunta.enunciado, pergunta.chaveClinica ?? ''].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca));
    });
  }, [bibliotecaPerguntas, buscaBiblioteca, categoriaBibliotecaId, questionarioAtual?.id]);
  const perguntasLeituraFiltradas = useMemo(() => {
    const termo = buscaRespostas.trim().toLocaleLowerCase('pt-BR');
    const itens = leituraClinica?.perguntas ?? [];
    if (!termo) return itens;
    return itens.filter((pergunta) => {
      const textos = [
        pergunta.enunciado,
        pergunta.tipo,
        ...pergunta.textosRecentes,
        ...pergunta.distribuicao.map((item) => item.valor)
      ];
      return textos.some((texto) => texto.toLocaleLowerCase('pt-BR').includes(termo));
    });
  }, [buscaRespostas, leituraClinica]);
  const respostasVisiveis = useMemo(() => {
    const termo = buscaRespostas.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return respostasRecebidas;
    return respostasRecebidas.filter((resposta) => {
      const paciente = pacientesPorId.get(resposta.pacienteId);
      const textos = [
        paciente?.nome ?? '',
        ...resposta.respostas.flatMap((item) => [item.enunciado, formatarValorResposta(item.valor)])
      ];
      return textos.some((texto) => texto.toLocaleLowerCase('pt-BR').includes(termo));
    });
  }, [buscaRespostas, pacientesPorId, respostasRecebidas]);

  async function carregarPerguntas(questionarioId: string) {
    const resposta = await listarPerguntas(questionarioId);
    const mapeadas = resposta.map(mapearPergunta);
    setPerguntas(mapeadas);
    setSelecionadaId(mapeadas[0]?.id ?? null);
  }

  async function carregarRespostas(questionarioId = questionarioAtual?.id, pacienteId = pacienteFiltroRespostas) {
    if (!questionarioId) {
      setRespostasRecebidas([]);
      setLeituraClinica(null);
      return;
    }

    setCarregandoRespostas(true);
    try {
      const leitura = await obterLeituraClinicaQuestionario(questionarioId, { pacienteId: pacienteId || undefined });
      setLeituraClinica(leitura);
      setRespostasRecebidas(leitura.respostas);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar respostas do formulario.');
    } finally {
      setCarregandoRespostas(false);
    }
  }

  async function carregarMatrizLongitudinal() {
    setCarregandoMatriz(true);
    setErro(null);
    try {
      const matriz = await obterMatrizLongitudinalRespostas({
        pacienteId: pacienteFiltroMatriz || undefined,
        questionarioId: questionarioFiltroMatriz || undefined,
        categoriaId: categoriaFiltroMatriz || undefined,
        inicioEm: inicioFiltroMatriz || undefined,
        fimEm: fimFiltroMatriz || undefined
      });
      setMatrizLongitudinal(matriz);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar a matriz longitudinal.');
    } finally {
      setCarregandoMatriz(false);
    }
  }

  async function selecionarQuestionario(questionario: QuestionarioApi) {
    if (questionario.id !== questionarioAtual?.id && !confirmarTrocaComAlteracoesPendentes()) return;
    setQuestionarioAtual(questionario);
    setTitulo(questionario.titulo);
    setDescricao(questionario.descricao ?? '');
    setStatus(questionario.status);
    setLinkFormulario('');
    setAlteracoesQuestionarioPendentes(false);
    setAlteracoesPerguntaPendentes(false);
    await Promise.all([carregarPerguntas(questionario.id), carregarRespostas(questionario.id)]);
  }

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const [bootstrap, biblioteca] = await Promise.all([carregarBootstrapQuestionarios(), listarBibliotecaPerguntas()]);
      setCategorias(bootstrap.categorias);
      setProfissionais(bootstrap.profissionais);
      setPacientes(bootstrap.pacientes);
      setQuestionarios(bootstrap.questionarios.itens);
      setModelos(bootstrap.modelos);
      setBibliotecaPerguntas(biblioteca);
      setPacienteAgendamentoId(bootstrap.pacientes[0]?.id ?? '');
      setPacienteEnvioId(bootstrap.pacientes[0]?.id ?? '');
      setPacienteFiltroMatriz(bootstrap.pacientes[0]?.id ?? '');

      const primeiro = bootstrap.questionarios.itens[0];
      if (primeiro) {
        await selecionarQuestionario(primeiro);
      } else {
        setQuestionarioAtual(null);
        setPerguntas([]);
        setSelecionadaId(null);
        setRespostasRecebidas([]);
        setLeituraClinica(null);
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
      setAlteracoesQuestionarioPendentes(false);
      setSucesso('Questionario salvo.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar questionario.');
    } finally {
      setSalvando(false);
    }
  }

  async function duplicarAtual() {
    if (!questionarioAtual) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const duplicado = await duplicarQuestionario(questionarioAtual.id);
      setQuestionarios((atuais) => [duplicado, ...atuais]);
      await selecionarQuestionario(duplicado);
      setSucesso('Questionario duplicado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao duplicar questionario.');
    } finally {
      setSalvando(false);
    }
  }

  async function criarAPartirModelo(modelo: ModeloQuestionarioApi) {
    const profissionalId = profissionais[0]?.id;
    if (!profissionalId) {
      setErro('Cadastre um profissional antes de usar modelos.');
      setSucesso(null);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarQuestionarioAPartirModelo(modelo.id, { profissionalId });
      setQuestionarios((atuais) => [criado, ...atuais]);
      await selecionarQuestionario(criado);
      setSucesso(`Modelo aplicado: ${modelo.titulo}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar questionario a partir do modelo.');
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
        configuracao: configuracaoPadrao('likert'),
        visivelBiblioteca: false
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
        chaveClinica: perguntaSelecionada.chaveClinica,
        visivelBiblioteca: perguntaSelecionada.visivelBiblioteca ?? false,
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
      setBibliotecaPerguntas((atuais) =>
        atualizada.visivelBiblioteca
          ? [atualizada, ...atuais.filter((pergunta) => pergunta.id !== atualizada.id)]
          : atuais.filter((pergunta) => pergunta.id !== atualizada.id)
      );
      setAlteracoesPerguntaPendentes(false);
      setSucesso('Pergunta salva.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar pergunta.');
    } finally {
      setSalvando(false);
    }
  }

  async function agendar(recorrencia: { regraCron?: string; dataFixa?: string }) {
    if (!questionarioAtual) {
      setErro('Crie um questionario antes de agendar.');
      setSucesso(null);
      return;
    }
    if (!pacienteAgendamentoId) {
      setErro('Selecione um paciente para o check-in recorrente.');
      setSucesso(null);
      return;
    }
    if (!recorrencia.regraCron && !recorrencia.dataFixa) {
      setErro('Escolha uma frequencia para o check-in recorrente.');
      setSucesso(null);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarAgendamentoQuestionario({
        questionarioId: questionarioAtual.id,
        pacienteId: pacienteAgendamentoId,
        regraCron: recorrencia.regraCron,
        dataFixa: recorrencia.dataFixa,
        timezone: 'America/Sao_Paulo'
      });
      setSucesso('Check-in recorrente criado para o paciente selecionado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar agendamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function arquivarQuestionario() {
    if (!questionarioAtual) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizado = await atualizarQuestionario(questionarioAtual.id, { titulo, descricao, status: 'arquivado' });
      setStatus('arquivado');
      setQuestionarioAtual(atualizado);
      setQuestionarios((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setAlteracoesQuestionarioPendentes(false);
      setSucesso('Questionario arquivado.');
      setConfirmandoArquivarQuestionario(false);
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
    setAlteracoesPerguntaPendentes(true);
    setPerguntas((atuais) =>
      atuais.map((pergunta) => (pergunta.id === selecionadaId ? { ...pergunta, [campo]: valor } : pergunta))
    );
  }

  async function gerarLinkFormulario() {
    if (!questionarioAtual) {
      setErro('Crie um questionario antes de gerar link.');
      setSucesso(null);
      return;
    }
    if (!pacienteEnvioId) {
      setErro('Selecione um paciente para gerar o link.');
      setSucesso(null);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const envio = await criarEnvioQuestionario(questionarioAtual.id, { pacienteId: pacienteEnvioId });
      setLinkFormulario(envio.linkFormulario);
      setSucesso('Link do formulario gerado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao gerar link do formulario.');
    } finally {
      setSalvando(false);
    }
  }

  async function incluirDaBiblioteca(perguntaBibliotecaId: string) {
    if (!questionarioAtual) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const incluida = await incluirPerguntaBiblioteca(questionarioAtual.id, perguntaBibliotecaId);
      const mapeada = mapearPergunta(incluida);
      setPerguntas((atuais) => [...atuais, mapeada]);
      setSelecionadaId(mapeada.id);
      setSucesso('Pergunta incluida da biblioteca.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao incluir pergunta da biblioteca.');
    } finally {
      setSalvando(false);
    }
  }

  function trocarTipoPergunta(tipo: TipoPergunta) {
    setAlteracoesPerguntaPendentes(true);
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId
          ? {
              ...pergunta,
              tipo,
              configuracao: { ...configuracaoPadrao(tipo), secao: textoConfig(pergunta.configuracao, 'secao', 'Sem secao') },
              opcoes: tipo === 'multipla_escolha' ? pergunta.opcoes.length >= 2 ? pergunta.opcoes : opcoesPadraoMultipla() : []
            }
          : pergunta
      )
    );
  }

  function atualizarConfiguracao(chave: string, valor: unknown) {
    setAlteracoesPerguntaPendentes(true);
    setPerguntas((atuais) =>
      atuais.map((pergunta) =>
        pergunta.id === selecionadaId ? { ...pergunta, configuracao: { ...pergunta.configuracao, [chave]: valor } } : pergunta
      )
    );
  }

  function atualizarOpcao(indice: number, campo: 'rotulo' | 'valor' | 'imagemUrl', valor: string) {
    setAlteracoesPerguntaPendentes(true);
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
    setAlteracoesPerguntaPendentes(true);
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
    setAlteracoesPerguntaPendentes(true);
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
    function aoTentarFecharAba(evento: BeforeUnloadEvent) {
      if (!alteracoesQuestionarioPendentes && !alteracoesPerguntaPendentes) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', aoTentarFecharAba);
    return () => window.removeEventListener('beforeunload', aoTentarFecharAba);
  }, [alteracoesQuestionarioPendentes, alteracoesPerguntaPendentes]);

  function confirmarTrocaComAlteracoesPendentes() {
    return (
      !(alteracoesQuestionarioPendentes || alteracoesPerguntaPendentes) ||
      window.confirm('Voce tem alteracoes nao salvas neste formulario ou pergunta. Trocar mesmo assim?')
    );
  }

  return {
    categorias,
    profissionais,
    pacientes,
    questionarios,
    modelos,
    questionarioAtual,
    perguntas,
    bibliotecaPerguntas,
    buscaBiblioteca,
    setBuscaBiblioteca,
    categoriaBibliotecaId,
    setCategoriaBibliotecaId,
    selecionadaId,
    setSelecionadaId,
    titulo,
    setTitulo,
    descricao,
    setDescricao,
    status,
    setStatus,
    pacienteAgendamentoId,
    setPacienteAgendamentoId,
    pacienteEnvioId,
    setPacienteEnvioId,
    linkFormulario,
    erro,
    sucesso,
    carregando,
    salvando,
    confirmandoArquivarQuestionario,
    setConfirmandoArquivarQuestionario,
    previewAberto,
    setPreviewAberto,
    alteracoesQuestionarioPendentes,
    setAlteracoesQuestionarioPendentes,
    alteracoesPerguntaPendentes,
    setAlteracoesPerguntaPendentes,
    respostasRecebidas,
    leituraClinica,
    carregandoRespostas,
    pacienteFiltroRespostas,
    setPacienteFiltroRespostas,
    buscaRespostas,
    setBuscaRespostas,
    matrizLongitudinal,
    carregandoMatriz,
    pacienteFiltroMatriz,
    setPacienteFiltroMatriz,
    questionarioFiltroMatriz,
    setQuestionarioFiltroMatriz,
    categoriaFiltroMatriz,
    setCategoriaFiltroMatriz,
    inicioFiltroMatriz,
    setInicioFiltroMatriz,
    fimFiltroMatriz,
    setFimFiltroMatriz,
    areaAtiva,
    setAreaAtiva,
    sensors,
    perguntaSelecionada,
    categoriasPorId,
    pacientesPorId,
    scoreTotal,
    perguntasBibliotecaVisiveis,
    perguntasLeituraFiltradas,
    respostasVisiveis,
    carregarPerguntas,
    carregarRespostas,
    carregarMatrizLongitudinal,
    selecionarQuestionario,
    carregar,
    criarNovoQuestionario,
    salvarQuestionario,
    duplicarAtual,
    criarAPartirModelo,
    adicionarPergunta,
    salvarPergunta,
    agendar,
    arquivarQuestionario,
    aoFinalizarArraste,
    atualizarPerguntaLocal,
    gerarLinkFormulario,
    incluirDaBiblioteca,
    trocarTipoPergunta,
    atualizarConfiguracao,
    atualizarOpcao,
    adicionarOpcao,
    removerOpcao,
    confirmarTrocaComAlteracoesPendentes
  };
}

export type WorkspaceQuestionarios = ReturnType<typeof useWorkspaceQuestionarios>;
