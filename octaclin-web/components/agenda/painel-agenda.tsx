'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarCheck,
  CheckCircle2,
  Clipboard,
  Clock,
  Link2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Save,
  UserX,
  Video,
  XCircle
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import { AgendaSemanal } from '@/components/agenda/agenda-semanal';
import { LinkAgendamentoPublicoApi, SolicitacaoAgendaPublicaApi } from '@/lib/agendamento-publico-api';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada } from '@/lib/cadastros-api';
import {
  aprovarSolicitacaoPublicaAgenda,
  carregarBootstrapAgenda,
  ConexaoGoogleAgendaStatus,
  conectarGoogleAgenda,
  ConsultaAgendaApi,
  criarConsultaAgenda,
  DesfechoConsultaAgenda,
  desconectarGoogleAgenda,
  NotificacoesConsultaAgenda,
  obterStatusGoogleAgenda,
  recusarSolicitacaoPublicaAgenda,
  registrarDesfechoConsulta,
  remarcarConsultaAgenda,
  rotacionarLinkPublicoAgenda
} from '@/lib/agenda-api';

interface FormularioAgenda {
  pacienteId: string;
  profissionalId: string;
  inicioEm: string;
  duracaoMinutos: number;
  local: string;
  emailContato: string;
  whatsappContato: string;
  observacoes: string;
  enviarNotificacoes: boolean;
}

const formularioInicial: FormularioAgenda = {
  pacienteId: '',
  profissionalId: '',
  inicioEm: '',
  duracaoMinutos: 50,
  local: '',
  emailContato: '',
  whatsappContato: '',
  observacoes: '',
  enviarNotificacoes: true
};

function valorDatetimeLocal(data: Date) {
  const deslocamento = data.getTimezoneOffset() * 60 * 1000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

function proximoHorarioPadrao() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  data.setHours(9, 0, 0, 0);
  return valorDatetimeLocal(data);
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data invalida';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

function duracaoConsultaMinutos(consulta: ConsultaAgendaApi) {
  const inicio = new Date(consulta.inicioEm).getTime();
  const fim = new Date(consulta.fimEm).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) return 50;
  return Math.round((fim - inicio) / 60000);
}

function pacientePorId(pacientes: PacienteResumo[], id: string) {
  return pacientes.find((paciente) => paciente.id === id);
}

function profissionalPorId(profissionais: ProfissionalResumo[], id?: string) {
  return profissionais.find((profissional) => profissional.id === id);
}

function contatoEmail(contato?: string) {
  return contato?.includes('@') ? contato : '';
}

function contatoWhatsapp(contato?: string) {
  if (!contato || contato.includes('@')) return '';
  return contato.replace(/\D/g, '');
}

function statusNotificacao(notificacoes: NotificacoesConsultaAgenda, canal: 'email' | 'whatsapp') {
  const status = notificacoes?.[canal]?.status;
  const motivo = notificacoes?.[canal]?.motivo ?? notificacoes?.[canal]?.erro;
  if (status === 'enviado') return 'Enviado';
  if (status === 'ignorado') return motivo ? `Ignorado: ${motivo}` : 'Ignorado';
  if (status === 'falhou') return motivo ? `Falhou: ${motivo}` : 'Falhou';
  return 'Pendente';
}

function statusGoogle(consulta: ConsultaAgendaApi, conectado?: boolean) {
  if (consulta.googleEventId) return 'Sincronizado';
  if (!conectado) return 'Nao conectado (opcional)';
  const google = consulta.notificacoes?.googleCalendar;
  if (google?.motivo === 'configuracao_ausente') return 'Configurar Google';
  if (google?.motivo) return `Pendente: ${google.motivo}`;
  return 'Pendente';
}

function statusLembrete(notificacoes: NotificacoesConsultaAgenda) {
  const lembrete = notificacoes?.lembrete24h;
  if (lembrete?.status === 'processado') return 'Lembrete 24h enviado';
  if (lembrete?.status === 'ignorado') return 'Lembrete ignorado';
  if (lembrete?.status === 'falhou') return 'Lembrete falhou';
  return 'Lembrete pendente';
}

function statusConfirmacao(notificacoes: NotificacoesConsultaAgenda) {
  const confirmacao = notificacoes?.confirmacaoPaciente;
  if (confirmacao?.status === 'confirmada') return 'Paciente confirmou';
  return 'Aguardando confirmacao';
}

function rotuloStatusConsulta(status: ConsultaAgendaApi['status']) {
  const rotulos: Record<ConsultaAgendaApi['status'], string> = {
    agendada: 'Agendada',
    reagendada: 'Reagendada',
    concluida: 'Concluida',
    falta: 'Falta',
    cancelada: 'Cancelada'
  };
  return rotulos[status];
}

function origemCancelamentoConsulta(consulta: ConsultaAgendaApi): 'profissional' | 'paciente' | 'google' | undefined {
  const historico = Array.isArray((consulta.payload as { historico?: unknown })?.historico)
    ? ((consulta.payload as { historico: unknown[] }).historico as Array<Record<string, unknown>>)
    : [];
  const ultimo = historico[historico.length - 1];
  const origem = ultimo?.origem;
  return origem === 'profissional' || origem === 'paciente' || origem === 'google' ? origem : undefined;
}

function rotuloStatusConsultaCompleto(consulta: ConsultaAgendaApi) {
  if (consulta.status !== 'cancelada') return rotuloStatusConsulta(consulta.status);
  const origem = origemCancelamentoConsulta(consulta);
  if (origem === 'paciente') return 'Desmarcada pelo paciente';
  if (origem === 'profissional') return 'Cancelada pelo profissional';
  if (origem === 'google') return 'Cancelada na Google Agenda';
  return rotuloStatusConsulta(consulta.status);
}

function consultaAtiva(consulta: ConsultaAgendaApi) {
  return consulta.status === 'agendada' || consulta.status === 'reagendada';
}

function descricaoLinkPublico(linkPublico: LinkAgendamentoPublicoApi | null) {
  if (!linkPublico) return 'Nenhum link ativo. Rotacione para gerar o primeiro endereco publico.';
  return linkPublico.urlPublica ?? linkPublico.mensagemUrlPublica;
}

export function PainelAgenda() {
  const parametros = useSearchParams();
  const parametrosIniciaisAplicados = useRef(false);
  const [consultas, setConsultas] = useState<ConsultaAgendaApi[]>([]);
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [profissionais, setProfissionais] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [linkPublico, setLinkPublico] = useState<LinkAgendamentoPublicoApi | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAgendaPublicaApi[]>([]);
  const [formulario, setFormulario] = useState<FormularioAgenda>({ ...formularioInicial, inicioEm: proximoHorarioPadrao() });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [processandoConsultaId, setProcessandoConsultaId] = useState<string | null>(null);
  const [processandoSolicitacaoId, setProcessandoSolicitacaoId] = useState<string | null>(null);
  const [motivosRecusa, setMotivosRecusa] = useState<Record<string, string>>({});
  const [pacientesPorSolicitacao, setPacientesPorSolicitacao] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [statusGoogleAgenda, setStatusGoogleAgenda] = useState<ConexaoGoogleAgendaStatus | null>(null);
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [consultaSelecionadaId, setConsultaSelecionadaId] = useState<string | null>(null);
  const [desfechoPendente, setDesfechoPendente] = useState<{ consulta: ConsultaAgendaApi; status: DesfechoConsultaAgenda } | null>(null);
  const [rotacionarLinkPendente, setRotacionarLinkPendente] = useState(false);

  const pacientesLista = useMemo(() => pacientes?.itens ?? [], [pacientes]);
  const profissionaisLista = useMemo(() => profissionais?.itens ?? [], [profissionais]);
  const proximasConsultas = useMemo(
    () => [...consultas].sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime()),
    [consultas]
  );
  const solicitacoesPendentes = useMemo(
    () => solicitacoes.filter((solicitacao) => solicitacao.status === 'pendente' || solicitacao.status === 'processando'),
    [solicitacoes]
  );
  const consultaSelecionada = useMemo(
    () => consultas.find((consulta) => consulta.id === consultaSelecionadaId) ?? null,
    [consultaSelecionadaId, consultas]
  );

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const bootstrap = await carregarBootstrapAgenda();
      setConsultas(bootstrap.consultas);
      setPacientes(bootstrap.pacientes);
      setProfissionais(bootstrap.profissionais);
      setLinkPublico(bootstrap.linkPublico);
      setSolicitacoes(bootstrap.solicitacoes.itens);
      setFormulario((atual) => {
        const paciente = pacientePorId(bootstrap.pacientes.itens, atual.pacienteId) ?? bootstrap.pacientes.itens[0];
        const profissionalId = atual.profissionalId || paciente?.profissionalResponsavelId || bootstrap.profissionais.itens[0]?.id || '';
        return {
          ...atual,
          pacienteId: atual.pacienteId || paciente?.id || '',
          profissionalId,
          emailContato: atual.emailContato || contatoEmail(paciente?.contato),
          whatsappContato: atual.whatsappContato || contatoWhatsapp(paciente?.contato)
        };
      });
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar agenda.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    void obterStatusGoogleAgenda()
      .then(setStatusGoogleAgenda)
      .catch(() => setStatusGoogleAgenda({ conectado: false }));
  }, []);

  useEffect(() => {
    if (window.location.hash === '#novo-agendamento') setModalCriarAberto(true);
  }, []);

  useEffect(() => {
    if (parametrosIniciaisAplicados.current || !pacientesLista.length || !profissionaisLista.length) return;
    parametrosIniciaisAplicados.current = true;

    const pacienteId = parametros.get('pacienteId');
    const profissionalId = parametros.get('profissionalId');
    const paciente = pacienteId ? pacientePorId(pacientesLista, pacienteId) : undefined;
    const profissionalValido = profissionalId && profissionalPorId(profissionaisLista, profissionalId) ? profissionalId : undefined;

    if (!paciente && !profissionalValido) return;
    setFormulario((atual) => ({
      ...atual,
      pacienteId: paciente?.id ?? atual.pacienteId,
      profissionalId: profissionalValido ?? paciente?.profissionalResponsavelId ?? atual.profissionalId,
      emailContato: paciente ? contatoEmail(paciente.contato) : atual.emailContato,
      whatsappContato: paciente ? contatoWhatsapp(paciente.contato) : atual.whatsappContato
    }));
    setSucesso('Dados do retorno preenchidos. Confirme data e hora antes de agendar.');
  }, [pacientesLista, profissionaisLista, parametros]);

  function selecionarPaciente(pacienteId: string) {
    const paciente = pacientePorId(pacientesLista, pacienteId);
    setFormulario((atual) => ({
      ...atual,
      pacienteId,
      profissionalId: paciente?.profissionalResponsavelId || atual.profissionalId,
      emailContato: contatoEmail(paciente?.contato),
      whatsappContato: contatoWhatsapp(paciente?.contato)
    }));
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!formulario.pacienteId) {
      setErro('Selecione um paciente antes de agendar.');
      return;
    }
    if (!formulario.inicioEm) {
      setErro('Informe data e hora da consulta.');
      return;
    }

    setSalvando(true);
    try {
      const criada = await criarConsultaAgenda({
        pacienteId: formulario.pacienteId,
        profissionalId: formulario.profissionalId || undefined,
        inicioEm: new Date(formulario.inicioEm).toISOString(),
        duracaoMinutos: formulario.duracaoMinutos,
        local: formulario.local || undefined,
        emailContato: formulario.emailContato || undefined,
        whatsappContato: formulario.whatsappContato || undefined,
        observacoes: formulario.observacoes || undefined,
        enviarNotificacoes: formulario.enviarNotificacoes
      });
      setConsultas((atuais) => [criada, ...atuais]);
      setFormulario((atual) => ({
        ...atual,
        inicioEm: proximoHorarioPadrao(),
        local: '',
        observacoes: ''
      }));
      setSucesso('Consulta agendada e horario bloqueado na agenda interna. Integracoes processadas conforme configuracao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao agendar consulta.');
    } finally {
      setSalvando(false);
    }
  }

  function atualizarConsulta(consulta: ConsultaAgendaApi) {
    setConsultas((atuais) => atuais.map((item) => (item.id === consulta.id ? consulta : item)));
  }

  function atualizarSolicitacao(solicitacao: SolicitacaoAgendaPublicaApi) {
    setSolicitacoes((atuais) => atuais.map((item) => (item.id === solicitacao.id ? solicitacao : item)));
  }

  async function remarcar(evento: FormEvent<HTMLFormElement>, consulta: ConsultaAgendaApi) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const inicioLocal = String(dados.get('inicioEm') ?? '');
    const duracaoMinutos = Number(dados.get('duracaoMinutos') ?? duracaoConsultaMinutos(consulta));
    const local = String(dados.get('local') ?? '').trim();

    if (!inicioLocal) {
      setErro('Informe a nova data e hora da consulta.');
      return;
    }

    setErro(null);
    setSucesso(null);
    setProcessandoConsultaId(consulta.id);
    try {
      const atualizada = await remarcarConsultaAgenda(consulta.id, {
        inicioEm: new Date(inicioLocal).toISOString(),
        duracaoMinutos,
        local: local || undefined,
        observacoes: consulta.observacoes || undefined
      });
      atualizarConsulta(atualizada);
      setSucesso('Consulta remarcada e horario atualizado na agenda interna. Integracoes processadas conforme configuracao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao remarcar consulta.');
    } finally {
      setProcessandoConsultaId(null);
    }
  }

  async function registrarDesfecho(consulta: ConsultaAgendaApi, status: DesfechoConsultaAgenda) {
    const rotulo = rotuloStatusConsulta(status).toLocaleLowerCase('pt-BR');
    setErro(null);
    setSucesso(null);
    setProcessandoConsultaId(consulta.id);
    try {
      const atualizada = await registrarDesfechoConsulta(consulta.id, status);
      atualizarConsulta(atualizada);
      setSucesso(
        status === 'cancelada'
          ? 'Consulta cancelada e horario liberado na agenda interna. Integracoes processadas conforme configuracao.'
          : `Consulta registrada como ${rotulo}.`
      );
      return true;
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar desfecho da consulta.');
      return false;
    } finally {
      setProcessandoConsultaId(null);
    }
  }

  function solicitarDesfecho(consulta: ConsultaAgendaApi, status: DesfechoConsultaAgenda) {
    setDesfechoPendente({ consulta, status });
  }

  async function copiarLinkPublico() {
    if (!linkPublico?.urlPublica) return;
    try {
      await navigator.clipboard?.writeText(linkPublico.urlPublica);
      setErro(null);
      setSucesso('Link publico copiado.');
    } catch {
      setErro('Nao foi possivel copiar o link publico.');
    }
  }

  function rotacionarLink() {
    setRotacionarLinkPendente(true);
  }

  async function executarRotacaoLink() {
    setErro(null);
    setSucesso(null);
    setProcessandoSolicitacaoId('rotacionar-link');
    try {
      const link = await rotacionarLinkPublicoAgenda();
      setLinkPublico(link);
      setSucesso('Link publico rotacionado. Copie a nova URL antes de encerrar esta sessao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao rotacionar link publico.');
    } finally {
      setProcessandoSolicitacaoId(null);
    }
  }

  async function aprovarSolicitacao(solicitacao: SolicitacaoAgendaPublicaApi) {
    const pacienteId = pacientesPorSolicitacao[solicitacao.id];
    if (!pacienteId) {
      setErro('Selecione um paciente antes de aprovar a solicitacao.');
      return;
    }

    setErro(null);
    setSucesso(null);
    setProcessandoSolicitacaoId(solicitacao.id);
    try {
      const atualizada = await aprovarSolicitacaoPublicaAgenda(solicitacao.id, pacienteId);
      atualizarSolicitacao(atualizada);
      setSucesso('Solicitacao aprovada e convertida em consulta.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao aprovar solicitacao.');
    } finally {
      setProcessandoSolicitacaoId(null);
    }
  }

  async function recusarSolicitacao(solicitacao: SolicitacaoAgendaPublicaApi) {
    setErro(null);
    setSucesso(null);
    setProcessandoSolicitacaoId(solicitacao.id);
    try {
      const atualizada = await recusarSolicitacaoPublicaAgenda(
        solicitacao.id,
        motivosRecusa[solicitacao.id]?.trim() || undefined
      );
      atualizarSolicitacao(atualizada);
      setSucesso('Solicitacao recusada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao recusar solicitacao.');
    } finally {
      setProcessandoSolicitacaoId(null);
    }
  }

  async function desconectarGoogle() {
    setErro(null);
    try {
      await desconectarGoogleAgenda();
      setStatusGoogleAgenda({ conectado: false });
      setSucesso('Google Agenda desconectado. A agenda interna continua ativa.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao desconectar Google Agenda.');
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <AgendaSemanal
        consultas={consultas}
        profissionais={profissionaisLista}
        googleConectado={statusGoogleAgenda?.conectado}
        onConectarGoogle={conectarGoogleAgenda}
        onDesconectarGoogle={() => void desconectarGoogle()}
        onAbrirConsulta={setConsultaSelecionadaId}
      />

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? (
        <div className="flex items-start gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{sucesso}</span>
        </div>
      ) : null}

      <Modal
        aberto={Boolean(consultaSelecionada)}
        aoFechar={() => setConsultaSelecionadaId(null)}
        titulo="Detalhes da consulta"
        descricao={consultaSelecionada ? `${consultaSelecionada.pacienteNome ?? consultaSelecionada.titulo} · ${formatarDataHora(consultaSelecionada.inicioEm)}` : undefined}
        className="max-w-3xl"
      >
        {consultaSelecionada ? (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave sm:grid-cols-2">
              <p>Local: {consultaSelecionada.local || 'Nao informado'}</p>
              <p>Google Agenda: {statusGoogle(consultaSelecionada, statusGoogleAgenda?.conectado)}</p>
              <p>E-mail: {statusNotificacao(consultaSelecionada.notificacoes, 'email')}</p>
              <p>WhatsApp: {statusNotificacao(consultaSelecionada.notificacoes, 'whatsapp')}</p>
            </div>
            {consultaAtiva(consultaSelecionada) ? (
              <form onSubmit={(evento) => remarcar(evento, consultaSelecionada)} className="grid gap-3 border-t border-linha pt-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_minmax(140px,1fr)]">
                  <label className="grid gap-1"><Rotulo>Nova data e hora</Rotulo><Campo aria-label="Nova data e hora" name="inicioEm" type="datetime-local" defaultValue={valorDatetimeLocal(new Date(consultaSelecionada.inicioEm))} /></label>
                  <label className="grid gap-1"><Rotulo>Nova duracao</Rotulo><Campo aria-label="Nova duracao" name="duracaoMinutos" type="number" min={15} max={480} step={5} defaultValue={duracaoConsultaMinutos(consultaSelecionada)} /></label>
                  <label className="grid gap-1"><Rotulo>Novo local</Rotulo><Campo aria-label="Novo local" name="local" defaultValue={consultaSelecionada.local ?? ''} /></label>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Registrar desfecho da consulta">
                    <Botao type="button" disabled={processandoConsultaId === consultaSelecionada.id} onClick={() => solicitarDesfecho(consultaSelecionada, 'concluida')}><CheckCircle2 size={16} />Concluida</Botao>
                    <Botao type="button" disabled={processandoConsultaId === consultaSelecionada.id} onClick={() => solicitarDesfecho(consultaSelecionada, 'falta')}><UserX size={16} />Falta</Botao>
                    <Botao type="button" variante="perigo" disabled={processandoConsultaId === consultaSelecionada.id} onClick={() => solicitarDesfecho(consultaSelecionada, 'cancelada')}><XCircle size={16} />Cancelar</Botao>
                  </div>
                  <Botao type="submit" variante="primario" disabled={processandoConsultaId === consultaSelecionada.id}><RefreshCcw size={16} />Remarcar</Botao>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
        <Cartao className="min-w-0">
          <CartaoCabecalho className="items-start">
            <div>
              <h2 className="text-base font-semibold">Link publico de agendamento</h2>
              <p className="mt-1 text-sm text-texto-suave">
                Compartilhe um unico endereco publico para receber solicitacoes antes da aprovacao manual.
              </p>
            </div>
            <Link2 size={20} className="text-primaria" />
          </CartaoCabecalho>
          <CartaoConteudo className="grid gap-4">
            <div className="grid gap-2 rounded-lg border border-linha bg-superficie px-4 py-3">
              <span className="text-xs font-semibold uppercase text-texto-suave">Endereco atual</span>
              <span className="break-all text-sm font-medium text-tinta">{descricaoLinkPublico(linkPublico)}</span>
            </div>

            {linkPublico ? (
              <div className="grid gap-1 text-sm text-texto-suave">
                <p>{linkPublico.duracaoMinutos} minutos por solicitacao publica.</p>
                <p>Atualizado em {formatarDataHora(linkPublico.atualizadoEm)}.</p>
                {linkPublico.requerRotacaoConfirmada ? (
                  <p>A URL atual so volta a ficar copiavel apos nova rotacao confirmada.</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Botao
                type="button"
                variante="primario"
                onClick={() => void rotacionarLink()}
                disabled={processandoSolicitacaoId === 'rotacionar-link'}
              >
                <RefreshCcw size={16} />
                Rotacionar link
              </Botao>
              <Botao type="button" onClick={() => void copiarLinkPublico()} disabled={!linkPublico?.urlPublicaDisponivel}>
                <Clipboard size={16} />
                Copiar link
              </Botao>
            </div>
          </CartaoConteudo>
        </Cartao>

        <Modal
          aberto={modalCriarAberto}
          aoFechar={() => setModalCriarAberto(false)}
          titulo="Nova consulta"
          descricao="Cria a consulta e bloqueia o horario na agenda interna. Google e avisos sao opcionais."
        >
          <form onSubmit={salvar}>
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <Rotulo>Paciente</Rotulo>
                  <Selecao value={formulario.pacienteId} onChange={(evento) => selecionarPaciente(evento.target.value)}>
                    {pacientesLista.map((paciente) => (
                      <option key={paciente.id} value={paciente.id}>
                        {paciente.nome}
                      </option>
                    ))}
                  </Selecao>
                </label>

                <label className="grid gap-1">
                  <Rotulo>Profissional</Rotulo>
                  <Selecao
                    value={formulario.profissionalId}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalId: evento.target.value }))}
                  >
                    {profissionaisLista.map((profissional) => (
                      <option key={profissional.id} value={profissional.id}>
                        {profissional.nome}
                      </option>
                    ))}
                  </Selecao>
                </label>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label className="grid gap-1">
                    <Rotulo>Data e hora</Rotulo>
                    <Campo
                      type="datetime-local"
                      value={formulario.inicioEm}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioEm: evento.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1">
                    <Rotulo>Duracao</Rotulo>
                    <Campo
                      type="number"
                      min={15}
                      max={480}
                      step={5}
                      value={formulario.duracaoMinutos}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, duracaoMinutos: Number(evento.target.value) || 50 }))
                      }
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <Rotulo>Local</Rotulo>
                  <Campo
                    value={formulario.local}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, local: evento.target.value }))}
                    placeholder="Consultorio, videochamada ou endereco"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <Rotulo>Email</Rotulo>
                    <Campo
                      type="email"
                      value={formulario.emailContato}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, emailContato: evento.target.value }))}
                      placeholder="paciente@email.com"
                    />
                  </label>
                  <label className="grid gap-1">
                    <Rotulo>WhatsApp</Rotulo>
                    <Campo
                      value={formulario.whatsappContato}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, whatsappContato: evento.target.value }))}
                      placeholder="5511999999999"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <Rotulo>Observacoes</Rotulo>
                  <AreaTexto
                    value={formulario.observacoes}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))}
                    placeholder="Informacoes internas para o evento."
                  />
                </label>

                <label className="flex min-h-10 items-center gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                  <input
                    type="checkbox"
                    checked={formulario.enviarNotificacoes}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, enviarNotificacoes: evento.target.checked }))}
                    className="h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                  />
                  Enviar e-mail e mensagem ao salvar
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Botao type="button" onClick={() => void carregar()} disabled={carregando || salvando}>
                    <RefreshCcw size={16} />
                    Atualizar
                  </Botao>
                  <Botao type="submit" variante="primario" disabled={salvando || !pacientesLista.length}>
                    <Save size={16} />
                    Agendar
                  </Botao>
                </div>
              </div>
          </form>
        </Modal>
      </div>

      <div className="grid min-w-0 gap-4">
        <Cartao className="min-w-0">
          <CartaoCabecalho className="flex-col items-start sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold">Solicitacoes pendentes</h2>
              <p className="mt-1 text-sm text-texto-suave">{solicitacoesPendentes.length} aguardando decisao manual</p>
            </div>
            <BarraCarregamento visivel={carregando} rotulo="Atualizando solicitacoes" />
          </CartaoCabecalho>
          <CartaoConteudo>
            {solicitacoesPendentes.length ? (
              <div className="grid gap-3">
                {solicitacoesPendentes.map((solicitacao) => (
                  <article key={solicitacao.id} className="rounded-lg border border-linha bg-superficie p-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-tinta">{solicitacao.nome}</h3>
                          <span className="rounded-md border border-primaria-suave bg-white px-2 py-1 text-xs font-medium text-primaria-forte">
                            {solicitacao.status}
                          </span>
                        </div>

                        <div className="mt-2 grid gap-1 text-sm text-texto-suave">
                          <p className="flex min-w-0 items-center gap-2">
                            <Clock size={15} className="shrink-0" />
                            <span>{formatarDataHora(solicitacao.inicioEm)}</span>
                          </p>
                          {solicitacao.email ? (
                            <p className="flex min-w-0 items-center gap-2">
                              <Mail size={15} className="shrink-0" />
                              <span className="truncate">{solicitacao.email}</span>
                            </p>
                          ) : null}
                          {solicitacao.whatsapp ? (
                            <p className="flex min-w-0 items-center gap-2">
                              <MessageCircle size={15} className="shrink-0" />
                              <span>{solicitacao.whatsapp}</span>
                            </p>
                          ) : null}
                          <p>Expira em {formatarDataHora(solicitacao.expiraEm)}</p>
                        </div>

                        {solicitacao.observacao ? <p className="mt-3 text-sm text-texto-suave">{solicitacao.observacao}</p> : null}
                      </div>

                      <div className="grid gap-3 xl:w-[320px]">
                        <label className="grid gap-1">
                          <Rotulo>Paciente para aprovar</Rotulo>
                          <Selecao
                            aria-label="Paciente para aprovar"
                            value={pacientesPorSolicitacao[solicitacao.id] ?? ''}
                            onChange={(evento) =>
                              setPacientesPorSolicitacao((atual) => ({
                                ...atual,
                                [solicitacao.id]: evento.target.value
                              }))
                            }
                          >
                            <option value="">Selecione um paciente</option>
                            {pacientesLista.map((paciente) => (
                              <option key={paciente.id} value={paciente.id}>
                                {paciente.nome}
                              </option>
                            ))}
                          </Selecao>
                        </label>

                        <label className="grid gap-1">
                          <Rotulo>Motivo da recusa</Rotulo>
                          <Campo
                            value={motivosRecusa[solicitacao.id] ?? ''}
                            onChange={(evento) =>
                              setMotivosRecusa((atual) => ({
                                ...atual,
                                [solicitacao.id]: evento.target.value
                              }))
                            }
                            placeholder="Opcional"
                          />
                        </label>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Botao
                            type="button"
                            variante="primario"
                            disabled={!pacientesLista.length || !pacientesPorSolicitacao[solicitacao.id] || processandoSolicitacaoId === solicitacao.id}
                            onClick={() => void aprovarSolicitacao(solicitacao)}
                          >
                            <CheckCircle2 size={15} />
                            Aprovar solicitacao
                          </Botao>
                          <Botao
                            type="button"
                            disabled={processandoSolicitacaoId === solicitacao.id}
                            onClick={() => void recusarSolicitacao(solicitacao)}
                          >
                            <XCircle size={15} />
                            Recusar solicitacao
                          </Botao>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EstadoVazio
                titulo="Nenhuma solicitacao pendente"
                descricao="Quando alguem usar o link publico, a solicitacao aparecera aqui para aprovacao manual."
              />
            )}
          </CartaoConteudo>
        </Cartao>

        <Cartao className="min-w-0">
          <CartaoCabecalho className="flex-col items-start sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold">Consultas agendadas</h2>
              <p className="mt-1 text-sm text-texto-suave">{proximasConsultas.length} consultas no periodo carregado</p>
            </div>
            <div className="flex items-center gap-3">
              <BarraCarregamento visivel={carregando} rotulo="Carregando agenda" />
              <Botao type="button" variante="primario" onClick={() => setModalCriarAberto(true)}>
                <CalendarCheck size={16} />
                Nova consulta
              </Botao>
            </div>
          </CartaoCabecalho>
          <CartaoConteudo>
            {proximasConsultas.length ? (
              <div className="grid gap-3">
                {proximasConsultas.map((consulta) => {
                  const paciente = pacientePorId(pacientesLista, consulta.pacienteId);
                  const profissional = profissionalPorId(profissionaisLista, consulta.profissionalId);
                  return (
                    <article
                      id={`consulta-${consulta.id}`}
                      key={consulta.id}
                      className="scroll-mt-4 rounded-lg border border-linha bg-superficie p-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-tinta">
                              {consulta.pacienteNome ?? paciente?.nome ?? consulta.titulo}
                            </h3>
                            <span className="rounded-md border border-primaria-suave bg-superficie-hover px-2 py-1 text-xs font-medium text-primaria-forte">
                              {rotuloStatusConsultaCompleto(consulta)}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-1 text-sm text-texto-suave sm:grid-cols-2">
                            <p className="flex min-w-0 items-center gap-2">
                              <Clock size={15} className="shrink-0" />
                              <span>{formatarDataHora(consulta.inicioEm)}</span>
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              <Video size={15} className="shrink-0" />
                              <span className="truncate">{consulta.local || 'Local nao informado'}</span>
                            </p>
                            <p className="truncate">Profissional: {consulta.profissionalNome ?? profissional?.nome ?? 'Nao informado'}</p>
                            <p className="truncate">
                              Google Calendar: {statusGoogle(consulta, statusGoogleAgenda?.conectado)}
                            </p>
                          </div>
                        </div>

                        <div className="grid shrink-0 gap-2 text-xs text-texto-suave sm:grid-cols-2 lg:w-[360px]">
                          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                            <Mail size={14} />
                            {statusNotificacao(consulta.notificacoes, 'email')}
                          </span>
                          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                            <MessageCircle size={14} />
                            {statusNotificacao(consulta.notificacoes, 'whatsapp')}
                          </span>
                          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                            <Clock size={14} />
                            {statusLembrete(consulta.notificacoes)}
                          </span>
                          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                            <CheckCircle2 size={14} />
                            {statusConfirmacao(consulta.notificacoes)}
                          </span>
                        </div>
                      </div>

                      {consulta.observacoes ? <p className="mt-3 text-sm text-texto-suave">{consulta.observacoes}</p> : null}
                      {consulta.googleEventHtmlLink ? (
                        <a
                          href={consulta.googleEventHtmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-medium text-primaria hover:underline"
                        >
                          Abrir no Google Calendar
                        </a>
                      ) : null}

                      {consultaAtiva(consulta) ? (
                        <div className="mt-3 flex justify-end border-t border-linha pt-3">
                          <Botao type="button" onClick={() => setConsultaSelecionadaId(consulta.id)}>
                            <RefreshCcw size={15} />
                            Gerenciar consulta
                          </Botao>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EstadoVazio titulo="Nenhuma consulta agendada" descricao="Use o formulario ao lado para criar o primeiro agendamento." />
            )}
          </CartaoConteudo>
        </Cartao>
        </div>
      </div>
      <ModalConfirmacao
        aberto={Boolean(desfechoPendente)}
        titulo={desfechoPendente?.status === 'cancelada' ? 'Cancelar consulta' : desfechoPendente ? `Registrar ${rotuloStatusConsulta(desfechoPendente.status).toLocaleLowerCase('pt-BR')}` : 'Confirmar desfecho'}
        mensagem={desfechoPendente?.status === 'cancelada' ? 'Cancelar a consulta libera o horario na agenda interna e processa as integracoes configuradas.' : 'Este desfecho nao podera ser alterado.'}
        rotuloConfirmar={desfechoPendente?.status === 'cancelada' ? 'Cancelar consulta' : `Registrar ${desfechoPendente ? rotuloStatusConsulta(desfechoPendente.status).toLocaleLowerCase('pt-BR') : 'desfecho'}`}
        confirmando={Boolean(desfechoPendente && processandoConsultaId === desfechoPendente.consulta.id)}
        aoCancelar={() => setDesfechoPendente(null)}
        aoConfirmar={() => {
          if (!desfechoPendente) return;
          void registrarDesfecho(desfechoPendente.consulta, desfechoPendente.status).then((concluida) => {
            if (concluida) setDesfechoPendente(null);
          });
        }}
      />
      <ModalConfirmacao
        aberto={rotacionarLinkPendente}
        titulo="Rotacionar link publico"
        mensagem="Rotacionar o link invalida a URL publica anterior imediatamente. Deseja continuar?"
        rotuloConfirmar="Confirmar rotacao"
        confirmando={processandoSolicitacaoId === 'rotacionar-link'}
        aoCancelar={() => setRotacionarLinkPendente(false)}
        aoConfirmar={() => {
          setRotacionarLinkPendente(false);
          void executarRotacaoLink();
        }}
      />
    </div>
  );
}
