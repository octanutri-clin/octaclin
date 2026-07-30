'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  MessageCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
  SmilePlus,
  Target,
  UserRound
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { PortalShell } from '@/components/app/portal-shell';
import {
  atualizarPerfilPaciente,
  CheckinRapidoPacienteApi,
  DetalheFormularioRespondidoApi,
  desmarcarConsultaPaciente,
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
  'h-10 rounded-md border border-linha bg-white px-3 text-sm outline-none focus:border-primaria focus:ring-2 focus:ring-primaria-suave';

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

const linksPortalMobile = [
  { href: '#resumo', rotulo: 'Inicio', icone: HeartPulse },
  { href: '#acoes', rotulo: 'Agenda', icone: CalendarDays },
  { href: '#plano', rotulo: 'Plano', icone: Target },
  { href: '#notificacoes', rotulo: 'Mensagens', icone: BellRing },
  { href: '#perfil', rotulo: 'Perfil', icone: UserRound }
];

function PortalCarregando() {
  return (
    <Cartao className="grid gap-4 p-5" aria-live="polite" aria-busy="true">
      <div>
        <h2 className="text-sm font-semibold">Carregando portal</h2>
        <p className="mt-1 text-sm text-texto-suave">Atualizando suas informacoes.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-md border border-linha bg-superficie" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-md border border-linha bg-superficie" />
    </Cartao>
  );
}

export function PortalPaciente() {
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
  const [desmarcandoConsultaId, setDesmarcandoConsultaId] = useState<string | null>(null);

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

  async function desmarcarConsulta(consultaId: string) {
    setDesmarcandoConsultaId(consultaId);
    setErro(null);
    setSucesso(null);
    try {
      await desmarcarConsultaPaciente(consultaId);
      await carregar();
      setSucesso('Consulta desmarcada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao desmarcar consulta.');
    } finally {
      setDesmarcandoConsultaId(null);
    }
  }

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

  const acoesCabecalho = (
    <Botao type="button" onClick={() => void carregar()} disabled={carregando}>
      <RefreshCcw className="h-4 w-4" />
      {carregando ? 'Atualizando' : 'Atualizar'}
    </Botao>
  );

  return (
    <PortalShell
      variante="tabs"
      titulo="Portal do paciente"
      subtitulo="OctaClin"
      marca={{ icone: HeartPulse, rotulo: 'OctaClin', subrotulo: 'Portal do paciente' }}
      navegacao={portal ? linksPortal : []}
      navLabel="Navegacao do portal"
      navegacaoMobile={portal ? linksPortalMobile : []}
      navLabelMobile="Navegacao mobile do portal"
      acoes={acoesCabecalho}
      maxWidth="72rem"
    >
        {erro && portal ? (
          <div className="flex items-center gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo">
            <AlertTriangle size={16} />
            {erro}
          </div>
        ) : null}

        {sucesso ? (
          <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
            <CheckCircle2 size={16} />
            {sucesso}
          </div>
        ) : null}

        {portal ? (
          <>
            <section id="resumo" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
              <div className="self-center">
                <p className="text-sm text-texto-suave">Ola, {portal.paciente.nome}</p>
                <h2 className="mt-1 text-2xl font-semibold text-tinta">Seu acompanhamento hoje</h2>
                <p className="mt-2 text-sm text-texto-suave">Status {rotuloStatus(portal.paciente.statusAdesao)}</p>
              </div>

              <Cartao className="grid gap-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-tinta">Proxima acao</h3>
                  {portal.formulariosPendentes[0] ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-tinta">{portal.formulariosPendentes[0].titulo}</p>
                      <p className="mt-1 text-xs text-texto-suave">Responda ate {formatarDataHora(portal.formulariosPendentes[0].expiraEm)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-texto-suave">Nenhuma acao pendente agora.</p>
                  )}
                </div>
                {portal.formulariosPendentes[0] ? (
                  <a
                    href={portal.formulariosPendentes[0].linkFormulario}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                  >
                    Responder agora
                  </a>
                ) : null}
              </Cartao>

              <Cartao className="grid gap-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-tinta">Proxima consulta</h3>
                  {portal.consultasProximas[0] ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-tinta">{portal.consultasProximas[0].titulo}</p>
                      <p className="mt-1 text-xs text-texto-suave">{formatarDataHora(portal.consultasProximas[0].inicioEm)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-texto-suave">Nenhuma consulta futura agendada.</p>
                  )}
                </div>
                {portal.consultasProximas[0]?.googleEventHtmlLink ? (
                  <a
                    href={portal.consultasProximas[0].googleEventHtmlLink}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                  >
                    Abrir agenda
                  </a>
                ) : null}
              </Cartao>

              <Cartao className="grid gap-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-tinta">Plano em andamento</h3>
                  <p className="mt-2 text-sm font-medium text-tinta">
                    {portal.resumo.tarefasPendentes ?? tarefasAcompanhamento.length} tarefas e {portal.resumo.materiaisDisponiveis ?? materiaisDisponiveis.length} materiais
                  </p>
                  <p className="mt-1 text-xs text-texto-suave">Revise seu plano para manter o acompanhamento em dia.</p>
                </div>
                <a
                  href="#plano"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                >
                  Ver plano
                </a>
              </Cartao>
            </section>

            <Cartao id="acoes" className="scroll-mt-4">
              <CartaoCabecalho>
                <CartaoTitulo icone={<ClipboardList className="h-4 w-4" />}>Proximas acoes</CartaoTitulo>
              </CartaoCabecalho>
              <CartaoConteudo className="grid gap-3 md:grid-cols-2">
                {portal.formulariosPendentes.slice(0, 2).map((formulario) => (
                  <article key={formulario.envioId} className="flex min-w-0 flex-col gap-3 rounded-md border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{formulario.titulo}</p>
                      <p className="mt-1 text-xs text-texto-suave">Expira em {formatarDataHora(formulario.expiraEm)}</p>
                    </div>
                    <a
                      href={formulario.linkFormulario}
                      className="inline-flex h-9 w-full min-w-0 max-w-full items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte sm:w-auto sm:max-w-[260px]"
                    >
                      <span className="truncate">Responder {formulario.titulo}</span>
                    </a>
                  </article>
                ))}

                {portal.consultasProximas.slice(0, 1).map((consulta) => (
                  <article key={consulta.id} className="flex min-w-0 flex-col gap-3 rounded-md border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{consulta.titulo}</p>
                      <p className="mt-1 text-xs text-texto-suave">{formatarDataHora(consulta.inicioEm)}</p>
                    </div>
                    {consulta.googleEventHtmlLink ? (
                      <a className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie-hover sm:w-auto" href={consulta.googleEventHtmlLink}>
                        Abrir agenda
                      </a>
                    ) : (
                      <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-texto-suave">
                        {rotuloStatus(consulta.status)}
                      </span>
                    )}
                  </article>
                ))}

                {!portal.formulariosPendentes.length && !portal.consultasProximas.length ? (
                  <p className="text-sm text-texto-suave">Nenhuma acao pendente para hoje.</p>
                ) : null}
              </CartaoConteudo>
            </Cartao>

            <section id="checkin-rapido" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Cartao>
                <CartaoCabecalho>
                  <CartaoTitulo icone={<SmilePlus className="h-4 w-4" />}>Check-in rapido</CartaoTitulo>
                </CartaoCabecalho>
                <form onSubmit={enviarCheckinRapido} className="grid gap-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                    <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                  <label className="grid gap-1 text-xs font-medium text-texto-suave">
                    Sintomas ou sinais
                    <input
                      className={classeCampo}
                      value={formularioCheckin.sintomas}
                      onChange={(evento) => setFormularioCheckin((atual) => ({ ...atual, sintomas: evento.target.value }))}
                      maxLength={500}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-texto-suave">
                    Observacoes do dia
                    <textarea
                      className="min-h-24 rounded-md border border-linha bg-white px-3 py-2 text-sm outline-none focus:border-primaria focus:ring-2 focus:ring-primaria-suave"
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
              </Cartao>

              <Cartao>
                <CartaoCabecalho>
                  <CartaoTitulo icone={<Clock3 className="h-4 w-4" />}>Diario recente</CartaoTitulo>
                </CartaoCabecalho>
                <CartaoConteudo>
                  {diariosRecentes.length ? (
                    diariosRecentes.map((diario) => (
                      <article key={diario.id} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">Humor {rotuloHumor(diario.humor)}</p>
                            <p className="mt-1 text-xs text-texto-suave">{formatarDataHora(diario.registradoEm)}</p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                            Adesao {diario.adesaoPlano}%
                          </span>
                        </div>
                        {diario.sintomas ? <p className="mt-3 break-words text-sm text-texto-suave">{diario.sintomas}</p> : null}
                        {diario.observacoes ? <p className="mt-2 break-words text-sm text-texto-forte">{diario.observacoes}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-texto-suave">Nenhum check-in registrado ainda.</p>
                  )}
                </CartaoConteudo>
              </Cartao>
            </section>

            <section id="plano" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Cartao>
                <CartaoCabecalho>
                  <CartaoTitulo icone={<Target className="h-4 w-4" />}>Plano de acompanhamento</CartaoTitulo>
                </CartaoCabecalho>
                <CartaoConteudo>
                  {tarefasAcompanhamento.length ? (
                    tarefasAcompanhamento.map((tarefa) => (
                      <article key={tarefa.id} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{tarefa.titulo}</p>
                            <p className="mt-1 text-xs text-texto-suave">
                              {rotuloCategoriaTarefa(tarefa.categoria)} - vencimento {formatarDataHora(tarefa.vencimentoEm)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                              {rotuloStatus(tarefa.status)}
                            </span>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                              {rotuloPrioridade(tarefa.prioridade)}
                            </span>
                          </div>
                        </div>
                        {tarefa.descricao ? <p className="mt-3 break-words text-sm text-texto-suave">{tarefa.descricao}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-texto-suave">Nenhuma tarefa ativa no plano.</p>
                  )}
                </CartaoConteudo>
              </Cartao>

              <Cartao>
                <CartaoCabecalho>
                  <CartaoTitulo icone={<BookOpen className="h-4 w-4" />}>Materiais do plano</CartaoTitulo>
                </CartaoCabecalho>
                <CartaoConteudo>
                  {materiaisDisponiveis.length ? (
                    materiaisDisponiveis.map((material) => (
                      <article key={material.id} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{material.titulo}</p>
                            <p className="mt-1 text-xs text-texto-suave">
                              {rotuloTipoMaterial(material.tipo)}
                              {material.categoria ? ` - ${material.categoria}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                            {rotuloStatus(material.status)}
                          </span>
                        </div>
                        {material.resumo ? <p className="mt-3 break-words text-sm text-texto-suave">{material.resumo}</p> : null}
                        {material.observacao ? <p className="mt-2 break-words text-xs text-texto-suave">{material.observacao}</p> : null}
                        {material.conteudo ? <p className="mt-3 line-clamp-4 break-words text-sm text-texto-forte">{material.conteudo}</p> : null}
                        {material.url ? (
                          <a
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir ${material.titulo}`}
                            className="mt-3 inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie-hover"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" />
                            <span className="truncate">Abrir material</span>
                          </a>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-texto-suave">Nenhum material disponivel no plano.</p>
                  )}
                </CartaoConteudo>
              </Cartao>
            </section>

            <Cartao id="notificacoes" className="scroll-mt-4">
              <CartaoCabecalho>
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-texto-suave" />
                  <h2 className="text-sm font-semibold">Notificacoes do paciente</h2>
                </div>
                <span className="rounded-full border border-linha bg-superficie px-2 py-1 text-xs font-semibold text-texto-suave">
                  {portal.resumo.notificacoesHistorico ?? notificacoesPaciente.length} no historico
                </span>
              </CartaoCabecalho>
              <CartaoConteudo className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold">Pendentes</p>
                    <p className="mt-1 text-xs text-texto-suave">Mensagens ainda aguardando envio ou processamento.</p>
                  </div>
                  {notificacoesPendentes.length ? (
                    notificacoesPendentes.map((notificacao) => (
                      <article key={notificacao.id} className="rounded-md border border-linha bg-alerta-suave p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{notificacao.titulo}</p>
                            <p className="mt-1 text-xs text-texto-suave">
                              {rotuloCanalNotificacao(notificacao.canal)}
                              {notificacao.evento ? ` - ${notificacao.evento}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                            {rotuloStatus(notificacao.status)}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-3 break-words text-sm text-texto-suave">
                          {notificacao.texto || 'Notificacao registrada no acompanhamento.'}
                        </p>
                        <p className="mt-3 text-xs text-texto-suave">
                          {notificacao.agendadoPara ? `Agendada para ${formatarDataHora(notificacao.agendadoPara)}` : `Criada em ${formatarDataHora(notificacao.criadoEm)}`}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">Nenhuma notificacao pendente.</p>
                  )}
                </div>

                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold">Historico</p>
                    <p className="mt-1 text-xs text-texto-suave">Ultimas notificacoes registradas para este paciente.</p>
                  </div>
                  {notificacoesPaciente.length ? (
                    notificacoesPaciente.slice(0, 6).map((notificacao) => (
                      <article key={notificacao.id} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{notificacao.titulo}</p>
                            <p className="mt-1 text-xs text-texto-suave">{rotuloCanalNotificacao(notificacao.canal)}</p>
                          </div>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                            {rotuloStatus(notificacao.status)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 break-words text-sm text-texto-suave">
                          {notificacao.texto || 'Notificacao registrada no acompanhamento.'}
                        </p>
                        <dl className="mt-3 grid gap-2 text-xs text-texto-suave sm:grid-cols-2">
                          <div>
                            <dt className="font-medium text-texto-forte">Criada em</dt>
                            <dd>{formatarDataHora(notificacao.criadoEm)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-texto-forte">Enviada em</dt>
                            <dd>{formatarDataHora(notificacao.enviadoEm ?? notificacao.agendadoPara)}</dd>
                          </div>
                        </dl>
                        {notificacao.erro ? <p className="mt-3 break-words text-xs text-perigo">{notificacao.erro}</p> : null}
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">Nenhuma notificacao registrada.</p>
                  )}
                </div>
              </CartaoConteudo>
            </Cartao>

            <Cartao id="historico" className="scroll-mt-4">
              <CartaoCabecalho>
                <CartaoTitulo icone={<Clock3 className="h-4 w-4" />}>Linha do tempo</CartaoTitulo>
              </CartaoCabecalho>
              <CartaoConteudo>
                {linhaTempo.length ? (
                  linhaTempo.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-md border border-linha bg-superficie p-3 sm:grid-cols-[150px_minmax(0,1fr)_140px] sm:items-start">
                      <span className="w-fit rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                        {item.tipo}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.titulo}</p>
                        <p className="mt-1 line-clamp-2 break-words text-xs text-texto-suave">{item.descricao}</p>
                      </div>
                      <time className="text-xs text-texto-suave sm:text-right">{formatarDataHora(item.data)}</time>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-texto-suave">Nenhuma movimentacao recente registrada.</p>
                )}
              </CartaoConteudo>
            </Cartao>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="grid gap-4">
                <Cartao id="perfil" className="scroll-mt-4">
                  <CartaoCabecalho>
                    <CartaoTitulo icone={<UserRound className="h-4 w-4" />}>Meu perfil</CartaoTitulo>
                  </CartaoCabecalho>
                  <form onSubmit={salvarPerfil} className="grid gap-3 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
                        Nome
                        <input
                          className={classeCampo}
                          value={formularioPerfil.nome}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, nome: evento.target.value }))}
                          maxLength={180}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
                        Nascimento
                        <input
                          type="date"
                          className={classeCampo}
                          value={formularioPerfil.dataNascimento}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, dataNascimento: evento.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
                        E-mail
                        <input
                          type="email"
                          className={classeCampo}
                          value={formularioPerfil.email}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, email: evento.target.value }))}
                          maxLength={180}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                      <label className="inline-flex items-center gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primaria"
                          checked={formularioPerfil.prefereEmail}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, prefereEmail: evento.target.checked }))}
                        />
                        Receber e-mail
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm font-medium">
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
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
                        Inicio
                        <input
                          type="time"
                          className={classeCampo}
                          value={formularioPerfil.horarioInicio}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, horarioInicio: evento.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-texto-suave">
                        Fim
                        <input
                          type="time"
                          className={classeCampo}
                          value={formularioPerfil.horarioFim}
                          onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, horarioFim: evento.target.value }))}
                        />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-medium text-texto-suave sm:max-w-xs">
                      Fuso horario
                      <input
                        className={classeCampo}
                        value={formularioPerfil.timezoneComunicacao}
                        onChange={(evento) => setFormularioPerfil((atual) => ({ ...atual, timezoneComunicacao: evento.target.value }))}
                        maxLength={80}
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
                      <div className="text-xs text-texto-suave">
                        Ultimo check-in {formatarDataHora(portal.perfil.ultimoCheckinEm)} - status {rotuloStatus(portal.paciente.statusAdesao)}
                      </div>
                      <Botao type="submit" variante="primario" disabled={salvandoPerfil}>
                        <Save className="h-4 w-4" />
                        {salvandoPerfil ? 'Salvando' : 'Salvar perfil'}
                      </Botao>
                    </div>
                  </form>
                </Cartao>

                <Cartao>
                  <CartaoCabecalho>
                    <CartaoTitulo icone={<ClipboardList className="h-4 w-4" />}>Formularios pendentes</CartaoTitulo>
                  </CartaoCabecalho>
                  <CartaoConteudo>
                    {portal.formulariosPendentes.length ? (
                      portal.formulariosPendentes.map((formulario) => (
                        <article key={formulario.envioId} className="flex flex-col gap-3 rounded-md border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{formulario.titulo}</p>
                            <p className="text-xs text-texto-suave">
                              {rotuloStatus(formulario.status)} - expira em {formatarDataHora(formulario.expiraEm)}
                            </p>
                          </div>
                          <a
                            href={formulario.linkFormulario}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte"
                          >
                            Responder
                          </a>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-texto-suave">Nenhum formulario pendente.</p>
                    )}
                  </CartaoConteudo>
                </Cartao>

                <Cartao>
                  <CartaoCabecalho>
                    <CartaoTitulo icone={<CheckCircle2 className="h-4 w-4" />}>Historico de formularios</CartaoTitulo>
                  </CartaoCabecalho>
                  <CartaoConteudo>
                    {portal.formulariosRespondidos.length ? (
                      portal.formulariosRespondidos.map((formulario) => (
                        <article key={formulario.respostaId} className="rounded-md border border-linha bg-superficie p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{formulario.titulo}</p>
                              <p className="text-xs text-texto-suave">
                                Respondido em {formatarDataHora(formulario.finalizadoEm ?? formulario.respondidoEm)}
                              </p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
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
                      <p className="text-sm text-texto-suave">Nenhum formulario respondido ainda.</p>
                    )}
                  </CartaoConteudo>
                </Cartao>

                {detalheFormulario ? (
                  <Cartao>
                    <CartaoCabecalho>
                      <div>
                        <h2 className="text-sm font-semibold">{detalheFormulario.titulo}</h2>
                        <p className="mt-1 text-xs text-texto-suave">
                          Finalizado em {formatarDataHora(detalheFormulario.finalizadoEm)}
                          {detalheFormulario.scoreFinal ? ` - score ${detalheFormulario.scoreFinal}` : ''}
                        </p>
                      </div>
                      <Botao type="button" variante="fantasma" onClick={() => setDetalheFormulario(null)}>
                        Fechar
                      </Botao>
                    </CartaoCabecalho>
                    <CartaoConteudo>
                      {detalheFormulario.descricao ? <p className="text-sm text-texto-suave">{detalheFormulario.descricao}</p> : null}
                      <dl className="grid gap-3">
                        {detalheFormulario.respostas.map((resposta) => (
                          <div key={resposta.perguntaId} className="rounded-md border border-linha bg-superficie p-3">
                            <dt className="flex flex-wrap items-start justify-between gap-2 text-sm font-semibold">
                              <span>{resposta.enunciado}</span>
                              <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-medium text-texto-suave">
                                {resposta.obrigatoria ? 'Obrigatoria' : 'Opcional'}
                              </span>
                            </dt>
                            <dd className="mt-2 break-words text-sm text-texto-suave">{formatarValor(resposta.valor)}</dd>
                            {resposta.scorePonderado ? (
                              <p className="mt-2 text-xs font-semibold text-texto-suave">Score {resposta.scorePonderado}</p>
                            ) : null}
                          </div>
                        ))}
                      </dl>
                    </CartaoConteudo>
                  </Cartao>
                ) : null}

                <Cartao>
                  <CartaoCabecalho>
                    <CartaoTitulo icone={<CalendarDays className="h-4 w-4" />}>Proximas consultas</CartaoTitulo>
                  </CartaoCabecalho>
                  <CartaoConteudo>
                    {portal.consultasProximas.length ? (
                      portal.consultasProximas.map((consulta) => (
                        <article key={consulta.id} className="rounded-md border border-linha bg-superficie p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{consulta.titulo}</p>
                              <p className="text-xs text-texto-suave">{formatarDataHora(consulta.inicioEm)}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                              {rotuloStatus(consulta.status)}
                            </span>
                          </div>
                          {consulta.local ? <p className="mt-2 text-sm text-texto-suave">{consulta.local}</p> : null}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {consulta.googleEventHtmlLink ? (
                              <a className="inline-flex text-sm font-semibold text-primaria" href={consulta.googleEventHtmlLink}>
                                Abrir no Google Agenda
                              </a>
                            ) : null}
                            {consulta.status === 'agendada' ? (
                              <Botao
                                type="button"
                                variante="perigo"
                                disabled={desmarcandoConsultaId === consulta.id}
                                onClick={() => void desmarcarConsulta(consulta.id)}
                              >
                                {desmarcandoConsultaId === consulta.id ? 'Desmarcando' : 'Desmarcar'}
                              </Botao>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-texto-suave">Nenhuma consulta futura agendada.</p>
                    )}
                  </CartaoConteudo>
                </Cartao>
              </div>

              <Cartao>
                <CartaoCabecalho>
                  <CartaoTitulo icone={<MessageCircle className="h-4 w-4" />}>Mensagens recentes</CartaoTitulo>
                </CartaoCabecalho>
                <CartaoConteudo>
                  {portal.mensagensRecentes.length ? (
                    portal.mensagensRecentes.map((mensagem) => (
                      <article key={mensagem.id} className="rounded-md border border-linha bg-superficie p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{mensagem.titulo}</p>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                            {rotuloStatus(mensagem.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-texto-suave">{mensagem.texto || 'Mensagem registrada no acompanhamento.'}</p>
                        <p className="mt-3 text-xs text-texto-suave">{formatarDataHora(mensagem.enviadoEm ?? mensagem.criadoEm)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-texto-suave">Nenhuma mensagem recente.</p>
                  )}
                </CartaoConteudo>
              </Cartao>

              <Cartao id="privacidade" className="scroll-mt-4">
                <CartaoCabecalho>
                  <CartaoTitulo icone={<ShieldCheck className="h-4 w-4" />}>Privacidade</CartaoTitulo>
                </CartaoCabecalho>
                <CartaoConteudo>
                  <div className="rounded-md border border-linha bg-superficie p-3">
                    <p className="text-xs text-texto-suave">Versao atual</p>
                    <p className="mt-1 text-sm font-semibold">{portal.lgpd.versaoAtual}</p>
                    <p className="mt-1 text-xs text-texto-suave">Ultimo aceite {formatarDataHora(portal.lgpd.ultimoAceiteEm)}</p>
                  </div>
                  <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
                    <div>
                      <p className="text-sm font-semibold">Documentos legais</p>
                      <p className="mt-1 text-xs text-texto-suave">Versoes obrigatorias aplicaveis ao portal do paciente.</p>
                    </div>
                    <div className="grid gap-2">
                      {(portal.lgpd.documentosLegais ?? []).map((documento) => (
                        <article key={`${documento.tipo}-${documento.versao}`} className="rounded-md border border-linha bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold">{documento.titulo}</p>
                              <p className="mt-1 text-xs text-texto-suave">Versao {documento.versao}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-superficie px-2 py-1 text-xs font-semibold text-texto-suave">
                              {documento.aceito ? 'Aceito' : 'Pendente'}
                            </span>
                          </div>
                          <p className="mt-2 break-words text-xs text-texto-suave">{documento.resumo}</p>
                          {documento.aceitoEm ? <p className="mt-2 text-xs text-texto-suave">Aceito em {formatarDataHora(documento.aceitoEm)}</p> : null}
                        </article>
                      ))}
                      {!(portal.lgpd.documentosLegais ?? []).length ? (
                        <p className="text-sm text-texto-suave">Nenhum documento legal versionado retornado.</p>
                      ) : null}
                    </div>
                  </div>
                  <Botao type="button" variante="primario" onClick={() => void registrarAceiteLgpd()} disabled={salvandoConsentimento}>
                    <ShieldCheck className="h-4 w-4" />
                    {salvandoConsentimento ? 'Registrando' : 'Registrar aceite'}
                  </Botao>
                  <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
                    <div>
                      <p className="text-sm font-semibold">Meus dados</p>
                      <p className="mt-1 text-xs text-texto-suave">Baixe uma copia do seu perfil, consultas, formularios, mensagens e historico LGPD.</p>
                    </div>
                    <Botao type="button" onClick={() => void exportarDadosLgpd()} disabled={exportandoLgpd}>
                      <ShieldCheck className="h-4 w-4" />
                      {exportandoLgpd ? 'Gerando' : 'Baixar meus dados'}
                    </Botao>
                  </div>
                  <form onSubmit={enviarSolicitacaoLgpd} className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
                    <div>
                      <p className="text-sm font-semibold">Solicitacoes LGPD</p>
                      <p className="mt-1 text-xs text-texto-suave">Abra um protocolo para corrigir seus dados ou solicitar exclusao conforme avaliacao legal.</p>
                    </div>
                    <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                    <label className="grid gap-1 text-xs font-medium text-texto-suave">
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
                      <p className="mt-1 text-xs text-texto-suave">Acompanhe as solicitacoes abertas pelo portal e o andamento registrado pela equipe.</p>
                    </div>
                    {portal.lgpd.solicitacoes.length ? (
                      portal.lgpd.solicitacoes.map((solicitacao) => (
                        <article key={solicitacao.protocolo} className="rounded-md border border-linha bg-superficie p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold">{solicitacao.protocolo}</p>
                              <p className="mt-1 text-xs text-texto-suave">{rotuloTipoSolicitacaoLgpd(solicitacao.tipo)}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                              {rotuloStatusSolicitacaoLgpd(solicitacao.status)}
                            </span>
                          </div>
                          {solicitacao.detalhes ? <p className="mt-2 break-words text-sm text-texto-forte">{solicitacao.detalhes}</p> : null}
                          <dl className="mt-3 grid gap-2 text-xs text-texto-suave sm:grid-cols-2">
                            <div>
                              <dt className="font-medium text-texto-forte">Aberto em</dt>
                              <dd>{formatarDataHora(solicitacao.abertoEm)}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-texto-forte">Atualizado em</dt>
                              <dd>{formatarDataHora(solicitacao.atualizadoEm)}</dd>
                            </div>
                          </dl>
                          {solicitacao.ultimaTratativa ? (
                            <p className="mt-3 break-words text-xs text-texto-suave">
                              Ultima tratativa: <span className="font-medium text-texto-forte">{solicitacao.ultimaTratativa}</span>
                            </p>
                          ) : null}
                          {solicitacao.ultimaResposta ? (
                            <p className="mt-2 break-words text-xs text-texto-suave">
                              Ultima resposta: <span className="font-medium text-texto-forte">{solicitacao.ultimaResposta}</span>
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-texto-suave">Nenhum protocolo LGPD aberto.</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {portal.lgpd.consentimentos.length ? (
                      portal.lgpd.consentimentos.map((consentimento) => (
                        <article key={consentimento.id} className="rounded-md border border-linha bg-superficie p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold">{rotuloConsentimento(consentimento.tipo)}</p>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-texto-suave">
                              {consentimento.versao}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-texto-suave">{formatarDataHora(consentimento.aceitoEm)}</p>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-texto-suave">Nenhum consentimento registrado.</p>
                    )}
                  </div>
                </CartaoConteudo>
              </Cartao>
            </section>
          </>
        ) : (
          carregando ? (
            <PortalCarregando />
          ) : (
            <Cartao className="grid gap-4 border-perigo-borda p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-perigo-suave text-perigo">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">Portal indisponivel</h2>
                  <p className="mt-1 break-words text-sm text-texto-suave">{erro ?? 'Nao foi possivel carregar suas informacoes.'}</p>
                </div>
              </div>
              <div>
                <Botao type="button" variante="primario" onClick={() => void carregar()}>
                  <RefreshCcw className="h-4 w-4" />
                  Tentar novamente
                </Botao>
              </div>
            </Cartao>
          )
        )}
    </PortalShell>
  );
}
