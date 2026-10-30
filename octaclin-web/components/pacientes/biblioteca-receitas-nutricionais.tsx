'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Archive, BookOpenCheck, Plus, Send, UtensilsCrossed } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarReceitaNutricional,
  criarReceitaNutricional,
  atualizarReceitaNutricional,
  consultarReceitasNutricionais,
  obterConsentimentoPacienteReceitas,
  obterReceitaNutricional,
  preverPorcionamentoReceita,
  compartilharReceitasNutricionais,
  listarEnviosReceitaPaciente,
  retirarCompartilhamentoReceita,
  type ConsentimentoReceitaApi,
  type CriarMetadadosReceitaApi,
  type AlterarMetadadosReceitaApi,
  type EnvioReceitaClinicaApi,
  type ItemPlanoAlimentarEntrada,
  type OrigemReceitaNutricionalApi,
  type PreviaPorcionamentoReceitaApi,
  type ReceitaNutricionalApi,
  type ReceitaNutricionalResumoApi,
  type TipoReceitaNutricionalApi
} from '@/lib/plano-alimentar-api';

interface RefeicaoDisponivel {
  chave: string;
  nome: string;
  itens: ItemPlanoAlimentarEntrada[];
}

interface BibliotecaReceitasNutricionaisProps {
  pacienteId: string;
  refeicoes: () => RefeicaoDisponivel[];
  aoInserir: (chaveRefeicao: string, itens: ItemPlanoAlimentarEntrada[]) => void;
  validarAntesDeSalvar?: (chaveRefeicao: string) => void;
  desabilitado?: boolean;
}

const ROTULO_TIPO: Record<TipoReceitaNutricionalApi, string> = {
  receita: 'Receita',
  refeicao_pronta: 'Refeição pronta'
};

function formatarNumero(valor: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(valor);
}

interface ConfiguracaoEnvioReceita {
  modo: 'quantidades_cadastradas' | 'porcionado';
  porcoes: string;
  carregando?: boolean;
  erro?: string;
  previa?: Extract<PreviaPorcionamentoReceitaApi, { estado: 'calculavel' }>;
  receita?: ReceitaNutricionalApi;
  instrucoes?: string;
  confirmacaoInstrucoes: boolean;
}

/**
 * Biblioteca que nunca grava diretamente no plano. Aplicar so atualiza o
 * formulario local; o salvamento do rascunho e quem revalida e calcula.
 */
export function BibliotecaReceitasNutricionais({
  ...props
}: BibliotecaReceitasNutricionaisProps) {
  return <BibliotecaReceitasNutricionaisInterna key={props.pacienteId} {...props} />;
}

function BibliotecaReceitasNutricionaisInterna({
  pacienteId,
  refeicoes,
  aoInserir,
  validarAntesDeSalvar,
  desabilitado = false
}: BibliotecaReceitasNutricionaisProps) {
  const id = useId();
  const [itens, setItens] = useState<ReceitaNutricionalResumoApi[]>([]);
  const [selecionada, setSelecionada] = useState('');
  const [refeicaoOrigem, setRefeicaoOrigem] = useState(() => refeicoes()[0]?.chave ?? '');
  const [refeicaoDestino, setRefeicaoDestino] = useState(() => refeicoes()[0]?.chave ?? '');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemReceitaNutricionalApi>('pessoal');
  const [tipo, setTipo] = useState<TipoReceitaNutricionalApi>('receita');
  const [categoria, setCategoria] = useState('');
  const [baseQuantidades, setBaseQuantidades] = useState<'' | 'receita_inteira' | 'por_porcao'>('');
  const [baseProposta, setBaseProposta] = useState<'' | 'receita_inteira' | 'por_porcao'>('');
  const [confirmarMudancaBase, setConfirmarMudancaBase] = useState(false);
  const [rendimentoPorcoes, setRendimentoPorcoes] = useState('');
  const [tempoPreparoMinutos, setTempoPreparoMinutos] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<'' | OrigemReceitaNutricionalApi>('');
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoReceitaNutricionalApi>('');
  const [paginaBiblioteca, setPaginaBiblioteca] = useState(1);
  const [totalBiblioteca, setTotalBiblioteca] = useState(0);
  const [receitasConhecidas, setReceitasConhecidas] = useState<Record<string, ReceitaNutricionalResumoApi>>({});
  const [selecionadasCompartilhar, setSelecionadasCompartilhar] = useState<string[]>([]);
  const [consentimentosPaciente, setConsentimentosPaciente] = useState<ConsentimentoReceitaApi>({ email: false, whatsapp: false, push: false });
  const [canaisCompartilhamento, setCanaisCompartilhamento] = useState<Array<'email' | 'whatsapp' | 'push'>>([]);
  const [agendadoPara, setAgendadoPara] = useState('');
  const [confirmacaoRevisaoManual, setConfirmacaoRevisaoManual] = useState(false);
  const [configuracoesEnvio, setConfiguracoesEnvio] = useState<Record<string, ConfiguracaoEnvioReceita>>({});
  const [configuracoesPacienteId, setConfiguracoesPacienteId] = useState(pacienteId);
  const geracaoEnvioReceita = useRef<Record<string, number>>({});
  const [instrucoes, setInstrucoes] = useState('');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | 'compartilhando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  const [confirmarCompartilhamento, setConfirmarCompartilhamento] = useState(false);
  const [enviosPaciente, setEnviosPaciente] = useState<EnvioReceitaClinicaApi[]>([]);
  const [compartilhamentoRetirar, setCompartilhamentoRetirar] = useState<EnvioReceitaClinicaApi | null>(null);
  const [enviosCarregadosParaPaciente, setEnviosCarregadosParaPaciente] = useState('');
  const pacienteIdAtual = useRef(pacienteId);
  const chaveIdempotenciaCompartilhamento = useRef('');
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [versaoEmEdicao, setVersaoEmEdicao] = useState<number | null>(null);
  const [itensEmEdicao, setItensEmEdicao] = useState<ItemPlanoAlimentarEntrada[]>([]);
  const sequenciaCarregamento = useRef(0);
  const aplicacoesEmCurso = useRef(new Set<string>());
  const compartilhamentosEmCurso = useRef(new Set<string>());
  const [porcoesDesejadas, setPorcoesDesejadas] = useState('1');
  const [previaAplicacao, setPreviaAplicacao] = useState<{
    receitaId: string;
    versao: number;
    fingerprint: string;
    pacienteId: string;
    refeicaoDestino: string;
    quantidade: number;
    dados: Extract<PreviaPorcionamentoReceitaApi, { estado: 'calculavel' }>;
    itensOriginais: ItemPlanoAlimentarEntrada[];
  } | null>(null);
  const geracaoRequisicao = useRef(0);

  const refeicoesAtuais = refeicoes();
  const refeicaoOrigemAtual = refeicoesAtuais.some((refeicao) => refeicao.chave === refeicaoOrigem)
    ? refeicaoOrigem
    : (refeicoesAtuais[0]?.chave ?? '');
  const refeicaoDestinoAtual = refeicoesAtuais.some((refeicao) => refeicao.chave === refeicaoDestino)
    ? refeicaoDestino
    : (refeicoesAtuais[0]?.chave ?? '');
  const contextoAtual = useRef({ pacienteId, desabilitado, selecionada, refeicaoDestino: refeicaoDestinoAtual });

  useLayoutEffect(() => {
    pacienteIdAtual.current = pacienteId;
  }, [pacienteId]);

  useLayoutEffect(() => {
    contextoAtual.current = { pacienteId, desabilitado, selecionada, refeicaoDestino: refeicaoDestinoAtual };
    geracaoRequisicao.current += 1;
  }, [pacienteId, desabilitado, selecionada, refeicaoDestinoAtual]);

  useEffect(() => () => {
    geracaoRequisicao.current += 1;
    for (const receitaId of Object.keys(geracaoEnvioReceita.current)) geracaoEnvioReceita.current[receitaId] += 1;
  }, []);

  const receitaAtual = useMemo(() => receitasConhecidas[selecionada] ?? itens.find((item) => item.id === selecionada), [itens, receitasConhecidas, selecionada]);
  const configuracoesVisiveis = configuracoesPacienteId === pacienteId ? configuracoesEnvio : {};
  const possuiEnvioPorcionadoIncompleto = selecionadasCompartilhar.some((receitaId) => {
    const config = configuracoesVisiveis[receitaId];
    return config?.modo === 'porcionado' && (!config.previa || !config.confirmacaoInstrucoes || !config.receita);
  });

  const carregar = useCallback(async () => {
    const sequencia = ++sequenciaCarregamento.current;
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await consultarReceitasNutricionais({
        pagina: paginaBiblioteca,
        limite: 25,
        categoria: filtroCategoria.trim() || undefined,
        etiqueta: filtroEtiqueta.trim() || undefined,
        origem: filtroOrigem || undefined,
        tipo: filtroTipo || undefined
      });
      if (sequencia !== sequenciaCarregamento.current) return;
      setItens(pagina.itens);
      setTotalBiblioteca(pagina.total);
      setReceitasConhecidas((atuais) => ({ ...atuais, ...Object.fromEntries(pagina.itens.map((receita) => [receita.id, receita])) }));
    } catch (falha) {
      if (sequencia === sequenciaCarregamento.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar as receitas.'));
    } finally {
      if (sequencia === sequenciaCarregamento.current) setOcupado(null);
    }
  }, [filtroCategoria, filtroEtiqueta, filtroOrigem, filtroTipo, paginaBiblioteca]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(agendamento);
  }, [carregar]);

  const carregarEnviosEConsentimento = useCallback(async () => {
    const pacienteDaConsulta = pacienteId;
    try {
      const [consentimentos, envios] = await Promise.all([
        obterConsentimentoPacienteReceitas(pacienteDaConsulta),
        listarEnviosReceitaPaciente(pacienteDaConsulta)
      ]);
      if (pacienteIdAtual.current !== pacienteDaConsulta) return;
      setConsentimentosPaciente(consentimentos); setEnviosPaciente(envios); setEnviosCarregadosParaPaciente(pacienteDaConsulta);
    } catch {
      if (pacienteIdAtual.current !== pacienteDaConsulta) return;
      setConsentimentosPaciente({ email: false, whatsapp: false, push: false });
      setEnviosPaciente([]); setEnviosCarregadosParaPaciente(pacienteDaConsulta);
    }
  }, [pacienteId]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => { void carregarEnviosEConsentimento(); }, 0);
    return () => window.clearTimeout(agendamento);
  }, [carregarEnviosEConsentimento]);

  async function aplicar() {
    const pacienteDaAplicacao = pacienteId;
    if (!selecionada || !refeicaoDestinoAtual || aplicacoesEmCurso.current.has(pacienteDaAplicacao)) return;
    aplicacoesEmCurso.current.add(pacienteDaAplicacao);
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    const geracao = ++geracaoRequisicao.current;
    const contexto = { pacienteId, selecionada, refeicaoDestino: refeicaoDestinoAtual };
    try {
      const receita = await obterReceitaNutricional(selecionada);
      if (geracao !== geracaoRequisicao.current || contextoAtual.current.pacienteId !== contexto.pacienteId || contextoAtual.current.selecionada !== contexto.selecionada || contextoAtual.current.refeicaoDestino !== contexto.refeicaoDestino || contextoAtual.current.desabilitado) return;
      if (receita.alimentosIndisponiveis.length) {
        setErro(
          `${receita.alimentosIndisponiveis.length} alimento(s) desta receita sairam do catalogo ativo. Revise a receita antes de aplicar.`
        );
        return;
      }
      if (receita.metadados?.baseQuantidades) {
        const quantidade = Number(porcoesDesejadas);
        if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1000) {
          setErro('Informe uma quantidade de porções válida para conferir a receita.');
          return;
        }
        const dados = await preverPorcionamentoReceita(receita.id, { versaoEsperada: receita.versaoAtual, porcoesDesejadas: quantidade });
        if (geracao !== geracaoRequisicao.current || contextoAtual.current.pacienteId !== contexto.pacienteId || contextoAtual.current.selecionada !== contexto.selecionada || contextoAtual.current.refeicaoDestino !== contexto.refeicaoDestino || contextoAtual.current.desabilitado) return;
        if (dados.estado !== 'calculavel') {
          setErro('Não foi possível calcular esta quantidade. Confira a base, o rendimento e os dados dos ingredientes.');
          return;
        }
        setPreviaAplicacao({ receitaId: receita.id, versao: receita.versaoAtual, fingerprint: dados.fingerprint, pacienteId: contexto.pacienteId, refeicaoDestino: contexto.refeicaoDestino, quantidade, dados, itensOriginais: receita.itens });
        return;
      }
      aoInserir(refeicaoDestinoAtual, receita.itens);
      setAviso(`${ROTULO_TIPO[receita.tipo]} inserida no rascunho. Salve o plano para recalcular os totais.`);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar a receita.'));
    } finally {
      aplicacoesEmCurso.current.delete(pacienteDaAplicacao);
      if (pacienteIdAtual.current === pacienteDaAplicacao) setOcupado(null);
    }
  }

  function cancelarPreviaAplicacao() {
    geracaoRequisicao.current += 1;
    setPreviaAplicacao(null);
  }

  async function confirmarAplicacao() {
    const previa = previaAplicacao;
    if (!previa || ocupado !== null || aplicacoesEmCurso.current.has(previa.pacienteId)) return;
    aplicacoesEmCurso.current.add(previa.pacienteId);
    const geracao = ++geracaoRequisicao.current;
    setOcupado('aplicando'); setErro(null);
    try {
      if (contextoAtual.current.pacienteId !== previa.pacienteId || contextoAtual.current.selecionada !== previa.receitaId || contextoAtual.current.refeicaoDestino !== previa.refeicaoDestino || contextoAtual.current.desabilitado) {
        setPreviaAplicacao(null);
        setErro('O paciente, a receita ou a refeição mudou. Confira a inserção novamente.');
        return;
      }
      const receitaAtualizada = await obterReceitaNutricional(previa.receitaId);
      if (geracao !== geracaoRequisicao.current || contextoAtual.current.pacienteId !== previa.pacienteId || contextoAtual.current.selecionada !== previa.receitaId || contextoAtual.current.refeicaoDestino !== previa.refeicaoDestino || contextoAtual.current.desabilitado) return;
      if (receitaAtualizada.versaoAtual !== previa.versao) {
        setPreviaAplicacao(null);
        setErro('A receita foi atualizada desde a prévia. Gere uma nova conferência antes de inserir.');
        return;
      }
      const dadosAtualizados = await preverPorcionamentoReceita(previa.receitaId, { versaoEsperada: previa.versao, porcoesDesejadas: previa.quantidade });
      if (geracao !== geracaoRequisicao.current || contextoAtual.current.pacienteId !== previa.pacienteId || contextoAtual.current.selecionada !== previa.receitaId || contextoAtual.current.refeicaoDestino !== previa.refeicaoDestino || contextoAtual.current.desabilitado) return;
      if (dadosAtualizados.estado !== 'calculavel' || dadosAtualizados.fingerprint !== previa.fingerprint || receitaAtualizada.alimentosIndisponiveis.length || dadosAtualizados.itens.length !== previa.itensOriginais.length) {
        setPreviaAplicacao(null);
        setErro('Os dados da receita mudaram desde a prévia. Gere uma nova conferência antes de inserir.');
        return;
      }
      const itensAplicar = dadosAtualizados.itens.map((itemPrevisto, indice) => {
        const original = previa.itensOriginais[indice];
        const substituicoesOriginais = original.substituicoes ?? [];
        const substituicoesPrevistas = itemPrevisto.substituicoes ?? [];
        if (substituicoesPrevistas.length !== substituicoesOriginais.length) throw new Error('A composição da receita mudou desde a prévia.');
        return {
          ...original,
          quantidade: itemPrevisto.quantidade,
          porcaoGramas: itemPrevisto.porcaoGramas,
          substituicoes: substituicoesPrevistas.map((alternativa, indiceAlternativa) => ({
            ...substituicoesOriginais[indiceAlternativa],
            quantidade: alternativa.quantidade,
            porcaoGramas: alternativa.porcaoGramas
          }))
        };
      });
      aoInserir(previa.refeicaoDestino, itensAplicar);
      setPreviaAplicacao(null);
      setAviso(`${ROTULO_TIPO[receitaAtualizada.tipo]} inserida no rascunho para ${formatarNumero(previa.quantidade)} porções. Salve o plano para recalcular os totais.`);
    } catch (falha) {
      setPreviaAplicacao(null);
      setErro(mensagemFalhaInterface(falha, 'Não foi possível confirmar a inserção. Confira os dados e tente novamente.'));
    } finally { aplicacoesEmCurso.current.delete(previa.pacienteId); if (pacienteIdAtual.current === previa.pacienteId) setOcupado(null); }
  }

  async function salvar() {
    const refeicao = refeicoesAtuais.find((item) => item.chave === refeicaoOrigemAtual);
    if (!nome.trim()) {
      setErro('Informe um nome para salvar na biblioteca.');
      return;
    }
    const itensSalvar = idEmEdicao ? itensEmEdicao : refeicao?.itens;
    if (!itensSalvar?.length) {
      setErro('Escolha uma refeição com ao menos um alimento para salvar.');
      return;
    }
    if (!categoria.trim()) {
      setErro('Informe uma categoria interna para a receita.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      validarAntesDeSalvar?.(refeicaoOrigemAtual);
      const entradaBase = {
        nome: nome.trim(),
        origem,
        tipo,
        categoria: categoria.trim(),
        instrucoes: instrucoes.trim() || undefined,
        itens: itensSalvar
      };
      const etiquetasAtuais = etiquetas.split(',').map((tag) => tag.trim()).filter(Boolean);
      const metadadosCriacao: CriarMetadadosReceitaApi = {
        ...(baseQuantidades ? { baseQuantidades } : {}),
        ...(rendimentoPorcoes ? { rendimentoPorcoes: Number(rendimentoPorcoes) } : {}),
        ...(tempoPreparoMinutos ? { tempoPreparoMinutos: Number(tempoPreparoMinutos) } : {}),
        etiquetas: etiquetasAtuais
      };
      const metadadosEdicao: AlterarMetadadosReceitaApi = {
        baseQuantidades: baseQuantidades || null,
        rendimentoPorcoes: rendimentoPorcoes ? Number(rendimentoPorcoes) : null,
        tempoPreparoMinutos: tempoPreparoMinutos ? Number(tempoPreparoMinutos) : null,
        etiquetas: etiquetasAtuais
      };
      if (idEmEdicao && versaoEmEdicao) {
        await atualizarReceitaNutricional(idEmEdicao, { ...entradaBase, versaoEsperada: versaoEmEdicao, metadados: metadadosEdicao });
      } else {
        await criarReceitaNutricional({ ...entradaBase, metadados: metadadosCriacao });
      }
      setNome('');
      setCategoria('');
      setBaseQuantidades(''); setRendimentoPorcoes(''); setTempoPreparoMinutos(''); setEtiquetas('');
      setInstrucoes('');
      setIdEmEdicao(null); setVersaoEmEdicao(null); setItensEmEdicao([]);
      setAviso('Receita salva na biblioteca. Envios anteriores continuam com a versão recebida.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function editarSelecionada() {
    if (!selecionada) return;
    setOcupado('carregando'); setErro(null);
    try {
      const receita = await obterReceitaNutricional(selecionada);
      setIdEmEdicao(receita.id); setVersaoEmEdicao(receita.versaoAtual);
      setNome(receita.nome); setOrigem(receita.origem); setTipo(receita.tipo);
      setCategoria(receita.categoria ?? ''); setInstrucoes(receita.instrucoes ?? ''); setItensEmEdicao(receita.itens);
      setBaseQuantidades(receita.metadados?.baseQuantidades ?? '');
      setRendimentoPorcoes(receita.metadados?.rendimentoPorcoes?.toString() ?? '');
      setTempoPreparoMinutos(receita.metadados?.tempoPreparoMinutos?.toString() ?? '');
      setEtiquetas(receita.metadados?.etiquetas.join(', ') ?? '');
      setAviso('Edite os dados e salve. A receita já recebida pelo paciente não será alterada.');
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir a receita para edição.')); }
    finally { setOcupado(null); }
  }

  async function arquivar() {
    if (!selecionada) return;
    setOcupado('arquivando');
    setErro(null);
    setAviso(null);
    try {
      await arquivarReceitaNutricional(selecionada);
      geracaoEnvioReceita.current[selecionada] = (geracaoEnvioReceita.current[selecionada] ?? 0) + 1;
      setSelecionadasCompartilhar((atuais) => atuais.filter((receitaId) => receitaId !== selecionada));
      setConfiguracoesEnvio((atuais) => { const proxima = { ...atuais }; delete proxima[selecionada]; return proxima; });
      chaveIdempotenciaCompartilhamento.current = '';
      setSelecionada('');
      setConfirmarArquivo(false);
      setAviso('Item arquivado da biblioteca. Planos publicados não foram alterados.');
      if (paginaBiblioteca > 1 && (paginaBiblioteca - 1) * 25 >= totalBiblioteca - 1) setPaginaBiblioteca((atual) => Math.max(1, atual - 1));
      else await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function compartilhar() {
    if (!selecionadasCompartilhar.length || selecionadasCompartilhar.length > 10 || compartilhamentosEmCurso.current.has(pacienteId)) return;
    const selecionadasSemResumo = selecionadasCompartilhar.filter((receitaId) => !receitasConhecidas[receitaId]);
    if (selecionadasSemResumo.length) { setErro('Atualize a biblioteca para conferir a versão das receitas selecionadas.'); return; }
    const configuracoesPorcionadas = selecionadasCompartilhar.flatMap((receitaId) => {
      const config = configuracoesVisiveis[receitaId];
      if (config?.modo !== 'porcionado') return [];
      if (!config.previa || !config.receita || !config.confirmacaoInstrucoes) return [];
      return [{ receitaId, porcoesDesejadas: Number(config.porcoes), fingerprintPrevia: config.previa.fingerprint, instrucoesPersonalizadas: config.instrucoes ?? '', confirmacaoConferenciaInstrucoes: true as const }];
    });
    const quantidadeComPorcao = selecionadasCompartilhar.filter((receitaId) => configuracoesVisiveis[receitaId]?.modo === 'porcionado').length;
    if (configuracoesPorcionadas.length !== quantidadeComPorcao) {
      setErro('Conclua a prévia e a conferência de cada receita com quantidades personalizadas antes de compartilhar.');
      return;
    }
    const pacienteDoEnvio = pacienteId;
    compartilhamentosEmCurso.current.add(pacienteDoEnvio);
    setOcupado('compartilhando'); setErro(null); setAviso(null);
    try {
      const resultado = await compartilharReceitasNutricionais({
        pacienteId,
        chaveIdempotencia: chaveIdempotenciaCompartilhamento.current || (chaveIdempotenciaCompartilhamento.current = crypto.randomUUID()),
        receitaIds: selecionadasCompartilhar,
        versoesEsperadas: selecionadasCompartilhar.map((receitaId) => ({ receitaId, versao: receitasConhecidas[receitaId]!.versaoAtual })),
        ...(configuracoesPorcionadas.length ? { porcionamentos: configuracoesPorcionadas } : {}),
        canais: ['portal', ...canaisCompartilhamento],
        agendadoPara: agendadoPara ? new Date(agendadoPara).toISOString() : undefined,
        confirmacaoRevisaoManual
      });
      if (pacienteIdAtual.current !== pacienteDoEnvio) return;
      setAviso(`${resultado.quantidade} receita(s) ${agendadoPara ? 'agendada(s)' : 'compartilhada(s)'} no portal. Os avisos externos não incluem o conteúdo.`);
      setSelecionadasCompartilhar([]); setConfiguracoesEnvio({}); setAgendadoPara(''); setConfirmacaoRevisaoManual(false); setConfirmarCompartilhamento(false);
      chaveIdempotenciaCompartilhamento.current = '';
      await carregarEnviosEConsentimento();
    } catch (falha) { if (pacienteIdAtual.current === pacienteDoEnvio) setErro(mensagemFalhaInterface(falha, 'Não foi possível compartilhar as receitas.')); }
    finally { compartilhamentosEmCurso.current.delete(pacienteDoEnvio); if (pacienteIdAtual.current === pacienteDoEnvio) setOcupado(null); }
  }

  function atualizarConfiguracaoEnvio(receitaId: string, alteracao: Partial<ConfiguracaoEnvioReceita>) {
    setConfiguracoesPacienteId(pacienteId);
    setConfiguracoesEnvio((atuais) => ({
      ...atuais,
      [receitaId]: Object.assign(
        { modo: 'quantidades_cadastradas' as const, porcoes: '1', confirmacaoInstrucoes: false },
        atuais[receitaId], alteracao
      )
    }));
    chaveIdempotenciaCompartilhamento.current = '';
  }

  async function previsualizarEnvio(receitaId: string) {
    const resumo = receitasConhecidas[receitaId];
    const config = configuracoesVisiveis[receitaId] ?? { modo: 'quantidades_cadastradas' as const, porcoes: '1', confirmacaoInstrucoes: false };
    const porcoes = Number(config.porcoes);
    if (!resumo || !Number.isFinite(porcoes) || porcoes <= 0 || porcoes > 1000) {
      atualizarConfiguracaoEnvio(receitaId, { erro: 'Informe uma quantidade de porções válida.' }); return;
    }
    const pacienteDaConsulta = pacienteId;
    const geracao = (geracaoEnvioReceita.current[receitaId] ?? 0) + 1;
    geracaoEnvioReceita.current[receitaId] = geracao;
    atualizarConfiguracaoEnvio(receitaId, { carregando: true, erro: undefined, confirmacaoInstrucoes: false });
    try {
      const receita = await obterReceitaNutricional(receitaId);
      if (geracaoEnvioReceita.current[receitaId] !== geracao || pacienteIdAtual.current !== pacienteDaConsulta || !selecionadasCompartilhar.includes(receitaId) || contextoAtual.current.desabilitado) return;
      if (receita.versaoAtual !== resumo.versaoAtual || receita.alimentosIndisponiveis.length || !receita.metadados?.baseQuantidades) {
        atualizarConfiguracaoEnvio(receitaId, { carregando: false, erro: 'A receita mudou, tem alimento indisponível ou não possui uma base explícita. Atualize e confira os dados.' }); return;
      }
      const previa = await preverPorcionamentoReceita(receitaId, { versaoEsperada: receita.versaoAtual, porcoesDesejadas: porcoes });
      if (geracaoEnvioReceita.current[receitaId] !== geracao || pacienteIdAtual.current !== pacienteDaConsulta || !selecionadasCompartilhar.includes(receitaId) || contextoAtual.current.desabilitado) return;
      if (previa.estado !== 'calculavel') {
        atualizarConfiguracaoEnvio(receitaId, { carregando: false, erro: 'Não foi possível calcular esta quantidade. Confira base, rendimento e ingredientes.' }); return;
      }
      atualizarConfiguracaoEnvio(receitaId, { modo: 'porcionado', carregando: false, previa, receita, instrucoes: receita.instrucoes ?? '', confirmacaoInstrucoes: false, erro: undefined });
    } catch (falha) {
      if (geracaoEnvioReceita.current[receitaId] === geracao && pacienteIdAtual.current === pacienteDaConsulta) {
        atualizarConfiguracaoEnvio(receitaId, { carregando: false, previa: undefined, receita: undefined, confirmacaoInstrucoes: false, erro: mensagemFalhaInterface(falha, 'Não foi possível gerar a prévia de envio.') });
      }
    }
  }

  async function retirarEnvio() {
    if (!compartilhamentoRetirar) return;
    const pacienteDoEnvio = pacienteId;
    setOcupado('compartilhando'); setErro(null);
    try {
      await retirarCompartilhamentoReceita(compartilhamentoRetirar.id);
      if (pacienteIdAtual.current !== pacienteDoEnvio) return;
      setCompartilhamentoRetirar(null); setAviso('Acesso do paciente revogado; o histórico foi preservado.');
      await carregarEnviosEConsentimento();
    } catch (falha) { if (pacienteIdAtual.current === pacienteDoEnvio) setErro(mensagemFalhaInterface(falha, 'Não foi possível retirar este compartilhamento.')); }
    finally { if (pacienteIdAtual.current === pacienteDoEnvio) setOcupado(null); }
  }

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UtensilsCrossed aria-hidden="true" size={17} className="text-primaria" />
          <div>
            <h3 className="text-sm font-semibold text-tinta">Receitas e refeições prontas</h3>
            <p className="text-sm text-texto-suave">Insira itens no rascunho ou salve uma refeição para reutilizar.</p>
          </div>
        </div>
        <Botao type="button" tamanho="sm" onClick={() => void carregar()} disabled={desabilitado || ocupado !== null}>
          <BookOpenCheck size={15} /> Atualizar biblioteca
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">{aviso}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-filtro-categoria`}>
          Filtrar por categoria
          <Campo id={`${id}-filtro-categoria`} value={filtroCategoria} onChange={(evento) => { setFiltroCategoria(evento.target.value); setPaginaBiblioteca(1); }} maxLength={80} placeholder="Todas as categorias" disabled={desabilitado || ocupado !== null} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-filtro-etiqueta`}>
          Filtrar por etiqueta interna
          <Campo id={`${id}-filtro-etiqueta`} value={filtroEtiqueta} onChange={(evento) => { setFiltroEtiqueta(evento.target.value); setPaginaBiblioteca(1); }} maxLength={40} placeholder="Todas as etiquetas" disabled={desabilitado || ocupado !== null} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-filtro-origem`}>
          Escopo da biblioteca
          <Selecao id={`${id}-filtro-origem`} value={filtroOrigem} onChange={(evento) => { setFiltroOrigem(evento.target.value as typeof filtroOrigem); setPaginaBiblioteca(1); }} disabled={desabilitado || ocupado !== null}>
            <option value="">Pessoal e clínica</option><option value="pessoal">Pessoal</option><option value="clinica">Clínica</option>
          </Selecao>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-filtro-tipo`}>
          Tipo
          <Selecao id={`${id}-filtro-tipo`} value={filtroTipo} onChange={(evento) => { setFiltroTipo(evento.target.value as typeof filtroTipo); setPaginaBiblioteca(1); }} disabled={desabilitado || ocupado !== null}>
            <option value="">Todos os tipos</option><option value="receita">Receita</option><option value="refeicao_pronta">Refeição pronta</option>
          </Selecao>
        </label>
      </div>
      {filtroCategoria || filtroEtiqueta || filtroOrigem || filtroTipo ? <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => { setFiltroCategoria(''); setFiltroEtiqueta(''); setFiltroOrigem(''); setFiltroTipo(''); setPaginaBiblioteca(1); }} disabled={desabilitado || ocupado !== null}>Limpar filtros</Botao> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-end">
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-selecionada`}>
          Biblioteca
          <Selecao id={`${id}-selecionada`} value={selecionada} onChange={(evento) => { setSelecionada(evento.target.value); setPorcoesDesejadas('1'); setPreviaAplicacao(null); }} disabled={desabilitado || ocupado !== null || !itens.length}>
            <option value="">{ocupado === 'carregando' ? 'Carregando...' : itens.length ? 'Escolha uma receita' : 'Nenhum item salvo'}</option>
            {itens.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.categoria ?? 'Sem categoria'} - {ROTULO_TIPO[item.tipo]} - {item.totalItens} item(ns)</option>)}
          </Selecao>
        </label>
        {receitaAtual?.metadados?.baseQuantidades ? <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-porcoes-insercao`}>
          Porções para inserir
          <Campo id={`${id}-porcoes-insercao`} type="number" min="0.001" max="1000" step="any" inputMode="decimal" value={porcoesDesejadas} onChange={(evento) => setPorcoesDesejadas(evento.target.value)} disabled={desabilitado || ocupado !== null} aria-describedby={`${id}-porcoes-ajuda`} />
          <span id={`${id}-porcoes-ajuda`} className="font-normal normal-case">A quantidade será calculada pelo servidor e conferida antes de entrar no rascunho.</span>
        </label> : null}
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-destino`}>
          Inserir na refeição
          <Selecao id={`${id}-destino`} value={refeicaoDestinoAtual} onChange={(evento) => { setRefeicaoDestino(evento.target.value); setPreviaAplicacao(null); }} disabled={desabilitado || ocupado !== null}>
            {refeicoesAtuais.map((refeicao, indice) => <option key={refeicao.chave} value={refeicao.chave}>{refeicao.nome.trim() || `Refeicao ${indice + 1}`}</option>)}
          </Selecao>
        </label>
        <div className="flex flex-wrap gap-2">
          <Botao type="button" onClick={() => void aplicar()} carregando={ocupado === 'aplicando'} disabled={desabilitado || !selecionada || !refeicaoDestinoAtual || ocupado !== null}>
            <Plus size={16} /> Inserir
          </Botao>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setConfirmarArquivo(true)} disabled={desabilitado || !receitaAtual || ocupado !== null} aria-label="Arquivar item selecionado da biblioteca">
            <Archive size={15} /> Arquivar
          </Botao>
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => void editarSelecionada()} disabled={desabilitado || !receitaAtual || ocupado !== null}>Editar</Botao>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite">{totalBiblioteca} receita(s) · página {paginaBiblioteca} de {Math.max(1, Math.ceil(totalBiblioteca / 25))}</p>
        <div className="flex gap-2">
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => setPaginaBiblioteca((atual) => Math.max(1, atual - 1))} disabled={desabilitado || ocupado !== null || paginaBiblioteca <= 1}>Anterior</Botao>
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => setPaginaBiblioteca((atual) => Math.min(Math.ceil(totalBiblioteca / 25), atual + 1))} disabled={desabilitado || ocupado !== null || paginaBiblioteca >= Math.ceil(totalBiblioteca / 25)}>Próxima</Botao>
        </div>
      </div>

      <fieldset className="grid gap-3 border-t border-linha pt-3">
        <legend className="px-1 text-sm font-semibold text-tinta">{idEmEdicao ? `Editar receita · versão ${versaoEmEdicao}` : 'Salvar refeição como receita'}</legend>
        {!idEmEdicao ? <label className="grid max-w-xl gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-origem-receita`}>
          Refeição de origem
          <Selecao id={`${id}-origem-receita`} value={refeicaoOrigemAtual} onChange={(evento) => setRefeicaoOrigem(evento.target.value)} disabled={desabilitado || ocupado !== null || !refeicoesAtuais.length}>
            {refeicoesAtuais.map((refeicao, indice) => <option key={refeicao.chave} value={refeicao.chave}>{refeicao.nome.trim() || `Refeição ${indice + 1}`}</option>)}
          </Selecao>
          <span className="font-normal normal-case">Os alimentos serão copiados dessa refeição para a nova versão da receita.</span>
        </label> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-nome`}>
            Nome
            <Campo id={`${id}-nome`} value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={180} disabled={desabilitado || ocupado !== null} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-tipo`}>
            Tipo
            <Selecao id={`${id}-tipo`} value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="receita">Receita</option>
              <option value="refeicao_pronta">Refeição pronta</option>
            </Selecao>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-categoria`}>
            Categoria interna
            <Campo id={`${id}-categoria`} value={categoria} onChange={(evento) => setCategoria(evento.target.value)} maxLength={80} aria-describedby={`${id}-categoria-ajuda`} disabled={desabilitado || ocupado !== null} />
            <span id={`${id}-categoria-ajuda`} className="font-normal normal-case">Usada somente pela clínica; não aparece ao paciente.</span>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-origem`}>
            Visibilidade
            <Selecao id={`${id}-origem`} value={origem} onChange={(evento) => setOrigem(evento.target.value as OrigemReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="pessoal">Só para mim</option>
              <option value="clinica">Compartilhar com a clínica</option>
            </Selecao>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-instrucoes`}>
          Instrucoes de preparo (opcional)
          <AreaTexto id={`${id}-instrucoes`} value={instrucoes} onChange={(evento) => setInstrucoes(evento.target.value)} maxLength={4000} disabled={desabilitado || ocupado !== null} />
        </label>
        <fieldset className="grid gap-3 rounded border border-linha p-3">
          <legend className="px-1 text-sm font-semibold">Porções e organização</legend>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-base-quantidades`}>
            Base das quantidades
            <Selecao id={`${id}-base-quantidades`} value={baseQuantidades} disabled={desabilitado || ocupado !== null} onChange={(evento) => {
              const novaBase = evento.target.value as typeof baseQuantidades;
              const possuiItens = (idEmEdicao ? itensEmEdicao : refeicoesAtuais.find((refeicao) => refeicao.chave === refeicaoOrigemAtual)?.itens ?? []).length > 0;
              if (possuiItens && baseQuantidades !== novaBase) { setBaseProposta(novaBase); setConfirmarMudancaBase(true); }
              else setBaseQuantidades(novaBase);
            }}>
              <option value="">Não informada</option>
              <option value="receita_inteira">Receita inteira</option>
              <option value="por_porcao">Por porção</option>
            </Selecao>
            <span className="font-normal normal-case">Ao mudar ou remover a base, os números atuais são reinterpretados; o sistema não converte quantidades.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-rendimento`}>Rendimento (porções)<Campo id={`${id}-rendimento`} type="number" min="1" max="1000" step="1" value={rendimentoPorcoes} onChange={(e) => setRendimentoPorcoes(e.target.value)} disabled={desabilitado || ocupado !== null} /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-tempo`}>Preparo total (minutos)<Campo id={`${id}-tempo`} type="number" min="1" max="10080" step="1" value={tempoPreparoMinutos} onChange={(e) => setTempoPreparoMinutos(e.target.value)} disabled={desabilitado || ocupado !== null} /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-etiquetas`}>Etiquetas internas<Campo id={`${id}-etiquetas`} value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} maxLength={410} placeholder="Ex.: prático, lanche" disabled={desabilitado || ocupado !== null} /><span className="font-normal normal-case">Use somente para organização; não inclua dados do paciente.</span></label>
          </div>
        </fieldset>
        {idEmEdicao ? <p className="text-sm text-texto-suave">Itens e quantidades preservados da versão selecionada. Para criar outro conteúdo, cancele a edição e salve a refeição atual.</p> : null}
        <div className="flex gap-2">
          {idEmEdicao ? <Botao type="button" variante="secundario" onClick={() => { setIdEmEdicao(null); setVersaoEmEdicao(null); setItensEmEdicao([]); setNome(''); setCategoria(''); setInstrucoes(''); setBaseQuantidades(''); setRendimentoPorcoes(''); setTempoPreparoMinutos(''); setEtiquetas(''); }}>Cancelar edição</Botao> : null}
          <Botao type="button" onClick={() => void salvar()} carregando={ocupado === 'salvando'} disabled={desabilitado || (!idEmEdicao && !refeicaoDestino) || ocupado !== null}><Plus size={16} /> {idEmEdicao ? 'Salvar nova versão' : 'Salvar na biblioteca'}</Botao>
        </div>
      </fieldset>

      <section className="grid gap-3 border-t border-linha pt-3" aria-labelledby={`${id}-compartilhar-titulo`}>
        <div><h4 id={`${id}-compartilhar-titulo`} className="text-sm font-semibold">Compartilhar com este paciente</h4><p className="text-sm text-texto-suave">Escolha até 10 receitas. O conteúdo ficará somente no portal autenticado.</p></div>
        {selecionadasCompartilhar.length ? <ul className="grid gap-1 rounded border border-linha p-3 text-sm" aria-label="Resumo das receitas selecionadas para envio">
          {selecionadasCompartilhar.map((receitaId) => { const item = receitasConhecidas[receitaId] ?? itens.find((receita) => receita.id === receitaId); return <li key={receitaId}>{item ? `${item.nome} · versão ${item.versaoAtual}` : 'Receita selecionada — dados indisponíveis'}</li>; })}
        </ul> : null}
        <div className="grid gap-2">{itens.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selecionadasCompartilhar.includes(item.id)} disabled={desabilitado || ocupado !== null || !item.categoria || (!selecionadasCompartilhar.includes(item.id) && selecionadasCompartilhar.length >= 10)} onChange={(evento) => {
            geracaoEnvioReceita.current[item.id] = (geracaoEnvioReceita.current[item.id] ?? 0) + 1;
            chaveIdempotenciaCompartilhamento.current = '';
            if (evento.target.checked) setSelecionadasCompartilhar((atual) => [...atual, item.id]);
            else {
              setSelecionadasCompartilhar((atual) => atual.filter((receitaId) => receitaId !== item.id));
              setConfiguracoesEnvio((atual) => { const proxima = { ...atual }; delete proxima[item.id]; return proxima; });
            }
          }} />
          <span>{item.nome} · {item.categoria ?? 'Sem categoria — classifique antes de compartilhar'} · versão {item.versaoAtual}</span>
        </label>)}</div>
        {selecionadasCompartilhar.map((receitaId) => {
          const resumo = receitasConhecidas[receitaId];
          const config = configuracoesVisiveis[receitaId] ?? { modo: 'quantidades_cadastradas' as const, porcoes: '1', confirmacaoInstrucoes: false };
          if (!resumo) return <p key={receitaId} role="status">Atualize a biblioteca para conferir esta receita antes de continuar.</p>;
          return <fieldset key={receitaId} className="grid gap-3 rounded border border-linha p-3" aria-label={`Quantidade para ${resumo.nome}`}>
            <legend className="px-1 text-sm font-semibold">{resumo.nome} · versão {resumo.versaoAtual}</legend>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name={`${id}-envio-${receitaId}`} checked={config.modo === 'quantidades_cadastradas'} disabled={desabilitado || ocupado !== null || config.carregando} onChange={() => { geracaoEnvioReceita.current[receitaId] = (geracaoEnvioReceita.current[receitaId] ?? 0) + 1; atualizarConfiguracaoEnvio(receitaId, { modo: 'quantidades_cadastradas', previa: undefined, receita: undefined, confirmacaoInstrucoes: false, erro: undefined }); }} /><span>Usar as quantidades cadastradas</span></label>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name={`${id}-envio-${receitaId}`} checked={config.modo === 'porcionado'} disabled={desabilitado || ocupado !== null || config.carregando || !resumo.metadados?.baseQuantidades} onChange={() => { geracaoEnvioReceita.current[receitaId] = (geracaoEnvioReceita.current[receitaId] ?? 0) + 1; atualizarConfiguracaoEnvio(receitaId, { modo: 'porcionado', porcoes: '1', previa: undefined, receita: undefined, instrucoes: undefined, confirmacaoInstrucoes: false, erro: undefined }); }} /><span>Ajustar quantidades por porções</span></label>
            {!resumo.metadados?.baseQuantidades ? <p className="text-sm text-texto-suave">Esta receita não tem uma base explícita; somente as quantidades cadastradas podem ser enviadas.</p> : null}
            {config.modo === 'porcionado' ? <div className="grid gap-3 border-l-2 border-primaria pl-3">
              <label className="grid max-w-xs gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-envio-porcoes-${receitaId}`}>Porções para este envio<Campo id={`${id}-envio-porcoes-${receitaId}`} type="number" min="0.001" max="1000" step="any" inputMode="decimal" value={config.porcoes} disabled={desabilitado || ocupado !== null || config.carregando} onChange={(evento) => { geracaoEnvioReceita.current[receitaId] = (geracaoEnvioReceita.current[receitaId] ?? 0) + 1; atualizarConfiguracaoEnvio(receitaId, { porcoes: evento.target.value, previa: undefined, receita: undefined, confirmacaoInstrucoes: false, erro: undefined }); }} /></label>
              <Botao type="button" variante="secundario" tamanho="sm" onClick={() => void previsualizarEnvio(receitaId)} carregando={config.carregando} disabled={desabilitado || ocupado !== null || config.carregando}>Pré-visualizar quantidades</Botao>
              {config.erro ? <p role="alert" className="text-sm text-perigo-forte">{config.erro}</p> : null}
              {config.previa ? <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><h5 className="font-semibold">Ingredientes para {formatarNumero(config.previa.porcoesDesejadas)} porções</h5><ul className="grid gap-1 text-sm">{config.previa.itens.map((item, indice) => <li key={`${indice}-${item.alimentoComposicaoId ?? item.descricao ?? 'item'}`}><span>{item.descricao ?? `Ingrediente ${indice + 1}`}</span>: {formatarNumero(item.quantidade)} {item.unidade} ({formatarNumero(item.porcaoGramas)} g)</li>)}</ul></div>
                  <label className="grid gap-1 text-sm font-medium" htmlFor={`${id}-envio-instrucoes-${receitaId}`}>Instruções desta cópia do envio<AreaTexto id={`${id}-envio-instrucoes-${receitaId}`} value={config.instrucoes ?? ''} maxLength={4000} disabled={desabilitado || ocupado !== null} onChange={(evento) => atualizarConfiguracaoEnvio(receitaId, { instrucoes: evento.target.value, confirmacaoInstrucoes: false })} /><span className="text-xs font-normal text-texto-suave">O texto original foi copiado. Números no texto não são reescritos automaticamente.</span></label>
                </div>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={config.confirmacaoInstrucoes} disabled={desabilitado || ocupado !== null} onChange={(evento) => atualizarConfiguracaoEnvio(receitaId, { confirmacaoInstrucoes: evento.target.checked })} /><span>Conferi as quantidades e as instruções desta cópia do envio.</span></label>
              </> : null}
            </div> : null}
          </fieldset>;
        })}
        <fieldset className="flex flex-wrap gap-4 text-sm" aria-label="Canais de aviso autorizados pelo paciente">
          <legend className="text-xs font-semibold uppercase text-texto-suave">Avisos externos (opcionais)</legend>
          {(['email', 'whatsapp', 'push'] as const).filter((canal) => consentimentosPaciente[canal]).map((canal) => <label key={canal} className="flex items-center gap-2">
          <input type="checkbox" checked={canaisCompartilhamento.includes(canal)} disabled={desabilitado || ocupado !== null} onChange={(evento) => { chaveIdempotenciaCompartilhamento.current = ''; setCanaisCompartilhamento((atual) => evento.target.checked ? [...atual, canal] : atual.filter((item) => item !== canal)); }} />
            {canal === 'email' ? 'E-mail' : canal === 'whatsapp' ? 'WhatsApp' : 'Push'}
          </label>)}
          {!(['email', 'whatsapp', 'push'] as const).some((canal) => consentimentosPaciente[canal]) ? <span className="text-texto-suave">Nenhum canal externo autorizado; a receita ficará no portal.</span> : null}
        </fieldset>
        <label className="grid max-w-sm gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-agendamento`}>
          Enviar agora ou agendar
          <input id={`${id}-agendamento`} type="datetime-local" value={agendadoPara} onChange={(evento) => { chaveIdempotenciaCompartilhamento.current = ''; setAgendadoPara(evento.target.value); }} disabled={desabilitado || ocupado !== null} className="rounded-md border border-linha px-3 py-2 text-sm font-normal normal-case" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmacaoRevisaoManual} onChange={(evento) => { chaveIdempotenciaCompartilhamento.current = ''; setConfirmacaoRevisaoManual(evento.target.checked); }} disabled={desabilitado || ocupado !== null} />Confirmo que revisei o conteúdo para este paciente.</label>
        <div><Botao type="button" onClick={() => setConfirmarCompartilhamento(true)} disabled={desabilitado || ocupado !== null || !selecionadasCompartilhar.length || !confirmacaoRevisaoManual || possuiEnvioPorcionadoIncompleto}><Send size={16} /> Revisar e compartilhar ({selecionadasCompartilhar.length}/10)</Botao></div>
        {enviosCarregadosParaPaciente === pacienteId && enviosPaciente.length ? <div className="grid gap-2 border-t border-linha pt-3">
          <h4 className="text-sm font-semibold">Envios para este paciente</h4>
          {enviosPaciente.map((envio) => <article key={envio.id} className="grid gap-2 rounded border border-linha p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{envio.nome}</strong><p className="text-xs text-texto-suave">Versão {envio.versao} · {envio.status === 'ativo' ? 'Disponível no portal' : envio.status === 'agendado' ? 'Agendada' : envio.status === 'substituido' ? 'Substituída' : 'Retirada'}</p></div>
              {envio.status === 'ativo' || envio.status === 'agendado' ? <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setCompartilhamentoRetirar(envio)} disabled={ocupado !== null}>Retirar acesso</Botao> : null}</div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">{envio.entregas.map((entrega) => <li key={entrega.canal}>{entrega.canal === 'portal' ? 'Portal' : entrega.canal} · {entrega.status === 'enviado' ? 'confirmado' : entrega.status === 'incerto' ? 'envio não confirmado' : entrega.status === 'suprimido' ? 'não enviado' : entrega.status === 'pendente' ? 'aguardando' : entrega.status}</li>)}</ul>
            {envio.visualizadoEm ? <p className="text-xs text-texto-suave">Aberta em {new Date(envio.visualizadoEm).toLocaleString('pt-BR')}</p> : null}
          </article>)}
        </div> : null}
      </section>

      <ModalConfirmacao
        aberto={confirmarMudancaBase}
        titulo="Confirmar mudança da base"
        mensagem={`A base será reinterpretada como ${baseProposta === 'por_porcao' ? 'por porção' : baseProposta === 'receita_inteira' ? 'receita inteira' : 'não informada'}. Os valores cadastrados, como ${itensEmEdicao[0] ? `${itensEmEdicao[0].quantidade} ${itensEmEdicao[0].unidade} (${itensEmEdicao[0].porcaoGramas} g)` : `${refeicoesAtuais.find((r) => r.chave === refeicaoOrigemAtual)?.itens[0]?.quantidade ?? '—'} ${refeicoesAtuais.find((r) => r.chave === refeicaoOrigemAtual)?.itens[0]?.unidade ?? ''} (${refeicoesAtuais.find((r) => r.chave === refeicaoOrigemAtual)?.itens[0]?.porcaoGramas ?? '—'} g)`}, não serão convertidos.`}
        rotuloConfirmar="Confirmar base"
        aoCancelar={() => { setConfirmarMudancaBase(false); setBaseProposta(''); }}
        aoConfirmar={() => { setBaseQuantidades(baseProposta); setConfirmarMudancaBase(false); setBaseProposta(''); }}
      />
      <Modal
        aberto={Boolean(previaAplicacao)}
        aoFechar={cancelarPreviaAplicacao}
        titulo="Conferir inserção da receita"
        descricao="Confira a quantidade calculada e o destino. Nada será alterado no plano até confirmar."
        className="max-w-2xl"
      >
        {previaAplicacao ? <div className="grid gap-4">
          <dl className="grid gap-2 rounded-md bg-superficie p-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Receita</dt><dd>{receitaAtual?.nome ?? 'Receita selecionada'} · versão {previaAplicacao.versao}</dd></div>
            <div><dt className="font-semibold">Quantidade</dt><dd>{formatarNumero(previaAplicacao.quantidade)} porções</dd></div>
            <div><dt className="font-semibold">Base cadastrada</dt><dd>{previaAplicacao.dados.baseQuantidades === 'por_porcao' ? 'Por porção' : 'Receita inteira'}</dd></div>
            <div><dt className="font-semibold">Refeição de destino</dt><dd>{refeicoesAtuais.find((refeicao) => refeicao.chave === previaAplicacao.refeicaoDestino)?.nome ?? 'Refeição selecionada'}</dd></div>
          </dl>
          <section aria-labelledby={`${id}-totais-previa`}>
            <h3 id={`${id}-totais-previa`} className="font-semibold">Totais para {formatarNumero(previaAplicacao.dados.denominador.porcoes)} porções</h3>
            <p className="text-sm text-texto-suave">{previaAplicacao.dados.denominador.descricao}; valores calculados sobre as quantidades efetivas dos ingredientes.</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {([
                ['Energia', previaAplicacao.dados.totais.energiaKcal],
                ['Proteínas', previaAplicacao.dados.totais.proteinasG],
                ['Carboidratos', previaAplicacao.dados.totais.carboidratosG],
                ['Gorduras', previaAplicacao.dados.totais.gordurasG]
              ] as const).map(([rotulo, indicador]) => <div key={rotulo} className="rounded border border-linha p-2">
                <dt className="font-medium">{rotulo}</dt>
                <dd>{indicador.estado === 'conhecido' ? `${formatarNumero(indicador.valor)} ${indicador.unidade}` : '—'}</dd>
              </div>)}
            </dl>
            {Object.values(previaAplicacao.dados.totais).some((indicador) => indicador.estado === 'ausente') ? <p role="status" className="mt-2 text-sm text-aviso-forte">Dados incompletos: nutrientes ausentes permanecem desconhecidos e não são tratados como zero.</p> : null}
          </section>
          <section aria-labelledby={`${id}-ingredientes-previa`}>
            <h3 id={`${id}-ingredientes-previa`} className="font-semibold">Ingredientes ajustados</h3>
            <ul id={`${id}-ingredientes-previa`} className="grid gap-2">
              {previaAplicacao.dados.itens.map((item, indice) => <li key={`${indice}-${item.alimentoComposicaoId ?? item.descricao ?? 'ingrediente'}`} className="rounded border border-linha p-3 text-sm">
                <span className="font-medium">{item.descricao ?? `Ingrediente ${indice + 1}`}</span>
                <span className="ml-2">{formatarNumero(item.quantidade)} {item.unidade} · {formatarNumero(item.porcaoGramas)} g</span>
              </li>)}
            </ul>
          </section>
          {previaAplicacao.dados.avisos.length ? <ul className="grid gap-1 text-sm text-aviso-forte" aria-label="Avisos do cálculo">
            {previaAplicacao.dados.avisos.map((aviso, indice) => <li key={`${aviso.codigo}-${indice}`}>A quantidade de um ingrediente exigiu arredondamento. Confira antes de inserir.</li>)}
          </ul> : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-3">
            <Botao type="button" variante="secundario" onClick={cancelarPreviaAplicacao} disabled={ocupado !== null}>Cancelar</Botao>
            <Botao type="button" onClick={() => void confirmarAplicacao()} carregando={ocupado === 'aplicando'} disabled={desabilitado || ocupado !== null}>Confirmar e inserir</Botao>
          </div>
        </div> : null}
      </Modal>
      <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar item da biblioteca"
        mensagem="O item deixara de aparecer para novos rascunhos. Planos já publicados permanecem inalterados."
        rotuloConfirmar="Arquivar"
        confirmando={ocupado === 'arquivando'}
        aoCancelar={() => setConfirmarArquivo(false)}
        aoConfirmar={() => void arquivar()}
      />
      <ModalConfirmacao
        aberto={Boolean(compartilhamentoRetirar)}
        titulo="Retirar receita do portal"
        mensagem={`O paciente perderá o acesso a ${compartilhamentoRetirar?.nome ?? 'esta receita'}. O registro histórico permanecerá na clínica.`}
        rotuloConfirmar="Retirar acesso"
        confirmando={ocupado === 'compartilhando'}
        aoCancelar={() => setCompartilhamentoRetirar(null)}
        aoConfirmar={() => void retirarEnvio()}
      />
      <Modal aberto={confirmarCompartilhamento} aoFechar={() => { if (ocupado !== 'compartilhando') setConfirmarCompartilhamento(false); }} titulo="Confirmar compartilhamento" descricao={`Confira o resumo. As receitas serão disponibilizadas no portal deste paciente${canaisCompartilhamento.length ? `, com aviso por ${canaisCompartilhamento.join(', ')}` : ''}${agendadoPara ? ` em ${new Date(agendadoPara).toLocaleString('pt-BR')}` : ' imediatamente'}. Avisos externos não incluem nomes nem conteúdo.`} className="max-w-2xl">
        <div className="grid gap-4">
          <ul className="grid gap-3">
            {selecionadasCompartilhar.map((receitaId) => {
              const item = receitasConhecidas[receitaId];
              const config = configuracoesVisiveis[receitaId];
              if (!item) return <li key={receitaId} className="rounded border border-linha p-3">Receita atualizada — feche esta conferência e atualize a biblioteca.</li>;
              return <li key={receitaId} className="grid gap-2 rounded border border-linha p-3 text-sm">
                <p className="font-semibold">{item.nome} · versão {item.versaoAtual}</p>
                <p>{config?.modo === 'porcionado' ? `Quantidades ajustadas para ${formatarNumero(Number(config.porcoes))} porções; base ${config.previa?.baseQuantidades === 'por_porcao' ? 'por porção' : 'receita inteira'}.` : 'Quantidades cadastradas, sem ajuste automático.'}</p>
                {config?.modo === 'porcionado' ? <div><h3 className="font-medium">Instruções desta cópia do envio</h3><p className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-superficie p-2">{config.instrucoes || 'Sem instruções para esta cópia.'}</p><p className="mt-1 text-xs text-texto-suave">A receita original e envios anteriores permanecem inalterados.</p></div> : null}
              </li>;
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-3">
            <Botao type="button" variante="secundario" disabled={ocupado === 'compartilhando'} onClick={() => setConfirmarCompartilhamento(false)}>Voltar e revisar</Botao>
            <Botao type="button" carregando={ocupado === 'compartilhando'} disabled={desabilitado || ocupado !== null || !confirmacaoRevisaoManual || possuiEnvioPorcionadoIncompleto} onClick={() => void compartilhar()}>{agendadoPara ? 'Agendar envio' : 'Compartilhar agora'}</Botao>
          </div>
        </div>
      </Modal>
    </section>
  );
}
