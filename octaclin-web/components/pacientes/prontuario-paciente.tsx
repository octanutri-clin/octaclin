'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Download,
  FlaskConical,
  FileText,
  ImageIcon,
  LinkIcon,
  MessageSquareText,
  Paperclip,
  RefreshCcw,
  Ruler,
  Save,
  Send,
  Stethoscope,
  Trash2,
  UploadCloud,
  UserRound,
  Utensils
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Abas } from '@/components/ui/abas';
import { AbaAntropometria } from './aba-antropometria';
import { ResumoAntropometrico } from './resumo-antropometrico';
import { AbaExamesLaboratoriais } from './aba-exames-laboratoriais';
import { AbaEvolucaoFotografica } from './aba-evolucao-fotografica';
import { AbaCondutasTerapeuticas } from './aba-condutas-terapeuticas';
import { AbaDocumentos, ConsultaConcluidaOpcao } from './aba-documentos';
import { PerfilCadastroPaciente } from './perfil-cadastro-paciente';
import { PlanoAlimentarProfissional } from './plano-alimentar-profissional';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { obterSessao } from '@/lib/auth-api';
import { listarProfissionais, type ProfissionalResumo } from '@/lib/cadastros-api';
import {
  criarMaterial,
  enviarMaterialPaciente,
  listarMateriais,
  listarMateriaisPaciente,
  type EnvioMaterialPacienteApi,
  type MaterialEducativoApi,
  type TipoMaterialEducativoApi
} from '@/lib/materiais-api';
import {
  confirmarUploadMidia,
  excluirArquivoMidia,
  listarArquivosMidia,
  obterAcessoArquivoMidia,
  solicitarUploadMidia,
  type ArquivoMidiaApi,
  type CategoriaAnexoClinico,
  type TipoMidiaMobile
} from '@/lib/mobile-api';
import {
  criarEvolucaoClinica,
  criarTarefaAcompanhamento,
  listarLinhaDoTempoPaginada,
  obterProntuarioPaciente,
  type CategoriaTarefaAcompanhamentoApi,
  type EventoProntuarioPacienteApi,
  type PaginaLinhaDoTempoProntuarioApi,
  type PrioridadeTarefaAcompanhamentoApi,
  type ProntuarioPacienteApi,
  type TipoEventoProntuarioPaciente,
  type TipoEvolucaoClinicaApi
} from '@/lib/prontuario-api';

interface FormularioEvolucao {
  titulo: string;
  tipo: TipoEvolucaoClinicaApi;
  conteudo: string;
}

interface FormularioTarefa {
  titulo: string;
  categoria: CategoriaTarefaAcompanhamentoApi;
  prioridade: PrioridadeTarefaAcompanhamentoApi;
  vencimentoEm: string;
  descricao: string;
}

interface FormularioMaterial {
  titulo: string;
  tipo: TipoMaterialEducativoApi;
  categoria: string;
  url: string;
  resumo: string;
  conteudo: string;
}

interface FormularioEnvioMaterial {
  materialId: string;
  observacao: string;
}

interface FiltrosHistorico {
  tipo?: TipoEventoProntuarioPaciente;
  inicio?: string;
  fim?: string;
  responsavelId?: string;
}

type AbaProntuario =
  | 'resumo'
  | 'evolucoes'
  | 'acompanhamento'
  | 'plano_alimentar'
  | 'condutas_terapeuticas'
  | 'antropometria'
  | 'exames_laboratoriais'
  | 'evolucao_fotografica'
  | 'formularios'
  | 'documentos'
  | 'mensagens'
  | 'materiais'
  | 'anexos'
  | 'historico'
  | 'financeiro';

type AreaProntuario = 'resumo' | 'atendimentos' | 'avaliacoes' | 'plano' | 'documentos' | 'financeiro';

const abasProntuario: Array<{ id: AbaProntuario; rotulo: string; permissao?: string }> = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'evolucoes', rotulo: 'Evolucoes' },
  { id: 'acompanhamento', rotulo: 'Acompanhamento' },
  { id: 'plano_alimentar', rotulo: 'Plano alimentar', permissao: 'planos_alimentares.ler' },
  { id: 'condutas_terapeuticas', rotulo: 'Condutas terapeuticas' },
  { id: 'antropometria', rotulo: 'Antropometria' },
  { id: 'exames_laboratoriais', rotulo: 'Exames laboratoriais' },
  { id: 'evolucao_fotografica', rotulo: 'Evolucao fotografica' },
  { id: 'formularios', rotulo: 'Formularios' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'mensagens', rotulo: 'Mensagens' },
  { id: 'materiais', rotulo: 'Materiais' },
  { id: 'anexos', rotulo: 'Anexos' },
  { id: 'historico', rotulo: 'Historico' }
];

const areasProntuario: Array<{ id: AreaProntuario; rotulo: string; abaInicial: AbaProntuario; permissao?: string }> = [
  { id: 'resumo', rotulo: 'Resumo', abaInicial: 'resumo' },
  { id: 'atendimentos', rotulo: 'Atendimentos', abaInicial: 'evolucoes' },
  { id: 'avaliacoes', rotulo: 'Avaliacoes', abaInicial: 'antropometria' },
  { id: 'plano', rotulo: 'Plano', abaInicial: 'acompanhamento' },
  { id: 'documentos', rotulo: 'Documentos', abaInicial: 'documentos' },
  { id: 'financeiro', rotulo: 'Financeiro', abaInicial: 'financeiro', permissao: 'agenda.financeiro.ler' }
];

const areaPorAba: Record<AbaProntuario, AreaProntuario> = {
  resumo: 'resumo',
  evolucoes: 'atendimentos',
  historico: 'atendimentos',
  mensagens: 'atendimentos',
  antropometria: 'avaliacoes',
  exames_laboratoriais: 'avaliacoes',
  evolucao_fotografica: 'avaliacoes',
  formularios: 'avaliacoes',
  acompanhamento: 'plano',
  plano_alimentar: 'plano',
  condutas_terapeuticas: 'plano',
  materiais: 'plano',
  documentos: 'documentos',
  anexos: 'documentos',
  financeiro: 'financeiro'
};

const formularioEvolucaoInicial: FormularioEvolucao = {
  titulo: '',
  tipo: 'observacao',
  conteudo: ''
};

const formularioTarefaInicial: FormularioTarefa = {
  titulo: '',
  categoria: 'tarefa',
  prioridade: 'media',
  vencimentoEm: '',
  descricao: ''
};

const formularioMaterialInicial: FormularioMaterial = {
  titulo: '',
  tipo: 'link',
  categoria: '',
  url: '',
  resumo: '',
  conteudo: ''
};

const formularioEnvioMaterialInicial: FormularioEnvioMaterial = {
  materialId: '',
  observacao: ''
};

function formatarDataHora(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(data);
}

function formatarTamanho(bytes: string) {
  const valor = Number(bytes);
  if (!Number.isFinite(valor)) return '-';
  if (valor < 1024 * 1024) return `${Math.max(1, Math.round(valor / 1024))} KB`;
  return `${(valor / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function tipoMidiaDoArquivo(arquivo: File): TipoMidiaMobile {
  if (arquivo.type.startsWith('image/')) return 'imagem';
  if (arquivo.type === 'application/pdf') return 'documento';
  throw new Error('Selecione uma imagem JPEG, PNG, WebP ou um PDF.');
}

function rotuloTipo(tipo: EventoProntuarioPacienteApi['tipo']) {
  const rotulos: Record<EventoProntuarioPacienteApi['tipo'], string> = {
    consulta: 'Consulta',
    formulario: 'Formulario',
    resposta_formulario: 'Resposta',
    checkin_rapido: 'Check-in rapido',
    mensagem: 'Mensagem',
    evolucao_clinica: 'Evolucao',
    tarefa_acompanhamento: 'Tarefa',
    plano_alimentar_publicado: 'Plano alimentar',
    avaliacao_antropometrica: 'Antropometria',
    documento_emitido: 'Documento',
    anexo_confirmado: 'Anexo',
    exame_laboratorial: 'Exame laboratorial',
    evolucao_fotografica: 'Evolucao fotografica',
    evento_financeiro: 'Financeiro'
  };
  return rotulos[tipo];
}

function classeStatus(status?: string) {
  if (status === 'falhou' || status === 'cancelada') return 'bg-perigo-suave text-perigo';
  if (status === 'respondido' || status === 'finalizado' || status === 'agendada') return 'bg-sucesso-suave text-sucesso';
  return 'bg-superficie-hover text-texto-suave';
}

function iconeEvento(tipo: EventoProntuarioPacienteApi['tipo']) {
  if (tipo === 'consulta') return CalendarDays;
  if (tipo === 'mensagem') return MessageSquareText;
  if (tipo === 'evolucao_clinica') return Stethoscope;
  if (tipo === 'tarefa_acompanhamento') return CheckSquare;
  if (tipo === 'plano_alimentar_publicado') return Utensils;
  if (tipo === 'avaliacao_antropometrica') return Ruler;
  if (tipo === 'documento_emitido') return FileText;
  if (tipo === 'anexo_confirmado') return Paperclip;
  if (tipo === 'exame_laboratorial') return FlaskConical;
  if (tipo === 'evolucao_fotografica') return ImageIcon;
  if (tipo === 'evento_financeiro') return BadgeDollarSign;
  return ClipboardList;
}

function autoriaEvento(evento: EventoProntuarioPacienteApi, profissionais: ProfissionalResumo[]) {
  const autor = profissionais.find((profissional) => profissional.usuarioId === evento.autorUsuarioId);
  const responsavel = profissionais.find((profissional) => profissional.id === evento.responsavelId);
  const partes = evento.origem ? [`Origem: ${evento.origem}`] : [];
  if (autor) partes.push(`Autor: ${autor.nome}`);
  else if (evento.autorUsuarioId) {
    const autoriaDoPaciente = evento.tipo === 'resposta_formulario'
      || evento.tipo === 'checkin_rapido'
      || (evento.tipo === 'mensagem' && evento.status === 'recebido');
    partes.push(autoriaDoPaciente ? 'Autor: paciente' : 'Autor: equipe clinica');
  }
  if (responsavel && responsavel.id !== autor?.id) partes.push(`Responsavel: ${responsavel.nome}`);
  return partes.join(' - ');
}

function LinhaDoTempo({
  eventos,
  aoAbrirEvento,
  profissionais = []
}: {
  eventos: EventoProntuarioPacienteApi[];
  aoAbrirEvento?: (evento: EventoProntuarioPacienteApi) => void;
  profissionais?: ProfissionalResumo[];
}) {
  if (!eventos.length) {
    return <EstadoVazio titulo="Sem eventos no prontuario" descricao="Agenda, formularios, respostas e mensagens aparecerao aqui." />;
  }

  return (
    <div className="grid gap-3">
      {eventos.map((evento) => {
        const Icone = iconeEvento(evento.tipo);
        const autoria = autoriaEvento(evento, profissionais);
        return (
          <article key={`${evento.tipo}-${evento.id}`} className="grid gap-2 rounded-md border border-linha bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
                  <Icone size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-texto-suave">{rotuloTipo(evento.tipo)}</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-tinta">{evento.titulo}</h3>
                  {evento.descricao ? <p className="mt-1 break-words text-sm text-texto-suave">{evento.descricao}</p> : null}
                  {autoria ? <p className="mt-1 break-words text-xs text-texto-suave">{autoria}</p> : null}
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs text-texto-suave">{formatarDataHora(evento.data)}</p>
                {evento.status ? (
                  <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${classeStatus(evento.status)}`}>
                    {evento.status}
                  </span>
                ) : null}
                {aoAbrirEvento ? (
                  <button
                    type="button"
                    onClick={() => aoAbrirEvento(evento)}
                    className="mt-2 block text-xs font-semibold text-primaria hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                    aria-label={`Abrir detalhe de ${evento.titulo}`}
                  >
                    Abrir detalhe
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ProntuarioPaciente({ pacienteId }: { pacienteId: string }) {
  const [dados, setDados] = useState<ProntuarioPacienteApi | null>(null);
  const [paginaHistorico, setPaginaHistorico] = useState<PaginaLinhaDoTempoProntuarioApi | null>(null);
  const [materiais, setMateriais] = useState<MaterialEducativoApi[]>([]);
  const [materiaisPaciente, setMateriaisPaciente] = useState<EnvioMaterialPacienteApi[]>([]);
  const [anexos, setAnexos] = useState<ArquivoMidiaApi[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [salvandoEvolucao, setSalvandoEvolucao] = useState(false);
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [salvandoMaterial, setSalvandoMaterial] = useState(false);
  const [enviandoMaterial, setEnviandoMaterial] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [excluindoAnexo, setExcluindoAnexo] = useState(false);
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);
  const [categoriaAnexo, setCategoriaAnexo] = useState<CategoriaAnexoClinico>('exame');
  const [consultaVinculadaId, setConsultaVinculadaId] = useState('');
  const [filtroCategoriaAnexo, setFiltroCategoriaAnexo] = useState<CategoriaAnexoClinico | 'todas'>('todas');
  const [anexoParaExcluir, setAnexoParaExcluir] = useState<ArquivoMidiaApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formularioEvolucao, setFormularioEvolucao] = useState<FormularioEvolucao>(formularioEvolucaoInicial);
  const [formularioTarefa, setFormularioTarefa] = useState<FormularioTarefa>(formularioTarefaInicial);
  const [formularioMaterial, setFormularioMaterial] = useState<FormularioMaterial>(formularioMaterialInicial);
  const [formularioEnvioMaterial, setFormularioEnvioMaterial] = useState<FormularioEnvioMaterial>(formularioEnvioMaterialInicial);
  const [abaAtiva, setAbaAtiva] = useState<AbaProntuario>('resumo');
  const [historicoSolicitado, setHistoricoSolicitado] = useState(false);
  const [tipoHistorico, setTipoHistorico] = useState<TipoEventoProntuarioPaciente | 'todos'>('todos');
  const [inicioHistorico, setInicioHistorico] = useState('');
  const [fimHistorico, setFimHistorico] = useState('');
  const [responsavelHistorico, setResponsavelHistorico] = useState('');
  const [areaAtiva, setAreaAtiva] = useState<AreaProntuario>('resumo');
  const [planoAlimentarNaoSalvo, setPlanoAlimentarNaoSalvo] = useState(false);
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [saidaPendente, setSaidaPendente] = useState<
    { tipo: 'voltar' } | { tipo: 'agenda' } | { tipo: 'aba'; id: AbaProntuario } | null
  >(null);
  const router = useRouter();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [prontuario, biblioteca, enviados, anexosPaciente] = await Promise.all([
        obterProntuarioPaciente(pacienteId),
        listarMateriais(),
        listarMateriaisPaciente(pacienteId),
        listarArquivosMidia(pacienteId)
      ]);
      setDados(prontuario);
      setMateriais(biblioteca);
      setMateriaisPaciente(enviados);
      setAnexos(anexosPaciente);
      setFormularioEnvioMaterial((atual) => ({
        ...atual,
        materialId: atual.materialId || biblioteca[0]?.id || ''
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar prontuario.');
    } finally {
      setCarregando(false);
    }
  }, [pacienteId]);

  const filtrosHistorico = useMemo<FiltrosHistorico>(
    () => ({
      tipo: tipoHistorico === 'todos' ? undefined : tipoHistorico,
      inicio: inicioHistorico ? `${inicioHistorico}T00:00:00.000Z` : undefined,
      fim: fimHistorico ? `${fimHistorico}T23:59:59.999Z` : undefined,
      responsavelId: responsavelHistorico || undefined
    }),
    [fimHistorico, inicioHistorico, responsavelHistorico, tipoHistorico]
  );

  const carregarHistorico = useCallback(async (
    cursor?: string,
    filtros = filtrosHistorico
  ) => {
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      const pagina = await listarLinhaDoTempoPaginada(pacienteId, { cursor, limite: 20, ...filtros });
      setPaginaHistorico((anterior) =>
        cursor && anterior
          ? { ...pagina, itens: [...anterior.itens, ...pagina.itens] }
          : pagina
      );
    } catch (erroAtual) {
      setErroHistorico(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar a linha do tempo.');
    } finally {
      setCarregandoHistorico(false);
    }
  }, [filtrosHistorico, pacienteId]);

  async function registrarEvolucao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoEvolucao(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarEvolucaoClinica(pacienteId, {
        titulo: formularioEvolucao.titulo.trim(),
        conteudo: formularioEvolucao.conteudo.trim(),
        tipo: formularioEvolucao.tipo,
        visibilidade: 'privada'
      });
      setFormularioEvolucao(formularioEvolucaoInicial);
      setSucesso('Evolucao clinica registrada.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar evolucao clinica.');
    } finally {
      setSalvandoEvolucao(false);
    }
  }

  async function registrarTarefa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoTarefa(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarTarefaAcompanhamento(pacienteId, {
        titulo: formularioTarefa.titulo.trim(),
        descricao: formularioTarefa.descricao.trim() || undefined,
        categoria: formularioTarefa.categoria,
        prioridade: formularioTarefa.prioridade,
        vencimentoEm: formularioTarefa.vencimentoEm ? new Date(formularioTarefa.vencimentoEm).toISOString() : undefined
      });
      setFormularioTarefa(formularioTarefaInicial);
      setSucesso('Tarefa de acompanhamento prescrita.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao prescrever tarefa de acompanhamento.');
    } finally {
      setSalvandoTarefa(false);
    }
  }

  async function registrarMaterial(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoMaterial(true);
    setErro(null);
    setSucesso(null);
    try {
      const material = await criarMaterial({
        titulo: formularioMaterial.titulo.trim(),
        tipo: formularioMaterial.tipo,
        categoria: formularioMaterial.categoria.trim() || undefined,
        url: formularioMaterial.url.trim() || undefined,
        resumo: formularioMaterial.resumo.trim() || undefined,
        conteudo: formularioMaterial.conteudo.trim() || undefined
      });
      setFormularioMaterial(formularioMaterialInicial);
      setFormularioEnvioMaterial((atual) => ({ ...atual, materialId: material.id }));
      setSucesso('Material salvo na biblioteca.');
      setMateriais(await listarMateriais());
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar material.');
    } finally {
      setSalvandoMaterial(false);
    }
  }

  async function enviarMaterial(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formularioEnvioMaterial.materialId) return;
    setEnviandoMaterial(true);
    setErro(null);
    setSucesso(null);
    try {
      await enviarMaterialPaciente(pacienteId, {
        materialId: formularioEnvioMaterial.materialId,
        observacao: formularioEnvioMaterial.observacao.trim() || undefined
      });
      setFormularioEnvioMaterial((atual) => ({ ...formularioEnvioMaterialInicial, materialId: atual.materialId }));
      setSucesso('Material enviado ao paciente.');
      setMateriaisPaciente(await listarMateriaisPaciente(pacienteId));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao enviar material ao paciente.');
    } finally {
      setEnviandoMaterial(false);
    }
  }

  async function enviarAnexo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!arquivoAnexo) return;
    const formulario = evento.currentTarget;
    setEnviandoAnexo(true);
    setErro(null);
    setSucesso(null);
    try {
      const solicitacao = await solicitarUploadMidia({
        pacienteId,
        tipo: tipoMidiaDoArquivo(arquivoAnexo),
        categoria: categoriaAnexo,
        nomeArquivo: arquivoAnexo.name,
        mimeType: arquivoAnexo.type,
        tamanhoBytes: arquivoAnexo.size,
        vinculoClinico: consultaVinculadaId ? { tipo: 'consulta', recursoId: consultaVinculadaId } : undefined
      });
      const upload = await fetch(solicitacao.uploadUrl, {
        method: 'PUT',
        headers: solicitacao.uploadHeaders,
        body: arquivoAnexo
      });
      if (!upload.ok) throw new Error('O armazenamento recusou o arquivo. Tente novamente.');
      await confirmarUploadMidia(solicitacao.arquivo.id);
      setAnexos(await listarArquivosMidia(pacienteId));
      setArquivoAnexo(null);
      setConsultaVinculadaId('');
      formulario.reset();
      setSucesso('Anexo confirmado e incluido no prontuario.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao enviar anexo.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function abrirAnexo(anexo: ArquivoMidiaApi) {
    const novaAba = window.open('', '_blank');
    setErro(null);
    try {
      const acesso = await obterAcessoArquivoMidia(anexo.id);
      if (novaAba) {
        novaAba.opener = null;
        novaAba.location.href = acesso.url;
      } else {
        window.location.assign(acesso.url);
      }
    } catch (erroAtual) {
      novaAba?.close();
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao abrir anexo.');
    }
  }

  async function confirmarExclusaoAnexo() {
    if (!anexoParaExcluir) return;
    setExcluindoAnexo(true);
    setErro(null);
    try {
      await excluirArquivoMidia(anexoParaExcluir.id);
      setAnexoParaExcluir(null);
      setAnexos(await listarArquivosMidia(pacienteId));
      setSucesso('Anexo excluido do prontuario.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao excluir anexo.');
    } finally {
      setExcluindoAnexo(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setPaginaHistorico(null);
    setErroHistorico(null);
    setHistoricoSolicitado(false);
  }, [pacienteId]);

  useEffect(() => {
    if (abaAtiva !== 'historico' || historicoSolicitado) return;
    setHistoricoSolicitado(true);
    void carregarHistorico();
  }, [abaAtiva, carregarHistorico, historicoSolicitado]);

  useEffect(() => {
    let ativo = true;
    void obterSessao()
      .then(async (sessao) => {
        if (!ativo) return;
        const permissoesSessao = sessao?.permissoes ?? [];
        setPermissoes(permissoesSessao);
        if (!permissoesSessao.includes('profissionais.ler')) {
          setProfissionais([]);
          return;
        }
        try {
          const todos: ProfissionalResumo[] = [];
          for (let pagina = 1; pagina <= 20; pagina += 1) {
            const resposta = await listarProfissionais({ pagina, limite: 100 });
            todos.push(...resposta.itens);
            if (todos.length >= resposta.total || resposta.itens.length === 0) break;
          }
          if (ativo) setProfissionais(todos);
        } catch {
          if (ativo) setProfissionais([]);
        }
      })
      .catch(() => {
        if (ativo) setPermissoes([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const evolucaoNaoSalva = Boolean(formularioEvolucao.titulo.trim() || formularioEvolucao.conteudo.trim());
  const alteracoesNaoSalvas = evolucaoNaoSalva || planoAlimentarNaoSalvo;
  const abasDisponiveis = useMemo(
    () => abasProntuario.filter((aba) => !aba.permissao || permissoes.includes(aba.permissao)),
    [permissoes]
  );
  const areasDisponiveis = useMemo(
    () => areasProntuario.filter((area) => !area.permissao || permissoes.includes(area.permissao)),
    [permissoes]
  );
  const abasDaAreaAtiva = useMemo(
    () => abasDisponiveis.filter((aba) => areaPorAba[aba.id] === areaAtiva),
    [abasDisponiveis, areaAtiva]
  );

  function aplicarAba(id: AbaProntuario) {
    setAreaAtiva(areaPorAba[id]);
    setAbaAtiva(id);
  }

  function solicitarTrocaAba(id: AbaProntuario) {
    if (!alteracoesNaoSalvas) {
      aplicarAba(id);
      return;
    }
    setSaidaPendente({ tipo: 'aba', id });
  }

  function solicitarTrocaArea(id: AreaProntuario) {
    const area = areasDisponiveis.find((item) => item.id === id);
    if (!area) return;
    solicitarTrocaAba(area.abaInicial);
  }

  function aplicarFiltrosHistorico(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPaginaHistorico(null);
    void carregarHistorico();
  }

  function limparFiltrosHistorico() {
    setTipoHistorico('todos');
    setInicioHistorico('');
    setFimHistorico('');
    setResponsavelHistorico('');
    setPaginaHistorico(null);
    void carregarHistorico(undefined, {});
  }

  function abrirDetalheEvento(evento: EventoProntuarioPacienteApi) {
    if (evento.tipo === 'consulta') {
      router.push(`/agenda?consultaId=${encodeURIComponent(evento.origemId ?? evento.id)}`);
      return;
    }
    if (evento.tipo === 'evento_financeiro') {
      router.push(`/agenda?financeiro=1&pacienteId=${encodeURIComponent(pacienteId)}`);
      return;
    }

    const abaPorTipo: Partial<Record<TipoEventoProntuarioPaciente, AbaProntuario>> = {
      evolucao_clinica: 'evolucoes',
      tarefa_acompanhamento: 'acompanhamento',
      mensagem: 'mensagens',
      formulario: 'formularios',
      resposta_formulario: 'formularios',
      checkin_rapido: 'formularios',
      plano_alimentar_publicado: 'plano_alimentar',
      avaliacao_antropometrica: 'antropometria',
      documento_emitido: 'documentos',
      anexo_confirmado: 'anexos',
      exame_laboratorial: 'exames_laboratoriais',
      evolucao_fotografica: 'evolucao_fotografica'
    };
    const destino = abaPorTipo[evento.tipo];
    if (destino) solicitarTrocaAba(destino);
  }

  useEffect(() => {
    function aoTentarFecharAba(evento: BeforeUnloadEvent) {
      if (!alteracoesNaoSalvas) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', aoTentarFecharAba);
    return () => window.removeEventListener('beforeunload', aoTentarFecharAba);
  }, [alteracoesNaoSalvas]);

  const eventos = useMemo(() => dados?.linhaDoTempo ?? [], [dados?.linhaDoTempo]);
  const evolucoes = useMemo(() => eventos.filter((evento) => evento.tipo === 'evolucao_clinica'), [eventos]);
  const tarefas = useMemo(() => eventos.filter((evento) => evento.tipo === 'tarefa_acompanhamento'), [eventos]);
  const formularios = useMemo(
    () => eventos.filter((evento) => evento.tipo === 'formulario' || evento.tipo === 'resposta_formulario' || evento.tipo === 'checkin_rapido'),
    [eventos]
  );
  const mensagens = useMemo(() => eventos.filter((evento) => evento.tipo === 'mensagem'), [eventos]);
  const anexosFiltrados = useMemo(
    () => filtroCategoriaAnexo === 'todas' ? anexos : anexos.filter((anexo) => anexo.categoria === filtroCategoriaAnexo),
    [anexos, filtroCategoriaAnexo]
  );
  const proximaConsulta = useMemo(
    () => eventos
      .filter((evento) => evento.tipo === 'consulta'
        && (evento.status === 'agendada' || evento.status === 'reagendada')
        && new Date(evento.data).getTime() >= Date.now())
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0],
    [eventos]
  );

  function abrirProximaConduta() {
    const conduta = dados?.resumo.proximaConduta;
    if (!conduta) return;
    if (conduta.destino === 'agenda') {
      const destino = conduta.referenciaId
        ? `/agenda?consultaId=${encodeURIComponent(conduta.referenciaId)}`
        : '/agenda';
      router.push(destino as Route);
      return;
    }
    solicitarTrocaAba(conduta.destino);
  }
  /** So consulta concluida gera declaracao; o backend recusa o resto de qualquer forma. */
  const consultasConcluidas = useMemo<ConsultaConcluidaOpcao[]>(
    () =>
      eventos
        .filter((evento) => evento.tipo === 'consulta' && evento.status === 'concluida')
        .map((evento) => ({
          id: evento.origemId ?? evento.id,
          rotulo: `${formatarDataHora(evento.data)} - ${evento.titulo}`
        })),
    [eventos]
  );

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando prontuario do paciente" />;

  if (erro) {
    return (
      <div className="grid gap-3">
        <AlertaOperacional mensagem={`Falha ao carregar prontuario: ${erro}`} />
        <Botao type="button" onClick={() => void carregar()}>
          <RefreshCcw size={16} />
          Tentar novamente
        </Botao>
      </div>
    );
  }

  if (!dados) return <EstadoVazio titulo="Prontuario indisponivel" descricao="Nao foi possivel carregar os dados do paciente." />;

  return (
    <div className="grid gap-4">
      <div className="sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-linha bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
            <UserRound size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-tinta">{dados.paciente.nome}</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Risco {Number(dados.paciente.scoreRisco).toFixed(0)} pontos - {dados.paciente.statusAdesao}
            </p>
            <p className="mt-1 text-sm text-texto-suave">
              Contato {dados.paciente.contato ?? '-'} - Nascimento {formatarData(dados.paciente.dataNascimento)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/agenda?pacienteId=${encodeURIComponent(pacienteId)}`}
            onClick={(evento) => {
              if (!alteracoesNaoSalvas) return;
              evento.preventDefault();
              setSaidaPendente({ tipo: 'agenda' });
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <CalendarDays size={16} />
            Agendar
          </Link>
          <PerfilCadastroPaciente
            pacienteId={pacienteId}
            nomeCompleto={dados.paciente.nome}
            dataNascimento={dados.paciente.dataNascimento}
            aoAtualizarFicha={() => void carregar()}
          />
          <Link
            href="/pacientes"
            onClick={(evento) => {
              if (!alteracoesNaoSalvas) return;
              evento.preventDefault();
              setSaidaPendente({ tipo: 'voltar' });
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <ArrowLeft size={16} />
            Voltar para pacientes
          </Link>
          <Botao type="button" onClick={() => void carregar()}>
            <RefreshCcw size={16} />
            Atualizar
          </Botao>
          <Botao type="button" variante="primario" onClick={() => solicitarTrocaAba('evolucoes')}>
            <Stethoscope size={16} />
            Nova evolucao
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => solicitarTrocaAba('acompanhamento')}>
            <CheckSquare size={16} />
            Nova tarefa
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => solicitarTrocaAba('formularios')}>
            <ClipboardList size={16} />
            Formularios
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => solicitarTrocaAba('anexos')}>
            <Paperclip size={16} />
            Anexar
          </Botao>
        </div>
      </div>

      <Abas
        identificador="prontuario-area"
        abas={areasDisponiveis}
        ativaId={areaAtiva}
        aoMudar={(id) => {
          solicitarTrocaArea(id as AreaProntuario);
        }}
        rotulo="Areas principais do prontuario"
      />

      {sucesso ? (
        <div className="rounded-md border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">{sucesso}</div>
      ) : null}

      <div id={`prontuario-area-${areaAtiva}-painel`} role="tabpanel" aria-labelledby={`prontuario-area-${areaAtiva}-aba`} className="grid gap-4">
      {abasDaAreaAtiva.length > 1 ? (
        <Abas
          identificador="prontuario-subarea"
          abas={abasDaAreaAtiva}
          ativaId={abaAtiva}
          aoMudar={(id) => solicitarTrocaAba(id as AbaProntuario)}
          rotulo={`Subareas de ${areasProntuario.find((area) => area.id === areaAtiva)?.rotulo ?? 'prontuario'}`}
          className="border-none pb-0"
        />
      ) : null}
      <div
        id={`prontuario-subarea-${abaAtiva}-painel`}
        role={abasDaAreaAtiva.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={abasDaAreaAtiva.length > 1 ? `prontuario-subarea-${abaAtiva}-aba` : undefined}
        className="grid gap-4"
      >
      {abaAtiva === 'resumo' ? (
        <>
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <article className="grid gap-3 rounded-md border border-primaria/30 bg-primaria-suave p-4">
              <div>
                <p className="text-xs font-semibold uppercase text-primaria">Proxima acao</p>
                <h2 className="mt-2 text-base font-semibold text-tinta">
                  {dados.resumo.proximaConduta?.titulo ?? 'Sem pendencia operacional'}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                  {dados.resumo.proximaConduta?.descricao ?? 'Nenhuma acao prioritaria foi identificada nos registros atuais.'}
                </p>
                {dados.resumo.proximaConduta?.dataReferencia ? (
                  <p className="mt-2 text-xs text-texto-suave">Referencia: {formatarDataHora(dados.resumo.proximaConduta.dataReferencia)}</p>
                ) : null}
              </div>
              {dados.resumo.proximaConduta ? (
                <div><Botao type="button" variante="primario" onClick={abrirProximaConduta}>Abrir acao</Botao></div>
              ) : null}
            </article>
            <article className="grid gap-2 rounded-md border border-linha bg-white p-4">
              <p className="text-xs font-semibold uppercase text-texto-suave">Proxima consulta</p>
              <h2 className="text-base font-semibold text-tinta">{proximaConsulta?.titulo ?? 'Nenhuma consulta agendada'}</h2>
              <p className="text-sm text-texto-suave">{proximaConsulta ? formatarDataHora(proximaConsulta.data) : 'Use a agenda para definir o proximo encontro.'}</p>
            </article>
          </section>
          <section aria-labelledby="contexto-operacional-titulo" className="grid gap-4 rounded-md border border-linha bg-white p-4">
            <div>
              <h2 id="contexto-operacional-titulo" className="text-base font-semibold text-tinta">Contexto operacional</h2>
              <p className="mt-1 text-sm text-texto-suave">Dados registrados no prontuario e nos modulos autorizados para este acesso.</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-l-2 border-primaria pl-3">
                <dt className="text-xs font-semibold text-texto-suave">Ultimo atendimento</dt>
                <dd className="mt-1 text-sm font-medium text-tinta">{dados.resumo.ultimoAtendimento?.titulo ?? 'Nao registrado'}</dd>
                {dados.resumo.ultimoAtendimento ? <dd className="text-xs text-texto-suave">{formatarDataHora(dados.resumo.ultimoAtendimento.concluidaEm)}</dd> : null}
              </div>
              <div className="border-l-2 border-primaria pl-3">
                <dt className="text-xs font-semibold text-texto-suave">Plano atual publicado</dt>
                <dd className="mt-1 text-sm font-medium text-tinta">
                  {permissoes.includes('planos_alimentares.ler')
                    ? dados.resumo.planoAtual ? `Versao ${dados.resumo.planoAtual.numeroVersao}` : 'Nenhum plano publicado'
                    : 'Acesso nao disponivel'}
                </dd>
                {dados.resumo.planoAtual ? <dd className="text-xs text-texto-suave">Publicado em {formatarDataHora(dados.resumo.planoAtual.publicadaEm)}</dd> : null}
              </div>
              <div className="border-l-2 border-primaria pl-3">
                <dt className="text-xs font-semibold text-texto-suave">Tarefa vencida</dt>
                <dd className="mt-1 text-sm font-medium text-tinta">{dados.resumo.tarefaVencida?.titulo ?? 'Nenhuma'}</dd>
                {dados.resumo.tarefaVencida ? <dd className="text-xs text-texto-suave">Venceu em {formatarDataHora(dados.resumo.tarefaVencida.vencimentoEm)}</dd> : null}
              </div>
              <div className="border-l-2 border-primaria pl-3">
                <dt className="text-xs font-semibold text-texto-suave">Comunicacao</dt>
                <dd className="mt-1 text-sm font-medium text-tinta">
                  {permissoes.includes('comunicacoes.mensagens.ler')
                    ? dados.resumo.falhaComunicacao ? 'Falha de entrega pendente' : 'Sem falha identificada'
                    : 'Acesso nao disponivel'}
                </dd>
                {dados.resumo.falhaComunicacao ? <dd className="text-xs text-texto-suave">Registrada em {formatarDataHora(dados.resumo.falhaComunicacao.registradaEm)}</dd> : null}
              </div>
            </dl>
          </section>
          <section aria-labelledby="atividade-prontuario-titulo" className="rounded-md border border-linha bg-white p-4">
            <h2 id="atividade-prontuario-titulo" className="text-base font-semibold text-tinta">Atividade do prontuario</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Consultas', dados.resumo.consultas],
                ['Formularios pendentes', dados.resumo.formulariosPendentes],
                ['Respostas', dados.resumo.respostas],
                ['Check-ins rapidos', dados.resumo.checkinsRapidos ?? 0],
                ['Evolucoes', dados.resumo.evolucoes ?? 0],
                ['Tarefas pendentes', dados.resumo.tarefasPendentes ?? 0]
              ].map(([rotulo, valor]) => (
                <div key={String(rotulo)}>
                  <dt className="text-xs text-texto-suave">{rotulo}</dt>
                  <dd className="mt-1 text-xl font-semibold text-tinta">{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
          {(dados.resumo.indicadoresRecentes ?? []).length ? (
            <section aria-labelledby="relatos-recentes-titulo" className="grid gap-3 rounded-md border border-linha bg-white p-4">
              <div>
                <h2 id="relatos-recentes-titulo" className="text-base font-semibold text-tinta">Relatos recentes</h2>
                <p className="mt-1 text-sm text-texto-suave">Informacoes declaradas pelo paciente, com origem e data do registro.</p>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {(dados.resumo.indicadoresRecentes ?? []).map((indicador) => (
                  <li key={`${indicador.tipo}-${indicador.registradoEm}`} className="rounded-md border border-linha bg-superficie p-3">
                    <p className="text-xs font-semibold uppercase text-texto-suave">{indicador.tipo === 'adesao' ? 'Adesao relatada' : 'Sintomas relatados'}</p>
                    <p className="mt-1 text-sm font-medium text-tinta">{indicador.valor}</p>
                    <p className="mt-2 text-xs text-texto-suave">Fonte: {indicador.fonte} em {formatarDataHora(indicador.registradoEm)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ResumoAntropometrico pacienteId={pacienteId} aoAbrirDetalhes={() => solicitarTrocaAba('antropometria')} />
          <section className="grid gap-3">
            <div className="rounded-md border border-linha bg-white p-4"><h2 className="text-base font-semibold text-tinta">Linha de cuidado</h2><p className="mt-1 text-sm text-texto-suave">Ultimos eventos que orientam a proxima conduta.</p></div>
            <LinhaDoTempo eventos={eventos.slice(0, 4)} profissionais={profissionais} />
          </section>
        </>
      ) : null}

      {abaAtiva === 'evolucoes' ? <>
      <form onSubmit={registrarEvolucao} className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-tinta">Nova evolucao clinica</h2>
          <p className="mt-1 text-sm text-texto-suave">Registro privado do profissional, salvo no historico do paciente.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Titulo da evolucao
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioEvolucao.titulo}
              onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, titulo: evento.target.value }))}
              required
              maxLength={180}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Tipo da evolucao
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioEvolucao.tipo}
              onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, tipo: evento.target.value as TipoEvolucaoClinicaApi }))}
            >
              <option value="observacao">Observacao</option>
              <option value="consulta">Consulta</option>
              <option value="retorno">Retorno</option>
              <option value="ajuste_plano">Ajuste de plano</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Conteudo da evolucao
          <textarea
            className="min-h-[112px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
            value={formularioEvolucao.conteudo}
            onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, conteudo: evento.target.value }))}
            required
            minLength={3}
            maxLength={6000}
          />
        </label>
        <div className="flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvandoEvolucao}>
            <Save size={16} />
            {salvandoEvolucao ? 'Registrando' : 'Registrar evolucao'}
          </Botao>
        </div>
      </form>

      <section className="grid gap-3"><div className="rounded-md border border-linha bg-white p-4"><h2 className="text-base font-semibold text-tinta">Evolucoes recentes</h2></div><LinhaDoTempo eventos={evolucoes} profissionais={profissionais} /></section>
      </> : null}

      {abaAtiva === 'acompanhamento' ? <>
      <form onSubmit={registrarTarefa} className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-tinta">Plano de acompanhamento</h2>
          <p className="mt-1 text-sm text-texto-suave">Prescreva metas, tarefas e check-ins para o paciente cumprir entre consultas.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_210px]">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Titulo da tarefa
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.titulo}
              onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, titulo: evento.target.value }))}
              required
              maxLength={180}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Categoria da tarefa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.categoria}
              onChange={(evento) =>
                setFormularioTarefa((atual) => ({ ...atual, categoria: evento.target.value as CategoriaTarefaAcompanhamentoApi }))
              }
            >
              <option value="tarefa">Tarefa</option>
              <option value="meta">Meta</option>
              <option value="checkin">Check-in</option>
              <option value="orientacao">Orientacao</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Prioridade da tarefa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.prioridade}
              onChange={(evento) =>
                setFormularioTarefa((atual) => ({ ...atual, prioridade: evento.target.value as PrioridadeTarefaAcompanhamentoApi }))
              }
            >
              <option value="baixa">Baixa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Vencimento da tarefa
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              type="datetime-local"
              value={formularioTarefa.vencimentoEm}
              onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, vencimentoEm: evento.target.value }))}
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Descricao da tarefa
          <textarea
            className="min-h-[96px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
            value={formularioTarefa.descricao}
            onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, descricao: evento.target.value }))}
            maxLength={2000}
          />
        </label>
        <div className="flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvandoTarefa}>
            <CheckSquare size={16} />
            {salvandoTarefa ? 'Prescrevendo' : 'Prescrever tarefa'}
          </Botao>
        </div>
      </form>

      <section className="grid gap-3"><div className="rounded-md border border-linha bg-white p-4"><h2 className="text-base font-semibold text-tinta">Plano em acompanhamento</h2></div><LinhaDoTempo eventos={tarefas} profissionais={profissionais} /></section>
      </> : null}

      {abaAtiva === 'plano_alimentar' ? (
        <PlanoAlimentarProfissional pacienteId={pacienteId} aoAlterarRascunho={setPlanoAlimentarNaoSalvo} />
      ) : null}

      {abaAtiva === 'condutas_terapeuticas' ? <AbaCondutasTerapeuticas pacienteId={pacienteId} podeGerenciar={permissoes.includes('pacientes.gerenciar')} /> : null}

      {abaAtiva === 'materiais' ? <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-tinta">Biblioteca de materiais</h2>
            <p className="mt-1 text-sm text-texto-suave">Salve links, PDFs por URL e orientacoes reutilizaveis para enviar ao paciente.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-texto-suave">
            <FileText size={16} className="text-primaria" />
            {materiais.length} materiais
          </div>
        </div>

        <form onSubmit={registrarMaterial} className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px]">
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Titulo do material
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.titulo}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, titulo: evento.target.value }))}
                required
                maxLength={180}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Tipo do material
              <select
                className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.tipo}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, tipo: evento.target.value as TipoMaterialEducativoApi }))}
              >
                <option value="link">Link</option>
                <option value="pdf_url">PDF por URL</option>
                <option value="orientacao">Orientacao</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Categoria do material
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.categoria}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, categoria: evento.target.value }))}
                maxLength={80}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            URL do material
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioMaterial.url}
              onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, url: evento.target.value }))}
              maxLength={1000}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Resumo do material
            <textarea
              className="min-h-[78px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
              value={formularioMaterial.resumo}
              onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, resumo: evento.target.value }))}
              maxLength={500}
            />
          </label>
          <div className="flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvandoMaterial}>
              <Save size={16} />
              {salvandoMaterial ? 'Salvando' : 'Salvar material'}
            </Botao>
          </div>
        </form>

        <form onSubmit={enviarMaterial} className="grid gap-3 border-t border-linha pt-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Material para enviar
              <select
                className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={formularioEnvioMaterial.materialId}
                onChange={(evento) => setFormularioEnvioMaterial((atual) => ({ ...atual, materialId: evento.target.value }))}
                disabled={!materiais.length}
                required
              >
                {materiais.length ? null : <option value="">Nenhum material salvo</option>}
                {materiais.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Observacao do envio
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioEnvioMaterial.observacao}
                onChange={(evento) => setFormularioEnvioMaterial((atual) => ({ ...atual, observacao: evento.target.value }))}
                maxLength={1000}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <Botao type="submit" variante="primario" disabled={enviandoMaterial || !materiais.length}>
              <Send size={16} />
              {enviandoMaterial ? 'Enviando' : 'Enviar material'}
            </Botao>
          </div>
        </form>

        <div className="grid gap-2 border-t border-linha pt-3">
          <h3 className="text-sm font-semibold text-tinta">Materiais enviados</h3>
          {materiaisPaciente.length ? (
            materiaisPaciente.map((material) => (
              <article key={material.id} className="grid gap-1 rounded-md border border-linha p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="break-words text-sm font-semibold text-tinta">{material.titulo}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classeStatus(material.status)}`}>{material.status}</span>
                </div>
                {material.resumo ? <p className="break-words text-sm text-texto-suave">{material.resumo}</p> : null}
                {material.observacao ? <p className="break-words text-sm text-texto-suave">{material.observacao}</p> : null}
                {material.url ? (
                  <a className="inline-flex items-center gap-1 break-all text-sm font-medium text-primaria hover:underline" href={material.url}>
                    <LinkIcon size={14} />
                    {material.url}
                  </a>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-texto-suave">Nenhum material enviado ao paciente.</p>
          )}
        </div>
      </section> : null}

      {abaAtiva === 'antropometria' ? <AbaAntropometria pacienteId={pacienteId} podeGerenciar={permissoes.includes('pacientes.gerenciar')} /> : null}

      {abaAtiva === 'exames_laboratoriais' ? <AbaExamesLaboratoriais pacienteId={pacienteId} podeGerenciar={permissoes.includes('pacientes.gerenciar')} /> : null}

      {abaAtiva === 'evolucao_fotografica' ? <AbaEvolucaoFotografica pacienteId={pacienteId} podeGerenciar={permissoes.includes('pacientes.gerenciar')} /> : null}

      {abaAtiva === 'documentos' ? (
        <AbaDocumentos pacienteId={pacienteId} podeGerenciar consultasConcluidas={consultasConcluidas} />
      ) : null}

      {abaAtiva === 'anexos' ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <form onSubmit={enviarAnexo} className="grid h-fit gap-4 rounded-md border border-linha bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
                <UploadCloud size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-tinta">Adicionar anexo clinico</h2>
                <p className="mt-1 text-sm text-texto-suave">PDF ou imagem de ate 25 MB.</p>
              </div>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Categoria do novo anexo
              <select
                className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={categoriaAnexo}
                onChange={(evento) => setCategoriaAnexo(evento.target.value as CategoriaAnexoClinico)}
              >
                <option value="exame">Exame</option>
                <option value="documento">Documento</option>
                <option value="foto">Foto</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Vincular a consulta
              <select
                className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={consultaVinculadaId}
                onChange={(evento) => setConsultaVinculadaId(evento.target.value)}
              >
                <option value="">Sem vinculo clinico</option>
                {dados.linhaDoTempo.filter((evento) => evento.tipo === 'consulta').map((consulta) => (
                  <option key={consulta.id} value={consulta.id}>
                    {consulta.titulo} - {formatarDataHora(consulta.data)}
                  </option>
                ))}
              </select>
              <span className="font-normal text-texto-suave">Opcional. O anexo continua privado e sera associado somente a esta consulta.</span>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Arquivo
              <input
                className="min-h-11 rounded-md border border-linha bg-white px-3 py-2 text-sm font-normal text-tinta file:mr-3 file:rounded-md file:border-0 file:bg-primaria-suave file:px-3 file:py-2 file:font-medium file:text-primaria"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(evento) => setArquivoAnexo(evento.target.files?.[0] ?? null)}
                required
              />
            </label>
            <Botao type="submit" variante="primario" disabled={enviandoAnexo || !arquivoAnexo}>
              <UploadCloud size={16} />
              {enviandoAnexo ? 'Enviando' : 'Enviar anexo'}
            </Botao>
          </form>

          <div className="grid content-start gap-3">
            <div className="rounded-md border border-linha bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-tinta">Anexos do paciente</h2>
                  <p className="mt-1 text-sm text-texto-suave">Arquivos confirmados e armazenados de forma privada.</p>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Filtrar anexos por categoria
                  <select className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" value={filtroCategoriaAnexo} onChange={(evento) => setFiltroCategoriaAnexo(evento.target.value as CategoriaAnexoClinico | 'todas')}>
                    <option value="todas">Todas ({anexos.length})</option>
                    <option value="exame">Exames ({anexos.filter((anexo) => anexo.categoria === 'exame').length})</option>
                    <option value="documento">Documentos ({anexos.filter((anexo) => anexo.categoria === 'documento').length})</option>
                    <option value="foto">Fotos ({anexos.filter((anexo) => anexo.categoria === 'foto').length})</option>
                    <option value="diario">Diarios ({anexos.filter((anexo) => anexo.categoria === 'diario').length})</option>
                  </select>
                </label>
              </div>
            </div>
            {anexosFiltrados.length ? anexosFiltrados.map((anexo) => (
              <article key={anexo.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-linha bg-white p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-superficie-hover text-primaria">
                    <Paperclip size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-tinta">{anexo.nomeArquivo ?? `Anexo ${anexo.id.slice(0, 8)}`}</h3>
                    <p className="mt-1 text-xs text-texto-suave">
                      {anexo.categoria} - {formatarTamanho(anexo.tamanhoBytes)} - {formatarDataHora(anexo.confirmadoEm ?? anexo.criadoEm)}
                    </p>
                    {anexo.vinculoClinico?.tipo === 'consulta' ? (
                      <p className="mt-1 text-xs font-medium text-primaria">Vinculado a uma consulta</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Botao type="button" variante="secundario" onClick={() => void abrirAnexo(anexo)}>
                    <Download size={16} />
                    Abrir
                  </Botao>
                  <Botao type="button" variante="fantasma" onClick={() => setAnexoParaExcluir(anexo)} aria-label={`Excluir ${anexo.nomeArquivo ?? 'anexo'}`}>
                    <Trash2 size={16} />
                  </Botao>
                </div>
              </article>
            )) : (
              <EstadoVazio
                titulo={anexos.length ? 'Nenhum anexo nesta categoria' : 'Nenhum anexo clinico'}
                descricao={anexos.length ? 'Altere o filtro para consultar os demais arquivos confirmados.' : 'Exames, documentos e fotos confirmados aparecerao aqui.'}
              />
            )}
          </div>
        </section>
      ) : null}

      {abaAtiva === 'financeiro' ? (
        <section className="grid gap-3 rounded-md border border-linha bg-white p-4 sm:max-w-2xl">
          <h2 className="text-base font-semibold text-tinta">Financeiro do paciente</h2>
          <p className="text-sm text-texto-suave">
            Consultas, pacotes, pagamentos e recibos permanecem registrados na agenda para preservar a fonte de verdade financeira.
          </p>
          <div>
            <Link
              href={`/agenda?pacienteId=${encodeURIComponent(pacienteId)}`}
              className="inline-flex min-h-11 items-center rounded-md bg-primaria px-3 text-sm font-semibold text-white hover:bg-primaria-forte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
            >
              Abrir financeiro na agenda
            </Link>
          </div>
        </section>
      ) : null}

      {abaAtiva === 'formularios' ? <section className="grid gap-3"><div className="rounded-md border border-linha bg-white p-4"><h2 className="text-base font-semibold text-tinta">Formularios e check-ins</h2><p className="mt-1 text-sm text-texto-suave">Envios, respostas e check-ins vinculados ao paciente.</p></div><LinhaDoTempo eventos={formularios} profissionais={profissionais} /></section> : null}

      {abaAtiva === 'mensagens' ? <section className="grid gap-3"><div className="rounded-md border border-linha bg-white p-4"><h2 className="text-base font-semibold text-tinta">Mensagens do paciente</h2><p className="mt-1 text-sm text-texto-suave">Historico de comunicacoes registradas.</p></div><LinhaDoTempo eventos={mensagens} profissionais={profissionais} /></section> : null}

      {abaAtiva === 'historico' ? <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <article className="grid gap-3">
          <div className="rounded-md border border-linha bg-white p-4">
            <h2 className="text-base font-semibold text-tinta">Linha do tempo clinica</h2>
            <p className="mt-1 text-sm text-texto-suave">Consultas, formularios, check-ins, respostas e mensagens em ordem cronologica.</p>
          </div>
          <form onSubmit={aplicarFiltrosHistorico} className="grid gap-3 rounded-md border border-linha bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Tipo de evento
              <select className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" value={tipoHistorico} onChange={(evento) => setTipoHistorico(evento.target.value as TipoEventoProntuarioPaciente | 'todos')}>
                <option value="todos">Todos os eventos</option>
                <option value="consulta">Consultas</option>
                <option value="formulario">Formularios enviados</option>
                <option value="resposta_formulario">Respostas de formularios</option>
                <option value="checkin_rapido">Check-ins rapidos</option>
                <option value="mensagem">Mensagens</option>
                <option value="evolucao_clinica">Evolucoes clinicas</option>
                <option value="tarefa_acompanhamento">Tarefas de acompanhamento</option>
                {permissoes.includes('planos_alimentares.ler') ? <option value="plano_alimentar_publicado">Planos alimentares publicados</option> : null}
                <option value="avaliacao_antropometrica">Avaliacoes antropometricas</option>
                <option value="documento_emitido">Documentos emitidos</option>
                <option value="anexo_confirmado">Anexos confirmados</option>
                <option value="exame_laboratorial">Exames laboratoriais</option>
                <option value="evolucao_fotografica">Evolucoes fotograficas</option>
                {permissoes.includes('agenda.financeiro.ler') ? <option value="evento_financeiro">Eventos financeiros</option> : null}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              A partir de
              <input className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta" type="date" value={inicioHistorico} onChange={(evento) => setInicioHistorico(evento.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-texto-suave">
              Ate
              <input className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta" type="date" value={fimHistorico} onChange={(evento) => setFimHistorico(evento.target.value)} />
            </label>
            {profissionais.length ? (
              <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                Responsavel
                <select className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" value={responsavelHistorico} onChange={(evento) => setResponsavelHistorico(evento.target.value)}>
                  <option value="">Todos os responsaveis</option>
                  {profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}
                </select>
              </label>
            ) : null}
            <div className="flex items-end gap-2">
              <Botao type="submit" variante="primario" disabled={carregandoHistorico}>Filtrar</Botao>
              <Botao type="button" variante="secundario" disabled={carregandoHistorico || (tipoHistorico === 'todos' && !inicioHistorico && !fimHistorico && !responsavelHistorico)} onClick={limparFiltrosHistorico}>Limpar</Botao>
            </div>
          </form>
          {erroHistorico ? (
            <div className="grid gap-3">
              <AlertaOperacional mensagem={`Falha ao carregar linha do tempo: ${erroHistorico}`} />
              <div><Botao type="button" variante="secundario" onClick={() => void carregarHistorico()}>Tentar novamente</Botao></div>
            </div>
          ) : (
            <>
              <BarraCarregamento visivel={carregandoHistorico && !paginaHistorico} rotulo="Carregando linha do tempo" />
              <LinhaDoTempo eventos={paginaHistorico?.itens ?? []} aoAbrirEvento={abrirDetalheEvento} profissionais={profissionais} />
              {paginaHistorico?.proximoCursor ? (
                <div><Botao type="button" variante="secundario" disabled={carregandoHistorico} onClick={() => void carregarHistorico(paginaHistorico.proximoCursor)}>
                  {carregandoHistorico ? 'Carregando eventos' : 'Carregar eventos anteriores'}
                </Botao></div>
              ) : null}
            </>
          )}
        </article>

        <aside className="grid h-fit gap-3 rounded-md border border-linha bg-white p-4">
          <div className="flex items-start gap-2">
            <Stethoscope size={18} className="mt-0.5 shrink-0 text-primaria" />
            <div>
              <h2 className="text-base font-semibold text-tinta">Atalhos do prontuario</h2>
              <p className="mt-1 text-sm text-texto-suave">Abra os modulos conectados para agir sobre o acompanhamento.</p>
            </div>
          </div>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/agenda">
            Abrir agenda
          </Link>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/questionarios">
            Abrir formularios
          </Link>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/comunicacoes">
            Abrir comunicacoes
          </Link>
        </aside>
      </section> : null}
      </div>
      <ModalConfirmacao
        aberto={Boolean(anexoParaExcluir)}
        titulo="Excluir anexo clinico"
        mensagem="O arquivo sera removido do armazenamento e nao podera mais ser aberto."
        rotuloConfirmar="Excluir anexo"
        confirmando={excluindoAnexo}
        aoConfirmar={() => void confirmarExclusaoAnexo()}
        aoCancelar={() => setAnexoParaExcluir(null)}
      />
      <ModalConfirmacao
        aberto={Boolean(saidaPendente)}
        titulo="Sair sem salvar"
        mensagem="Voce tem alteracoes clinicas nao salvas. Sair sem salvar?"
        rotuloConfirmar="Sair sem salvar"
        aoCancelar={() => setSaidaPendente(null)}
        aoConfirmar={() => {
          if (!saidaPendente) return;
          const pendente = saidaPendente;
          setSaidaPendente(null);
          if (pendente.tipo === 'voltar') router.push('/pacientes');
          else if (pendente.tipo === 'agenda') router.push(`/agenda?pacienteId=${encodeURIComponent(pacienteId)}`);
          else aplicarAba(pendente.id);
        }}
      />
      </div>
    </div>
  );
}
