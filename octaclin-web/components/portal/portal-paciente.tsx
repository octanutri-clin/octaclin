'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  ExternalLink,
  HeartPulse,
  LogOut,
  MessageCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
  SmilePlus,
  Target,
  UserRound
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { sair } from '@/lib/auth-api';
import {
  atualizarPerfilPaciente,
  CheckinRapidoPacienteApi,
  DetalheFormularioRespondidoApi,
  exportarDadosLgpdPaciente,
  HumorCheckinRapidoPaciente,
  obterFormularioRespondidoPaciente,
  obterPortalPaciente,
  CanalPreferidoComunicacaoPaciente,
  PortalPacienteApi,
  registrarCheckinRapidoPaciente,
  registrarConsentimentoLgpdPaciente,
  registrarSolicitacaoLgpdPaciente
} from '@/lib/portal-api';

interface FormularioPerfilPaciente {
  nome: string;
  email: string;
  whatsapp: string;
  dataNascimento: string;
  prefereEmail: boolean;
  prefereWhatsapp: boolean;
  canalPreferido: CanalPreferidoComunicacaoPaciente;
  horarioInicio: string;
  horarioFim: string;
  timezoneComunicacao: string;
}

interface ItemLinhaTempoPortal {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  data?: string;
}

interface FormularioCheckinRapido {
  humor: HumorCheckinRapidoPaciente;
  adesaoPlano: string;
  sintomas: string;
  observacoes: string;
}

const formularioPerfilVazio: FormularioPerfilPaciente = {
  nome: '',
  email: '',
  whatsapp: '',
  dataNascimento: '',
  prefereEmail: true,
  prefereWhatsapp: true,
  canalPreferido: 'qualquer',
  horarioInicio: '08:00',
  horarioFim: '20:00',
  timezoneComunicacao: 'America/Sao_Paulo'
};

const formularioCheckinInicial: FormularioCheckinRapido = {
  humor: 'bem',
  adesaoPlano: '80',
  sintomas: '',
  observacoes: ''
};

const classeCampo =
  'h-10 rounded-md border border-linha bg-white px-3 text-sm outline-none focus:border-primaria focus:ring-2 focus:ring-[#c7e4ef]';

function formatarDataHora(valor?: string) {
  if (!valor) return 'Sem data';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    agendada: 'Agendada',
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluida: 'Concluida',
    cancelada: 'Cancelada',
    enviado: 'Disponivel',
    visualizado: 'Visualizado',
    respondido: 'Respondido',
    enviado_meta: 'Enviado',
    processando: 'Processando',
    em_fila: 'Em fila',
    falha: 'Falha'
  };
  return mapa[status] ?? status;
}

function rotuloCanalNotificacao(canal: string) {
  const mapa: Record<string, string> = {
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    canal_configurado: 'Canal configurado',
    indefinido: 'Canal indefinido'
  };
  return mapa[canal] ?? canal;
}

function ehNotificacaoPendente(status: string) {
  return ['pendente', 'agendada', 'processando', 'em_fila'].includes(status);
}

function rotuloPrioridade(prioridade: string) {
  const mapa: Record<string, string> = {
    baixa: 'Baixa',
    media: 'Media',
    alta: 'Alta'
  };
  return mapa[prioridade] ?? prioridade;
}

function rotuloCategoriaTarefa(categoria: string) {
  const mapa: Record<string, string> = {
    meta: 'Meta',
    tarefa: 'Tarefa',
    checkin: 'Check-in',
    orientacao: 'Orientacao'
  };
  return mapa[categoria] ?? categoria;
}

function rotuloTipoMaterial(tipo: string) {
  const mapa: Record<string, string> = {
    link: 'Link',
    pdf_url: 'PDF',
    orientacao: 'Orientacao'
  };
  return mapa[tipo] ?? tipo;
}

function rotuloHumor(humor: string) {
  const mapa: Record<string, string> = {
    muito_bem: 'Muito bem',
    bem: 'Bem',
    neutro: 'Neutro',
    mal: 'Mal',
    muito_mal: 'Muito mal'
  };
  return mapa[humor] ?? humor;
}

function rotuloConsentimento(tipo: string) {
  const mapa: Record<string, string> = {
    primeiro_acesso_paciente: 'Primeiro acesso',
    portal_paciente_lgpd: 'Portal do paciente',
    termos_uso: 'Termos de uso',
    politica_privacidade: 'Politica de privacidade',
    consentimento_lgpd: 'Consentimento LGPD'
  };
  return mapa[tipo] ?? tipo;
}

function rotuloTipoSolicitacaoLgpd(tipo: string) {
  const mapa: Record<string, string> = {
    retificacao: 'Retificacao de dados',
    exclusao: 'Exclusao de dados'
  };
  return mapa[tipo] ?? tipo;
}

function rotuloStatusSolicitacaoLgpd(status: string) {
  const mapa: Record<string, string> = {
    recebida: 'Recebida',
    em_tratamento: 'Em tratamento',
    concluida: 'Concluida',
    indeferida: 'Indeferida'
  };
  return mapa[status] ?? status;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Sem resposta';
  if (Array.isArray(valor)) return valor.length ? valor.map(formatarValor).join(', ') : 'Sem resposta';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Nao';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR').format(valor);
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

function montarFormularioPerfil(portal: PortalPacienteApi): FormularioPerfilPaciente {
  return {
    nome: portal.paciente.nome ?? '',
    email: portal.perfil.email ?? (portal.perfil.contato?.includes('@') ? portal.perfil.contato : ''),
    whatsapp: portal.perfil.whatsapp ?? (portal.perfil.contato?.includes('@') ? '' : portal.perfil.contato ?? ''),
    dataNascimento: portal.perfil.dataNascimento ?? '',
    prefereEmail: portal.perfil.preferenciasContato?.email ?? true,
    prefereWhatsapp: portal.perfil.preferenciasContato?.whatsapp ?? true,
    canalPreferido: portal.perfil.preferenciasContato?.canalPreferido ?? 'qualquer',
    horarioInicio: portal.perfil.preferenciasContato?.horarioPermitido?.inicio ?? '08:00',
    horarioFim: portal.perfil.preferenciasContato?.horarioPermitido?.fim ?? '20:00',
    timezoneComunicacao: portal.perfil.preferenciasContato?.horarioPermitido?.timezone ?? 'America/Sao_Paulo'
  };
}

function versaoDocumentoLegal(portal: PortalPacienteApi, tipo: string): string {
  return portal.lgpd.documentosLegais?.find((documento) => documento.tipo === tipo)?.versao ?? portal.lgpd.versaoAtual;
}

function timestampLinhaTempo(valor?: string) {
  if (!valor) return 0;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function montarLinhaTempoPortal(portal: PortalPacienteApi): ItemLinhaTempoPortal[] {
  const tarefas = portal.tarefasAcompanhamento ?? [];
  const materiais = portal.materiaisDisponiveis ?? [];
  const diarios = portal.diariosRecentes ?? [];
  const itens: ItemLinhaTempoPortal[] = [
    ...portal.consultasProximas.map((consulta) => ({
      id: `consulta-${consulta.id}`,
      tipo: 'Agenda',
      titulo: consulta.titulo,
      descricao: `${rotuloStatus(consulta.status)}${consulta.local ? ` - ${consulta.local}` : ''}`,
      data: consulta.inicioEm
    })),
    ...portal.formulariosPendentes.map((formulario) => ({
      id: `formulario-pendente-${formulario.envioId}`,
      tipo: 'Formulario pendente',
      titulo: formulario.titulo,
      descricao: `${rotuloStatus(formulario.status)} - responder ate ${formatarDataHora(formulario.expiraEm)}`,
      data: formulario.expiraEm
    })),
    ...portal.formulariosRespondidos.map((formulario) => ({
      id: `formulario-respondido-${formulario.respostaId}`,
      tipo: 'Formulario respondido',
      titulo: formulario.titulo,
      descricao: formulario.scoreFinal ? `Score ${formulario.scoreFinal}` : rotuloStatus(formulario.status),
      data: formulario.finalizadoEm ?? formulario.respondidoEm
    })),
    ...portal.mensagensRecentes.map((mensagem) => ({
      id: `mensagem-${mensagem.id}`,
      tipo: 'Mensagem',
      titulo: mensagem.titulo,
      descricao: mensagem.texto || 'Mensagem registrada no acompanhamento.',
      data: mensagem.enviadoEm ?? mensagem.criadoEm
    })),
    ...tarefas.map((tarefa) => ({
      id: `tarefa-${tarefa.id}`,
      tipo: 'Tarefa',
      titulo: tarefa.titulo,
      descricao: `${rotuloStatus(tarefa.status)} - ${rotuloCategoriaTarefa(tarefa.categoria)}`,
      data: tarefa.vencimentoEm ?? tarefa.atualizadoEm
    })),
    ...materiais.map((material) => ({
      id: `material-${material.id}`,
      tipo: 'Material',
      titulo: material.titulo,
      descricao: material.resumo || material.observacao || rotuloTipoMaterial(material.tipo),
      data: material.enviadoEm ?? material.criadoEm
    })),
    ...diarios.map((diario) => ({
      id: `diario-${diario.id}`,
      tipo: 'Check-in',
      titulo: `Humor ${rotuloHumor(diario.humor)}`,
      descricao: `Adesao ${diario.adesaoPlano}%${diario.sintomas ? ` - ${diario.sintomas}` : ''}`,
      data: diario.registradoEm
    })),
    ...portal.lgpd.consentimentos.map((consentimento) => ({
      id: `lgpd-${consentimento.id}`,
      tipo: 'Privacidade',
      titulo: rotuloConsentimento(consentimento.tipo),
      descricao: `Versao ${consentimento.versao}`,
      data: consentimento.aceitoEm
    }))
  ];

  return itens
    .sort((a, b) => timestampLinhaTempo(b.data) - timestampLinhaTempo(a.data))
    .slice(0, 8);
}

function atualizarPortalComCheckin(
  portal: PortalPacienteApi | null,
  checkin: CheckinRapidoPacienteApi
): PortalPacienteApi | null {
  if (!portal) return portal;
  const diariosRecentes = [checkin, ...(portal.diariosRecentes ?? []).filter((item) => item.id !== checkin.id)].slice(0, 5);

  return {
    ...portal,
    paciente: { ...portal.paciente, ultimoCheckinEm: checkin.registradoEm },
    perfil: { ...portal.perfil, ultimoCheckinEm: checkin.registradoEm },
    resumo: {
      ...portal.resumo,
      checkinsRecentes: diariosRecentes.length
    },
    diariosRecentes
  };
}

const linksPortal = [
  { href: '#resumo', rotulo: 'Resumo' },
  { href: '#acoes', rotulo: 'Acoes' },
  { href: '#plano', rotulo: 'Plano' },
  { href: '#notificacoes', rotulo: 'Notificacoes' },
  { href: '#historico', rotulo: 'Historico' },
  { href: '#perfil', rotulo: 'Perfil' },
  { href: '#privacidade', rotulo: 'Privacidade' }
];

function PortalCarregando() {
  return (
    <section className="grid gap-4 rounded-lg border border-linha bg-white p-5" aria-live="polite" aria-busy="true">
      <div>
        <h2 className="text-sm font-semibold">Carregando portal</h2>
        <p className="mt-1 text-sm text-[#596273]">Atualizando suas informacoes.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-md border border-linha bg-[#f8fafb]" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-md border border-linha bg-[#f8fafb]" />
    </section>
  );
}

export function PortalPaciente() {
  const router = useRouter();
  const [portal, setPortal] = useState<PortalPacienteApi | null>(null);
  const [detalheFormulario, setDetalheFormulario] = useState<DetalheFormularioRespondidoApi | null>(null);
  const [formularioPerfil, setFormularioPerfil] = useState<FormularioPerfilPaciente>(formularioPerfilVazio);
  const [formularioCheckin, setFormularioCheckin] = useState<FormularioCheckinRapido>(formularioCheckinInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalheId, setCarregandoDetalheId] = useState<string | null>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoCheckin, setSalvandoCheckin] = useState(false);
  const [salvandoConsentimento, setSalvandoConsentimento] = useState(false);
  const [exportandoLgpd, setExportandoLgpd] = useState(false);
  const [solicitandoLgpd, setSolicitandoLgpd] = useState(false);
  const [tipoSolicitacaoLgpd, setTipoSolicitacaoLgpd] = useState<'retificacao' | 'exclusao'>('retificacao');
  const [detalhesSolicitacaoLgpd, setDetalhesSolicitacaoLgpd] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const portalAtualizado = await obterPortalPaciente();
      setPortal(portalAtualizado);
      setFormularioPerfil(montarFormularioPerfil(portalAtualizado));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar portal.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvarPerfil(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoPerfil(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizado = await atualizarPerfilPaciente({
        nome: formularioPerfil.nome.trim() || undefined,
        email: formularioPerfil.email.trim() || undefined,
        whatsapp: formularioPerfil.whatsapp.trim() || undefined,
        dataNascimento: formularioPerfil.dataNascimento || undefined,
        prefereEmail: formularioPerfil.prefereEmail,
        prefereWhatsapp: formularioPerfil.prefereWhatsapp,
        canalPreferido: formularioPerfil.canalPreferido,
        horarioInicio: formularioPerfil.horarioInicio,
        horarioFim: formularioPerfil.horarioFim,
        timezoneComunicacao: formularioPerfil.timezoneComunicacao.trim() || undefined
      });
      setPortal((atual) =>
        atual
          ? {
              ...atual,
              paciente: atualizado.paciente,
              perfil: atualizado.perfil
            }
          : atual
      );
      setFormularioPerfil({
        nome: atualizado.paciente.nome ?? '',
        email: atualizado.perfil.email ?? '',
        whatsapp: atualizado.perfil.whatsapp ?? '',
        dataNascimento: atualizado.perfil.dataNascimento ?? '',
        prefereEmail: atualizado.perfil.preferenciasContato.email,
        prefereWhatsapp: atualizado.perfil.preferenciasContato.whatsapp,
        canalPreferido: atualizado.perfil.preferenciasContato.canalPreferido,
        horarioInicio: atualizado.perfil.preferenciasContato.horarioPermitido.inicio,
        horarioFim: atualizado.perfil.preferenciasContato.horarioPermitido.fim,
        timezoneComunicacao: atualizado.perfil.preferenciasContato.horarioPermitido.timezone
      });
      setSucesso('Perfil atualizado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao atualizar perfil.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function abrirFormularioRespondido(respostaId: string) {
    setCarregandoDetalheId(respostaId);
    setErro(null);
    try {
      setDetalheFormulario(await obterFormularioRespondidoPaciente(respostaId));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar formulario respondido.');
    } finally {
      setCarregandoDetalheId(null);
    }
  }

  async function enviarCheckinRapido(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoCheckin(true);
    setErro(null);
    setSucesso(null);
    try {
      const adesaoPlano = Math.max(0, Math.min(100, Number(formularioCheckin.adesaoPlano || 0)));
      const checkin = await registrarCheckinRapidoPaciente({
        humor: formularioCheckin.humor,
        adesaoPlano,
        sintomas: formularioCheckin.sintomas.trim() || undefined,
        observacoes: formularioCheckin.observacoes.trim() || undefined
      });
      setPortal((atual) => atualizarPortalComCheckin(atual, checkin));
      setFormularioCheckin(formularioCheckinInicial);
      setSucesso('Check-in registrado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar check-in.');
    } finally {
      setSalvandoCheckin(false);
    }
  }

  async function registrarAceiteLgpd() {
    if (!portal) return;
    setSalvandoConsentimento(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await registrarConsentimentoLgpdPaciente({
        aceiteLgpd: true,
        aceiteTermosUso: true,
        aceitePoliticaPrivacidade: true,
        versaoLgpd: versaoDocumentoLegal(portal, 'consentimento_lgpd'),
        versaoTermosUso: versaoDocumentoLegal(portal, 'termos_uso'),
        versaoPoliticaPrivacidade: versaoDocumentoLegal(portal, 'politica_privacidade'),
        prefereEmail: formularioPerfil.prefereEmail,
        prefereWhatsapp: formularioPerfil.prefereWhatsapp
      });
      setPortal((atual) =>
        atual
          ? {
              ...atual,
              paciente: resultado.paciente,
              perfil: resultado.perfil,
              lgpd: resultado.lgpd
            }
          : atual
      );
      setFormularioPerfil((atual) => ({
        ...atual,
        prefereEmail: resultado.perfil.preferenciasContato.email,
        prefereWhatsapp: resultado.perfil.preferenciasContato.whatsapp
      }));
      setSucesso('Consentimento LGPD registrado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar consentimento LGPD.');
    } finally {
      setSalvandoConsentimento(false);
    }
  }

  async function exportarDadosLgpd() {
    setExportandoLgpd(true);
    setErro(null);
    setSucesso(null);
    try {
      const exportacao = await exportarDadosLgpdPaciente();
      const blob = new Blob([JSON.stringify(exportacao, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `octaclin-dados-${exportacao.titular.pacienteId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      const hashCurto = exportacao.integridade?.hash ? ` Hash ${exportacao.integridade.hash.slice(0, 12)}.` : '';
      setSucesso(`Exportacao LGPD completa gerada para ${exportacao.titular.nome}.${hashCurto}`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao exportar dados LGPD.');
    } finally {
      setExportandoLgpd(false);
    }
  }

  async function enviarSolicitacaoLgpd(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSolicitandoLgpd(true);
    setErro(null);
    setSucesso(null);
    try {
      const solicitacao = await registrarSolicitacaoLgpdPaciente({
        tipo: tipoSolicitacaoLgpd,
        detalhes: detalhesSolicitacaoLgpd.trim() || undefined
      });
      setDetalhesSolicitacaoLgpd('');
      await carregar();
      setSucesso(`Solicitacao LGPD registrada: ${solicitacao.protocolo}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar solicitacao LGPD.');
    } finally {
      setSolicitandoLgpd(false);
    }
  }

  const linhaTempo = portal ? montarLinhaTempoPortal(portal) : [];
  const tarefasAcompanhamento = portal?.tarefasAcompanhamento ?? [];
  const materiaisDisponiveis = portal?.materiaisDisponiveis ?? [];
  const diariosRecentes = portal?.diariosRecentes ?? [];
  const notificacoesPaciente = portal?.notificacoesPaciente ?? [];
  const notificacoesPendentes = notificacoesPaciente.filter((notificacao) => ehNotificacaoPendente(notificacao.status));

  async function encerrarSessao() {
    await sair();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-fundo text-tinta">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primaria text-white">
              <HeartPulse size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#596273]">OctaClin</p>
              <h1 className="text-xl font-semibold">Portal do paciente</h1>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Botao type="button" onClick={() => void carregar()} disabled={carregando}>
              <RefreshCcw className="h-4 w-4" />
              {carregando ? 'Atualizando' : 'Atualizar'}
            </Botao>
            <Botao type="button" variante="fantasma" onClick={encerrarSessao}>
              <LogOut className="h-4 w-4" />
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5">
        {erro && portal ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
            <AlertTriangle size={16} />
            {erro}
          </div>
        ) : null}

        {sucesso ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#b9ddc7] bg-[#f0fbf4] px-4 py-3 text-sm text-[#23633b]">
            <CheckCircle2 size={16} />
            {sucesso}
          </div>
        ) : null}

        {portal ? (
          <>
            <nav aria-label="Navegacao do portal" className="overflow-x-auto rounded-lg border border-linha bg-white p-2">
              <div className="flex min-w-max gap-2">
                {linksPortal.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="inline-flex h-10 min-w-24 items-center justify-center rounded-md px-3 text-sm font-medium text-[#596273] outline-none hover:bg-[#eef5f8] focus-visible:ring-2 focus-visible:ring-[#c7e4ef]"
                  >
                    {link.rotulo}
                  </a>
                ))}
              </div>
            </nav>

            <section id="resumo" className="scroll-mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_repeat(3,140px)] xl:grid-cols-[minmax(0,1fr)_repeat(8,104px)]">
              <div>
                <p className="text-sm text-[#596273]">Ola,</p>
                <h2 className="text-2xl font-semibold text-tinta">{portal.paciente.nome}</h2>
                <p className="mt-1 text-sm text-[#596273]">
                  Status {rotuloStatus(portal.paciente.statusAdesao)} - risco {portal.paciente.scoreRisco}
                </p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Consultas</p>
                <p className="text-2xl font-semibold">{portal.resumo.consultasProximas}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Formularios</p>
                <p className="text-2xl font-semibold">{portal.resumo.formulariosPendentes}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Respondidos</p>
                <p className="text-2xl font-semibold">{portal.resumo.formulariosRespondidos}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Mensagens</p>
                <p className="text-2xl font-semibold">{portal.resumo.mensagensRecentes}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Tarefas</p>
                <p className="text-2xl font-semibold">{portal.resumo.tarefasPendentes ?? tarefasAcompanhamento.length}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Materiais</p>
                <p className="text-2xl font-semibold">{portal.resumo.materiaisDisponiveis ?? materiaisDisponiveis.length}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Check-ins</p>
                <p className="text-2xl font-semibold">{portal.resumo.checkinsRecentes ?? diariosRecentes.length}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Notificacoes</p>
                <p className="text-2xl font-semibold">{portal.resumo.notificacoesPendentes ?? notificacoesPendentes.length}</p>
              </div>
            </section>

            <section id="acoes" className="scroll-mt-4 rounded-lg border border-linha bg-white">
              <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                <ClipboardList className="h-4 w-4 text-[#596273]" />
                <h2 className="text-sm font-semibold">Proximas acoes</h2>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {portal.formulariosPendentes.slice(0, 2).map((formulario) => (
                  <article key={formulario.envioId} className="flex min-w-0 flex-col gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{formulario.titulo}</p>
                      <p className="mt-1 text-xs text-[#596273]">Expira em {formatarDataHora(formulario.expiraEm)}</p>
                    </div>
                    <a
                      href={formulario.linkFormulario}
                      className="inline-flex h-9 w-full min-w-0 max-w-full items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-[#1d6684] sm:w-auto sm:max-w-[260px]"
                    >
                      <span className="truncate">Responder {formulario.titulo}</span>
                    </a>
                  </article>
                ))}

                {portal.consultasProximas.slice(0, 1).map((consulta) => (
                  <article key={consulta.id} className="flex min-w-0 flex-col gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{consulta.titulo}</p>
                      <p className="mt-1 text-xs text-[#596273]">{formatarDataHora(consulta.inicioEm)}</p>
                    </div>
                    {consulta.googleEventHtmlLink ? (
                      <a className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-[#eef5f8] sm:w-auto" href={consulta.googleEventHtmlLink}>
                        Abrir agenda
                      </a>
                    ) : (
                      <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-[#596273]">
                        {rotuloStatus(consulta.status)}
                      </span>
                    )}
                  </article>
                ))}

                {!portal.formulariosPendentes.length && !portal.consultasProximas.length ? (
                  <p className="text-sm text-[#596273]">Nenhuma acao pendente para hoje.</p>
                ) : null}
              </div>
            </section>

            <section id="checkin-rapido" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <SmilePlus className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Check-in rapido</h2>
                </div>
                <form onSubmit={enviarCheckinRapido} className="grid gap-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-[#596273]">
                      Humor de hoje
                      <select
                        className={classeCampo}
                        value={formularioCheckin.humor}
                        onChange={(evento) =>
                          setFormularioCheckin((atual) => ({
                            ...atual,
                            humor: evento.target.value as HumorCheckinRapidoPaciente
                          }))
                        }
                      >
                        <option value="muito_bem">Muito bem</option>
                        <option value="bem">Bem</option>
                        <option value="neutro">Neutro</option>
                        <option value="mal">Mal</option>
                        <option value="muito_mal">Muito mal</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-[#596273]">
                      Adesao ao plano
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={classeCampo}
                        value={formularioCheckin.adesaoPlano}
                        onChange={(evento) => setFormularioCheckin((atual) => ({ ...atual, adesaoPlano: evento.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-medium text-[#596273]">
                    Sintomas ou sinais
                    <input
                      className={classeCampo}
                      value={formularioCheckin.sintomas}
                      onChange={(evento) => setFormularioCheckin((atual) => ({ ...atual, sintomas: evento.target.value }))}
                      maxLength={500}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-[#596273]">
                    Observacoes do dia
                    <textarea
                      className="min-h-24 rounded-md border border-linha bg-white px-3 py-2 text-sm outline-none focus:border-primaria focus:ring-2 focus:ring-[#c7e4ef]"
                      value={formularioCheckin.observacoes}
                      onChange={(evento) => setFormularioCheckin((atual) => ({ ...atual, observacoes: evento.target.value }))}
                      maxLength={1000}
                    />
                  </label>
                  <div className="flex justify-end border-t border-linha pt-3">
                    <Botao type="submit" variante="primario" disabled={salvandoCheckin}>
                      <Save className="h-4 w-4" />
                      {salvandoCheckin ? 'Registrando' : 'Registrar check-in'}
                    </Botao>
                  </div>
                </form>
              </section>

              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <Clock3 className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Diario recente</h2>
                </div>
                <div className="grid gap-3 p-4">
                  {diariosRecentes.length ? (
                    diariosRecentes.map((diario) => (
                      <article key={diario.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">Humor {rotuloHumor(diario.humor)}</p>
                            <p className="mt-1 text-xs text-[#596273]">{formatarDataHora(diario.registradoEm)}</p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            Adesao {diario.adesaoPlano}%
                          </span>
                        </div>
                        {diario.sintomas ? <p className="mt-3 break-words text-sm text-[#596273]">{diario.sintomas}</p> : null}
                        {diario.observacoes ? <p className="mt-2 break-words text-sm text-[#343c4b]">{diario.observacoes}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[#596273]">Nenhum check-in registrado ainda.</p>
                  )}
                </div>
              </section>
            </section>

            <section id="plano" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <Target className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Plano de acompanhamento</h2>
                </div>
                <div className="grid gap-3 p-4">
                  {tarefasAcompanhamento.length ? (
                    tarefasAcompanhamento.map((tarefa) => (
                      <article key={tarefa.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{tarefa.titulo}</p>
                            <p className="mt-1 text-xs text-[#596273]">
                              {rotuloCategoriaTarefa(tarefa.categoria)} - vencimento {formatarDataHora(tarefa.vencimentoEm)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {rotuloStatus(tarefa.status)}
                            </span>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {rotuloPrioridade(tarefa.prioridade)}
                            </span>
                          </div>
                        </div>
                        {tarefa.descricao ? <p className="mt-3 break-words text-sm text-[#596273]">{tarefa.descricao}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[#596273]">Nenhuma tarefa ativa no plano.</p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <BookOpen className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Materiais do plano</h2>
                </div>
                <div className="grid gap-3 p-4">
                  {materiaisDisponiveis.length ? (
                    materiaisDisponiveis.map((material) => (
                      <article key={material.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{material.titulo}</p>
                            <p className="mt-1 text-xs text-[#596273]">
                              {rotuloTipoMaterial(material.tipo)}
                              {material.categoria ? ` - ${material.categoria}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            {rotuloStatus(material.status)}
                          </span>
                        </div>
                        {material.resumo ? <p className="mt-3 break-words text-sm text-[#596273]">{material.resumo}</p> : null}
                        {material.observacao ? <p className="mt-2 break-words text-xs text-[#596273]">{material.observacao}</p> : null}
                        {material.conteudo ? <p className="mt-3 line-clamp-4 break-words text-sm text-[#343c4b]">{material.conteudo}</p> : null}
                        {material.url ? (
                          <a
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir ${material.titulo}`}
                            className="mt-3 inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-[#eef5f8]"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" />
                            <span className="truncate">Abrir material</span>
                          </a>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[#596273]">Nenhum material disponivel no plano.</p>
                  )}
                </div>
              </section>
            </section>

            <section id="notificacoes" className="scroll-mt-4 rounded-lg border border-linha bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-3">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Notificacoes do paciente</h2>
                </div>
                <span className="rounded-full border border-linha bg-[#f8fafb] px-2 py-1 text-xs font-semibold text-[#596273]">
                  {portal.resumo.notificacoesHistorico ?? notificacoesPaciente.length} no historico
                </span>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold">Pendentes</p>
                    <p className="mt-1 text-xs text-[#596273]">Mensagens ainda aguardando envio ou processamento.</p>
                  </div>
                  {notificacoesPendentes.length ? (
                    notificacoesPendentes.map((notificacao) => (
                      <article key={notificacao.id} className="rounded-md border border-linha bg-[#fffaf0] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{notificacao.titulo}</p>
                            <p className="mt-1 text-xs text-[#596273]">
                              {rotuloCanalNotificacao(notificacao.canal)}
                              {notificacao.evento ? ` - ${notificacao.evento}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            {rotuloStatus(notificacao.status)}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-3 break-words text-sm text-[#596273]">
                          {notificacao.texto || 'Notificacao registrada no acompanhamento.'}
                        </p>
                        <p className="mt-3 text-xs text-[#596273]">
                          {notificacao.agendadoPara ? `Agendada para ${formatarDataHora(notificacao.agendadoPara)}` : `Criada em ${formatarDataHora(notificacao.criadoEm)}`}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-linha bg-[#f8fafb] p-3 text-sm text-[#596273]">Nenhuma notificacao pendente.</p>
                  )}
                </div>

                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold">Historico</p>
                    <p className="mt-1 text-xs text-[#596273]">Ultimas notificacoes registradas para este paciente.</p>
                  </div>
                  {notificacoesPaciente.length ? (
                    notificacoesPaciente.slice(0, 6).map((notificacao) => (
                      <article key={notificacao.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{notificacao.titulo}</p>
                            <p className="mt-1 text-xs text-[#596273]">{rotuloCanalNotificacao(notificacao.canal)}</p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            {rotuloStatus(notificacao.status)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 break-words text-sm text-[#596273]">
                          {notificacao.texto || 'Notificacao registrada no acompanhamento.'}
                        </p>
                        <dl className="mt-3 grid gap-2 text-xs text-[#596273] sm:grid-cols-2">
                          <div>
                            <dt className="font-medium text-[#343c4b]">Criada em</dt>
                            <dd>{formatarDataHora(notificacao.criadoEm)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-[#343c4b]">Enviada em</dt>
                            <dd>{formatarDataHora(notificacao.enviadoEm ?? notificacao.agendadoPara)}</dd>
                          </div>
                        </dl>
                        {notificacao.erro ? <p className="mt-3 break-words text-xs text-perigo">{notificacao.erro}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-linha bg-[#f8fafb] p-3 text-sm text-[#596273]">Nenhuma notificacao registrada.</p>
                  )}
                </div>
              </div>
            </section>

            <section id="historico" className="scroll-mt-4 rounded-lg border border-linha bg-white">
              <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                <Clock3 className="h-4 w-4 text-[#596273]" />
                <h2 className="text-sm font-semibold">Linha do tempo</h2>
              </div>
              <div className="grid gap-3 p-4">
                {linhaTempo.length ? (
                  linhaTempo.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-md border border-linha bg-[#f8fafb] p-3 sm:grid-cols-[150px_minmax(0,1fr)_140px] sm:items-start">
                      <span className="w-fit rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                        {item.tipo}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.titulo}</p>
                        <p className="mt-1 line-clamp-2 break-words text-xs text-[#596273]">{item.descricao}</p>
                      </div>
                      <time className="text-xs text-[#596273] sm:text-right">{formatarDataHora(item.data)}</time>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[#596273]">Nenhuma movimentacao recente registrada.</p>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="grid gap-4">
                <section id="perfil" className="scroll-mt-4 rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <UserRound className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Meu perfil</h2>
                  </div>
                  <form onSubmit={salvarPerfil} className="grid gap-3 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        Nome
                        <input
                          className={classeCampo}
                          value={formularioPerfil.nome}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, nome: evento.target.value }))}
                          maxLength={180}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        Nascimento
                        <input
                          type="date"
                          className={classeCampo}
                          value={formularioPerfil.dataNascimento}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, dataNascimento: evento.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        E-mail
                        <input
                          type="email"
                          className={classeCampo}
                          value={formularioPerfil.email}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, email: evento.target.value }))}
                          maxLength={180}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        WhatsApp
                        <input
                          className={classeCampo}
                          value={formularioPerfil.whatsapp}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, whatsapp: evento.target.value }))}
                          maxLength={30}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex items-center gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 py-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primaria"
                          checked={formularioPerfil.prefereEmail}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, prefereEmail: evento.target.checked }))}
                        />
                        Receber e-mail
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 py-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primaria"
                          checked={formularioPerfil.prefereWhatsapp}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, prefereWhatsapp: evento.target.checked }))}
                        />
                        Receber WhatsApp
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        Canal preferido
                        <select
                          className={classeCampo}
                          value={formularioPerfil.canalPreferido}
                          onChange={(evento) =>
                            setFormularioPerfil((atual) => ({
                              ...atual,
                              canalPreferido: evento.target.value as CanalPreferidoComunicacaoPaciente
                            }))
                          }
                        >
                          <option value="qualquer">Qualquer canal</option>
                          <option value="email">E-mail</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        Inicio
                        <input
                          type="time"
                          className={classeCampo}
                          value={formularioPerfil.horarioInicio}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, horarioInicio: evento.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-[#596273]">
                        Fim
                        <input
                          type="time"
                          className={classeCampo}
                          value={formularioPerfil.horarioFim}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, horarioFim: evento.target.value }))}
                        />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-medium text-[#596273] sm:max-w-xs">
                      Fuso horario
                      <input
                        className={classeCampo}
                        value={formularioPerfil.timezoneComunicacao}
                        onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, timezoneComunicacao: evento.target.value }))}
                        maxLength={80}
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
                      <div className="text-xs text-[#596273]">
                        Ultimo check-in {formatarDataHora(portal.perfil.ultimoCheckinEm)} - status {rotuloStatus(portal.paciente.statusAdesao)}
                      </div>
                      <Botao type="submit" variante="primario" disabled={salvandoPerfil}>
                        <Save className="h-4 w-4" />
                        {salvandoPerfil ? 'Salvando' : 'Salvar perfil'}
                      </Botao>
                    </div>
                  </form>
                </section>

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <ClipboardList className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Formularios pendentes</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.formulariosPendentes.length ? (
                      portal.formulariosPendentes.map((formulario) => (
                        <article key={formulario.envioId} className="flex flex-col gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{formulario.titulo}</p>
                            <p className="text-xs text-[#596273]">
                              {rotuloStatus(formulario.status)} - expira em {formatarDataHora(formulario.expiraEm)}
                            </p>
                          </div>
                          <a
                            href={formulario.linkFormulario}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-[#1d6684]"
                          >
                            Responder
                          </a>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum formulario pendente.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Historico de formularios</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.formulariosRespondidos.length ? (
                      portal.formulariosRespondidos.map((formulario) => (
                        <article key={formulario.respostaId} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{formulario.titulo}</p>
                              <p className="text-xs text-[#596273]">
                                Respondido em {formatarDataHora(formulario.finalizadoEm ?? formulario.respondidoEm)}
                              </p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {formulario.scoreFinal ? `Score ${formulario.scoreFinal}` : rotuloStatus(formulario.status)}
                            </span>
                          </div>
                          <Botao
                            type="button"
                            className="mt-3"
                            onClick={() => void abrirFormularioRespondido(formulario.respostaId)}
                            disabled={carregandoDetalheId === formulario.respostaId}
                          >
                            {carregandoDetalheId === formulario.respostaId ? 'Abrindo' : 'Ver respostas'}
                          </Botao>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum formulario respondido ainda.</p>
                    )}
                  </div>
                </section>

                {detalheFormulario ? (
                  <section className="rounded-lg border border-linha bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linha px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold">{detalheFormulario.titulo}</h2>
                        <p className="mt-1 text-xs text-[#596273]">
                          Finalizado em {formatarDataHora(detalheFormulario.finalizadoEm)}
                          {detalheFormulario.scoreFinal ? ` - score ${detalheFormulario.scoreFinal}` : ''}
                        </p>
                      </div>
                      <Botao type="button" variante="fantasma" onClick={() => setDetalheFormulario(null)}>
                        Fechar
                      </Botao>
                    </div>
                    <div className="grid gap-3 p-4">
                      {detalheFormulario.descricao ? <p className="text-sm text-[#596273]">{detalheFormulario.descricao}</p> : null}
                      <dl className="grid gap-3">
                        {detalheFormulario.respostas.map((resposta) => (
                          <div key={resposta.perguntaId} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                            <dt className="flex flex-wrap items-start justify-between gap-2 text-sm font-semibold">
                              <span>{resposta.enunciado}</span>
                              <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-medium text-[#596273]">
                                {resposta.obrigatoria ? 'Obrigatoria' : 'Opcional'}
                              </span>
                            </dt>
                            <dd className="mt-2 break-words text-sm text-[#596273]">{formatarValor(resposta.valor)}</dd>
                            {resposta.scorePonderado ? (
                              <p className="mt-2 text-xs font-semibold text-[#596273]">Score {resposta.scorePonderado}</p>
                            ) : null}
                          </div>
                        ))}
                      </dl>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <CalendarDays className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Proximas consultas</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.consultasProximas.length ? (
                      portal.consultasProximas.map((consulta) => (
                        <article key={consulta.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{consulta.titulo}</p>
                              <p className="text-xs text-[#596273]">{formatarDataHora(consulta.inicioEm)}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {rotuloStatus(consulta.status)}
                            </span>
                          </div>
                          {consulta.local ? <p className="mt-2 text-sm text-[#596273]">{consulta.local}</p> : null}
                          {consulta.googleEventHtmlLink ? (
                            <a className="mt-3 inline-flex text-sm font-semibold text-primaria" href={consulta.googleEventHtmlLink}>
                              Abrir no Google Agenda
                            </a>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhuma consulta futura agendada.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <MessageCircle className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Mensagens recentes</h2>
                </div>
                <div className="grid gap-3 p-4">
                  {portal.mensagensRecentes.length ? (
                    portal.mensagensRecentes.map((mensagem) => (
                      <article key={mensagem.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{mensagem.titulo}</p>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            {rotuloStatus(mensagem.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#596273]">{mensagem.texto || 'Mensagem registrada no acompanhamento.'}</p>
                        <p className="mt-3 text-xs text-[#596273]">{formatarDataHora(mensagem.enviadoEm ?? mensagem.criadoEm)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[#596273]">Nenhuma mensagem recente.</p>
                  )}
                </div>
              </section>

              <section id="privacidade" className="scroll-mt-4 rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <ShieldCheck className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Privacidade</h2>
                </div>
                <div className="grid gap-3 p-4">
                  <div className="rounded-md border border-linha bg-[#f8fafb] p-3">
                    <p className="text-xs text-[#596273]">Versao atual</p>
                    <p className="mt-1 text-sm font-semibold">{portal.lgpd.versaoAtual}</p>
                    <p className="mt-1 text-xs text-[#596273]">Ultimo aceite {formatarDataHora(portal.lgpd.ultimoAceiteEm)}</p>
                  </div>
                  <div className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3">
                    <div>
                      <p className="text-sm font-semibold">Documentos legais</p>
                      <p className="mt-1 text-xs text-[#596273]">Versoes obrigatorias aplicaveis ao portal do paciente.</p>
                    </div>
                    <div className="grid gap-2">
                      {(portal.lgpd.documentosLegais ?? []).map((documento) => (
                        <article key={`${documento.tipo}-${documento.versao}`} className="rounded-md border border-linha bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold">{documento.titulo}</p>
                              <p className="mt-1 text-xs text-[#596273]">Versao {documento.versao}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-[#f8fafb] px-2 py-1 text-xs font-semibold text-[#596273]">
                              {documento.aceito ? 'Aceito' : 'Pendente'}
                            </span>
                          </div>
                          <p className="mt-2 break-words text-xs text-[#596273]">{documento.resumo}</p>
                          {documento.aceitoEm ? <p className="mt-2 text-xs text-[#596273]">Aceito em {formatarDataHora(documento.aceitoEm)}</p> : null}
                        </article>
                      ))}
                      {!(portal.lgpd.documentosLegais ?? []).length ? (
                        <p className="text-sm text-[#596273]">Nenhum documento legal versionado retornado.</p>
                      ) : null}
                    </div>
                  </div>
                  <Botao type="button" variante="primario" onClick={() => void registrarAceiteLgpd()} disabled={salvandoConsentimento}>
                    <ShieldCheck className="h-4 w-4" />
                    {salvandoConsentimento ? 'Registrando' : 'Registrar aceite'}
                  </Botao>
                  <div className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3">
                    <div>
                      <p className="text-sm font-semibold">Meus dados</p>
                      <p className="mt-1 text-xs text-[#596273]">Baixe uma copia do seu perfil, consultas, formularios, mensagens e historico LGPD.</p>
                    </div>
                    <Botao type="button" onClick={() => void exportarDadosLgpd()} disabled={exportandoLgpd}>
                      <ShieldCheck className="h-4 w-4" />
                      {exportandoLgpd ? 'Gerando' : 'Baixar meus dados'}
                    </Botao>
                  </div>
                  <form onSubmit={enviarSolicitacaoLgpd} className="grid gap-3 rounded-md border border-linha bg-[#f8fafb] p-3">
                    <div>
                      <p className="text-sm font-semibold">Solicitacoes LGPD</p>
                      <p className="mt-1 text-xs text-[#596273]">Abra um protocolo para corrigir seus dados ou solicitar exclusao conforme avaliacao legal.</p>
                    </div>
                    <label className="grid gap-1 text-xs font-medium text-[#596273]">
                      Tipo de solicitacao LGPD
                      <select
                        value={tipoSolicitacaoLgpd}
                        onChange={(evento) => setTipoSolicitacaoLgpd(evento.target.value as 'retificacao' | 'exclusao')}
                        className="h-10 rounded-md border border-linha bg-white px-3 text-sm text-tinta"
                      >
                        <option value="retificacao">Retificacao de dados</option>
                        <option value="exclusao">Exclusao de dados</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-[#596273]">
                      Detalhes da solicitacao
                      <textarea
                        value={detalhesSolicitacaoLgpd}
                        onChange={(evento) => setDetalhesSolicitacaoLgpd(evento.target.value)}
                        maxLength={1000}
                        className="min-h-24 rounded-md border border-linha bg-white px-3 py-2 text-sm text-tinta"
                      />
                    </label>
                    <Botao type="submit" variante="primario" disabled={solicitandoLgpd}>
                      {solicitandoLgpd ? 'Enviando' : 'Enviar solicitacao LGPD'}
                    </Botao>
                  </form>
                  <div className="grid gap-2">
                    <div>
                      <p className="text-sm font-semibold">Meus protocolos LGPD</p>
                      <p className="mt-1 text-xs text-[#596273]">Acompanhe as solicitacoes abertas pelo portal e o andamento registrado pela equipe.</p>
                    </div>
                    {portal.lgpd.solicitacoes.length ? (
                      portal.lgpd.solicitacoes.map((solicitacao) => (
                        <article key={solicitacao.protocolo} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold">{solicitacao.protocolo}</p>
                              <p className="mt-1 text-xs text-[#596273]">{rotuloTipoSolicitacaoLgpd(solicitacao.tipo)}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {rotuloStatusSolicitacaoLgpd(solicitacao.status)}
                            </span>
                          </div>
                          {solicitacao.detalhes ? <p className="mt-2 break-words text-sm text-[#343c4b]">{solicitacao.detalhes}</p> : null}
                          <dl className="mt-3 grid gap-2 text-xs text-[#596273] sm:grid-cols-2">
                            <div>
                              <dt className="font-medium text-[#343c4b]">Aberto em</dt>
                              <dd>{formatarDataHora(solicitacao.abertoEm)}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-[#343c4b]">Atualizado em</dt>
                              <dd>{formatarDataHora(solicitacao.atualizadoEm)}</dd>
                            </div>
                          </dl>
                          {solicitacao.ultimaTratativa ? (
                            <p className="mt-3 break-words text-xs text-[#596273]">
                              Ultima tratativa: <span className="font-medium text-[#343c4b]">{solicitacao.ultimaTratativa}</span>
                            </p>
                          ) : null}
                          {solicitacao.ultimaResposta ? (
                            <p className="mt-2 break-words text-xs text-[#596273]">
                              Ultima resposta: <span className="font-medium text-[#343c4b]">{solicitacao.ultimaResposta}</span>
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum protocolo LGPD aberto.</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {portal.lgpd.consentimentos.length ? (
                      portal.lgpd.consentimentos.map((consentimento) => (
                        <article key={consentimento.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold">{rotuloConsentimento(consentimento.tipo)}</p>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {consentimento.versao}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[#596273]">{formatarDataHora(consentimento.aceitoEm)}</p>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum consentimento registrado.</p>
                    )}
                  </div>
                </div>
              </section>
            </section>
          </>
        ) : (
          carregando ? (
            <PortalCarregando />
          ) : (
            <section className="grid gap-4 rounded-lg border border-[#efb8ad] bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff4f1] text-perigo">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">Portal indisponivel</h2>
                  <p className="mt-1 break-words text-sm text-[#596273]">{erro ?? 'Nao foi possivel carregar suas informacoes.'}</p>
                </div>
              </div>
              <div>
                <Botao type="button" variante="primario" onClick={() => void carregar()}>
                  <RefreshCcw className="h-4 w-4" />
                  Tentar novamente
                </Botao>
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}
