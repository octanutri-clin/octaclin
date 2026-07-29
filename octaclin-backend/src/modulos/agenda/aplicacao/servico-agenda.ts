import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull, LessThan, MoreThan, MoreThanOrEqual, QueryFailedError } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverPacienteIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-paciente';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProcessadorNotificacoes } from '../../comunicacoes/aplicacao/processador-notificacoes';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm, StatusAgendaConsulta } from '../infraestrutura/agenda-consulta.orm';
import {
  CancelarConsultaAgendaDto,
  ConsultaAgendaRespostaDto,
  CriarConsultaAgendaDto,
  NotificacoesConsultaAgenda,
  RegistrarDesfechoConsultaAgendaDto,
  RemarcarConsultaAgendaDto,
  ResultadoNotificacaoAgenda
} from './dtos';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { ResultadoGoogleCalendar, ServicoGoogleCalendar } from './servico-google-calendar';

const EVENTO_CONSULTA_AGENDADA = 'agenda.consulta.agendada';
const EVENTO_CONSULTA_CANCELADA = 'agenda.consulta.cancelada';
type OrigemCancelamentoConsulta = 'profissional' | 'paciente' | 'google';
const CONSTRAINT_SOBREPOSICAO_AGENDA = 'ex_agenda_consultas_profissional_horario_ativo';
const MENSAGEM_CONFLITO_HORARIO = 'Ja existe consulta agendada neste horario para o profissional.';
const STATUS_CONSULTA_ATIVOS: StatusAgendaConsulta[] = ['agendada', 'reagendada'];
const STATUS_CONSULTA_TERMINAIS: StatusAgendaConsulta[] = ['concluida', 'falta', 'cancelada'];

interface ContextoConsultaCriada {
  consulta: AgendaConsultaOrm;
  pacienteNome: string;
  profissionalNome?: string;
  emailContato?: string;
  whatsappContato?: string;
  textoMensagem: string;
}

interface JanelaConsulta {
  inicioEm: Date;
  fimEm: Date;
}

interface ContatoPacienteAgenda {
  email?: string;
  whatsapp?: string;
  preferencias: {
    email: boolean;
    whatsapp: boolean;
  };
}

function dataValida(valor: string): Date {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new BadRequestException('Data de agendamento invalida.');
  return data;
}

function textoOpcional(valor?: string): string | undefined {
  return valor?.trim() || undefined;
}

@Injectable()
export class ServicoAgenda {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly processadorNotificacoes: ProcessadorNotificacoes,
    private readonly servicoConexao: ServicoConexaoGoogleCalendar
  ) {}

  async listarConsultas(tenantId: string, usuario: UsuarioAutenticado): Promise<ConsultaAgendaRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
        where: {
          tenantId,
          inicioEm: MoreThanOrEqual(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)),
          ...(profissionalId ? { profissionalId } : {})
        },
        order: { inicioEm: 'ASC' },
        take: 200
      });
      return consultas.map((consulta) => this.mapearResposta(consulta));
    });
  }

  async criarConsulta(tenantId: string, dados: CriarConsultaAgendaDto, usuario: UsuarioAutenticado): Promise<ConsultaAgendaRespostaDto> {
    const contexto = await this.criarRegistroInterno(tenantId, dados, usuario);
    const credenciais = contexto.consulta.profissionalId
      ? await this.servicoConexao.obterConexaoAtiva(tenantId, contexto.consulta.profissionalId)
      : undefined;
    const google = await this.googleCalendar.criarEvento({
      resumo: `Consulta OctaClin - ${contexto.pacienteNome}`,
      descricao: this.montarDescricaoEvento(contexto),
      inicioEm: contexto.consulta.inicioEm,
      fimEm: contexto.consulta.fimEm,
      timezone: contexto.consulta.timezone,
      local: contexto.consulta.local,
      emailConvidado: contexto.emailContato,
      consultaId: contexto.consulta.id,
      credenciais
    });
    const notificacoes: NotificacoesConsultaAgenda =
      dados.enviarNotificacoes === false
        ? { email: { status: 'ignorado', motivo: 'notificacoes_desativadas' }, whatsapp: { status: 'ignorado', motivo: 'notificacoes_desativadas' } }
        : await this.enviarNotificacoes(tenantId, contexto, EVENTO_CONSULTA_AGENDADA);

    const consultaAtualizada = await this.atualizarResultadoIntegracoes(tenantId, contexto.consulta.id, google, notificacoes);
    return this.mapearResposta(consultaAtualizada, contexto.pacienteNome, contexto.profissionalNome);
  }

  async remarcarConsulta(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    const profissionalIdDoUsuario = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
    );
    return this.executarRemarcacao(tenantId, consultaId, dados, profissionalIdDoUsuario, true);
  }

  async remarcarConsultaComoSistema(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    profissionalId: string
  ): Promise<ConsultaAgendaRespostaDto> {
    return this.executarRemarcacao(tenantId, consultaId, dados, profissionalId, false);
  }

  private async executarRemarcacao(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    profissionalIdEscopo: string | undefined,
    propagarParaGoogle: boolean
  ): Promise<ConsultaAgendaRespostaDto> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = this.calcularFim(inicioEm, dados);
    if (fimEm <= inicioEm) throw new BadRequestException('Horario final deve ser posterior ao inicio da consulta.');

    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({
        where: { id: consultaId, tenantId, ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {}) },
        lock: { mode: 'pessimistic_write' }
      });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (STATUS_CONSULTA_TERMINAIS.includes(atual.status)) {
        throw new BadRequestException('Consulta encerrada nao pode ser remarcada.');
      }

      await this.validarConflitoHorario(gerenciador, tenantId, atual.profissionalId, { inicioEm, fimEm }, atual.id);
      const inicioAnterior = atual.inicioEm;
      const fimAnterior = atual.fimEm;
      atual.inicioEm = inicioEm;
      atual.fimEm = fimEm;
      atual.status = 'reagendada';
      atual.local = dados.local !== undefined ? textoOpcional(dados.local) : atual.local;
      atual.observacoes = dados.observacoes !== undefined ? textoOpcional(dados.observacoes) : atual.observacoes;
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'remarcada',
        origem: propagarParaGoogle ? 'octaclin' : 'google_agenda',
        inicioAnteriorEm: inicioAnterior.toISOString(),
        fimAnteriorEm: fimAnterior.toISOString(),
        inicioNovoEm: inicioEm.toISOString(),
        fimNovoEm: fimEm.toISOString()
      });
      return this.salvarConsultaProtegidaContraSobreposicao(() => repositorio.save(atual));
    });

    if (!propagarParaGoogle) return this.mapearResposta(consulta);

    const credenciais = consulta.profissionalId
      ? await this.servicoConexao.obterConexaoAtiva(tenantId, consulta.profissionalId)
      : undefined;
    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.atualizarEvento({
          calendarId: consulta.googleCalendarId,
          eventId: consulta.googleEventId,
          consultaId: consulta.id,
          resumo: consulta.titulo,
          descricao: this.montarDescricaoEvento({
            consulta,
            pacienteNome: this.nomePacientePayload(consulta),
            profissionalNome: this.nomeProfissionalPayload(consulta),
            textoMensagem: ''
          }),
          inicioEm: consulta.inicioEm,
          fimEm: consulta.fimEm,
          timezone: consulta.timezone,
          local: consulta.local,
          emailConvidado: this.emailContatoPayload(consulta),
          credenciais
        })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    return this.mapearResposta(await this.aplicarResultadoGoogle(tenantId, consulta.id, google));
  }

  async registrarDesfecho(
    tenantId: string,
    consultaId: string,
    dados: RegistrarDesfechoConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    const profissionalIdDoUsuario = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
    );

    if (dados.status === 'cancelada') {
      return this.executarCancelamento(
        tenantId,
        consultaId,
        {},
        { profissionalId: profissionalIdDoUsuario },
        'profissional',
        true,
        false
      );
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({
        where: {
          id: consultaId,
          tenantId,
          ...(profissionalIdDoUsuario ? { profissionalId: profissionalIdDoUsuario } : {})
        },
        lock: { mode: 'pessimistic_write' }
      });
      if (!consulta) throw new NotFoundException('Consulta nao encontrada.');
      if (STATUS_CONSULTA_TERMINAIS.includes(consulta.status)) {
        throw new BadRequestException('Consulta encerrada nao pode receber novo desfecho.');
      }

      consulta.status = dados.status;
      consulta.payload = this.adicionarHistorico(consulta.payload, {
        acao: 'desfecho_registrado',
        status: dados.status,
        registradoEm: new Date().toISOString()
      });
      return this.mapearResposta(await repositorio.save(consulta));
    });
  }

  async cancelarConsulta(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    const profissionalIdDoUsuario = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
    );
    return this.executarCancelamento(
      tenantId,
      consultaId,
      dados,
      { profissionalId: profissionalIdDoUsuario },
      'profissional',
      true
    );
  }

  async desmarcarConsultaPeloPaciente(
    tenantId: string,
    consultaId: string,
    usuarioId: string
  ): Promise<ConsultaAgendaRespostaDto> {
    const pacienteId = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverPacienteIdDoUsuario(gerenciador, tenantId, usuarioId)
    );
    return this.executarCancelamento(tenantId, consultaId, {}, { pacienteId }, 'paciente', true);
  }

  async cancelarConsultaComoSistema(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    profissionalId: string
  ): Promise<ConsultaAgendaRespostaDto> {
    return this.executarCancelamento(tenantId, consultaId, dados, { profissionalId }, 'google', false);
  }

  private async executarCancelamento(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    escopo: { profissionalId?: string; pacienteId?: string },
    origem: OrigemCancelamentoConsulta,
    propagarParaGoogle: boolean,
    permitirCancelamentoIdempotente = true
  ): Promise<ConsultaAgendaRespostaDto> {
    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({
        where: {
          id: consultaId,
          tenantId,
          ...(escopo.profissionalId ? { profissionalId: escopo.profissionalId } : {}),
          ...(escopo.pacienteId ? { pacienteId: escopo.pacienteId } : {})
        },
        lock: { mode: 'pessimistic_write' }
      });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (atual.status === 'cancelada' && permitirCancelamentoIdempotente) return atual;
      if (STATUS_CONSULTA_TERMINAIS.includes(atual.status)) {
        throw new BadRequestException(
          permitirCancelamentoIdempotente
            ? 'Consulta encerrada nao pode ser cancelada.'
            : 'Consulta encerrada nao pode receber novo desfecho.'
        );
      }

      atual.status = 'cancelada';
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'cancelada',
        origem,
        motivo: textoOpcional(dados.motivo),
        canceladaEm: new Date().toISOString()
      });
      return repositorio.save(atual);
    });

    if (!propagarParaGoogle) return this.mapearResposta(consulta);

    const credenciais = consulta.profissionalId
      ? await this.servicoConexao.obterConexaoAtiva(tenantId, consulta.profissionalId)
      : undefined;
    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.cancelarEvento({
          calendarId: consulta.googleCalendarId,
          eventId: consulta.googleEventId,
          credenciais
        })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    const consultaFinal = await this.aplicarResultadoGoogle(tenantId, consulta.id, google);

    if (origem === 'profissional') {
      await this.notificarCancelamentoAoPaciente(tenantId, consultaFinal);
    }

    return this.mapearResposta(consultaFinal);
  }

  private async notificarCancelamentoAoPaciente(tenantId: string, consulta: AgendaConsultaOrm): Promise<void> {
    const payload = (consulta.payload ?? {}) as Record<string, unknown>;
    const emailContato = typeof payload.emailContato === 'string' ? payload.emailContato : undefined;
    const whatsappContato = typeof payload.whatsappContato === 'string' ? payload.whatsappContato : undefined;
    if (!emailContato && !whatsappContato) return;

    const pacienteNome = this.nomePacientePayload(consulta);
    const contexto: ContextoConsultaCriada = {
      consulta,
      pacienteNome,
      profissionalNome: this.nomeProfissionalPayload(consulta),
      emailContato,
      whatsappContato,
      textoMensagem: this.montarTextoMensagemCancelamento(pacienteNome, consulta.inicioEm)
    };
    await this.enviarNotificacoes(tenantId, contexto, EVENTO_CONSULTA_CANCELADA);
  }

  private async criarRegistroInterno(
    tenantId: string,
    dados: CriarConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ContextoConsultaCriada> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = this.calcularFim(inicioEm, dados);
    if (fimEm <= inicioEm) throw new BadRequestException('Horario final deve ser posterior ao inicio da consulta.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: dados.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const profissionalId = profissionalIdDoUsuario ?? dados.profissionalId ?? paciente.profissionalResponsavelId;
      const profissional = profissionalId
        ? await gerenciador.getRepository(ProfissionalOrm).findOne({
            where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
          })
        : null;
      if (profissionalId && !profissional) throw new NotFoundException('Profissional nao encontrado.');
      await this.validarConflitoHorario(gerenciador, tenantId, profissionalId, { inicioEm, fimEm });

      const pacienteNome = this.criptografia.descriptografar(paciente.nomeCriptografado);
      const profissionalNome = profissional ? this.criptografia.descriptografar(profissional.nomeCriptografado) : undefined;
      const emailContato = textoOpcional(dados.emailContato) ?? this.obterEmailPaciente(paciente);
      const whatsappContato = textoOpcional(dados.whatsappContato) ?? this.obterWhatsappPaciente(paciente);
      const textoMensagem = this.montarTextoMensagem(pacienteNome, inicioEm);
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await this.salvarConsultaProtegidaContraSobreposicao(() =>
        repositorio.save(
          repositorio.create({
            tenantId,
            pacienteId: paciente.id,
            profissionalId,
            titulo: `Consulta - ${pacienteNome}`,
            inicioEm,
            fimEm,
            timezone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Sao_Paulo',
            status: 'agendada',
            local: textoOpcional(dados.local),
            observacoes: textoOpcional(dados.observacoes),
            notificacoes: {},
            payload: {
              pacienteNome,
              profissionalNome,
              emailContato,
              whatsappContato,
              textoMensagem
            }
          })
        )
      );

      return { consulta, pacienteNome, profissionalNome, emailContato, whatsappContato, textoMensagem };
    });
  }

  private async atualizarResultadoIntegracoes(
    tenantId: string,
    consultaId: string,
    google: ResultadoGoogleCalendar,
    notificacoes: NotificacoesConsultaAgenda
  ): Promise<AgendaConsultaOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({
        where: { id: consultaId, tenantId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!consulta) throw new NotFoundException('Consulta nao encontrada.');

      if (google.sincronizado) {
        consulta.googleCalendarId = google.calendarId;
        consulta.googleEventId = google.eventId;
        consulta.googleEventHtmlLink = google.htmlLink;
      }
      consulta.notificacoes = { ...notificacoes, googleCalendar: google };
      consulta.payload = { ...consulta.payload, googleCalendar: google };
      return repositorio.save(consulta);
    });
  }

  private async aplicarResultadoGoogle(
    tenantId: string,
    consultaId: string,
    google: ResultadoGoogleCalendar
  ): Promise<AgendaConsultaOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({ where: { id: consultaId, tenantId } });
      if (!consulta) throw new NotFoundException('Consulta nao encontrada.');

      if (google.sincronizado) {
        consulta.googleCalendarId = google.calendarId;
        consulta.googleEventId = google.eventId;
        consulta.googleEventHtmlLink = google.htmlLink ?? consulta.googleEventHtmlLink;
      }
      consulta.notificacoes = { ...(consulta.notificacoes ?? {}), googleCalendar: google };
      consulta.payload = { ...consulta.payload, googleCalendar: google };
      return repositorio.save(consulta);
    });
  }

  private async validarConflitoHorario(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string | undefined,
    janela: JanelaConsulta,
    ignorarConsultaId?: string
  ) {
    if (!profissionalId) return;
    const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
      where: { tenantId, profissionalId, status: In(STATUS_CONSULTA_ATIVOS) },
      take: 500
    });
    const conflitoConsulta = consultas.some(
      (consulta) =>
        consulta.id !== ignorarConsultaId &&
        consulta.inicioEm < janela.fimEm &&
        consulta.fimEm > janela.inicioEm
    );
    if (conflitoConsulta) throw new BadRequestException(MENSAGEM_CONFLITO_HORARIO);

    const conflitoExterno = await gerenciador.getRepository(AgendaBloqueioExternoOrm).exists({
      where: {
        tenantId,
        profissionalId,
        inicioEm: LessThan(janela.fimEm),
        fimEm: MoreThan(janela.inicioEm)
      }
    });
    if (conflitoExterno) throw new BadRequestException(MENSAGEM_CONFLITO_HORARIO);
  }

  private async salvarConsultaProtegidaContraSobreposicao(
    operacao: () => Promise<AgendaConsultaOrm>
  ): Promise<AgendaConsultaOrm> {
    try {
      return await operacao();
    } catch (erro) {
      if (this.ehViolacaoDaConstraintDeSobreposicao(erro)) {
        throw new BadRequestException(MENSAGEM_CONFLITO_HORARIO);
      }
      throw erro;
    }
  }

  private ehViolacaoDaConstraintDeSobreposicao(erro: unknown): boolean {
    if (!(erro instanceof QueryFailedError)) return false;

    const erroPostgres: unknown = erro.driverError;
    if (typeof erroPostgres !== 'object' || erroPostgres === null) return false;
    if (!('code' in erroPostgres) || !('constraint' in erroPostgres)) return false;

    return (
      erroPostgres.code === '23P01' &&
      erroPostgres.constraint === CONSTRAINT_SOBREPOSICAO_AGENDA
    );
  }

  private calcularFim(inicioEm: Date, dados: { fimEm?: string; duracaoMinutos?: number }) {
    return dados.fimEm
      ? dataValida(dados.fimEm)
      : new Date(inicioEm.getTime() + (dados.duracaoMinutos ?? 50) * 60 * 1000);
  }

  private adicionarHistorico(payload: Record<string, unknown> | undefined, evento: Record<string, unknown>) {
    const historico = Array.isArray(payload?.historico) ? payload.historico : [];
    return {
      ...(payload ?? {}),
      historico: [...historico, evento]
    };
  }

  private async enviarNotificacoes(tenantId: string, contexto: ContextoConsultaCriada, evento: string) {
    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId),
      this.comunicacoes.listarTemplates(tenantId)
    ]);

    const email = await this.enviarNotificacao(tenantId, 'email', contexto, canais, templates, evento);
    const whatsapp = await this.enviarNotificacao(tenantId, 'whatsapp', contexto, canais, templates, evento);
    return { email, whatsapp };
  }

  private async enviarNotificacao(
    tenantId: string,
    tipo: 'email' | 'whatsapp',
    contexto: ContextoConsultaCriada,
    canais: CanalNotificacaoOrm[],
    templates: TemplateMensagemOrm[],
    evento: string
  ): Promise<ResultadoNotificacaoAgenda> {
    const destino = tipo === 'email' ? contexto.emailContato : contexto.whatsappContato;
    if (!destino) return { status: 'ignorado', motivo: 'contato_ausente' };

    const canal = canais.find((item) => item.tipo === tipo && item.ativo);
    if (!canal) return { status: 'ignorado', motivo: 'canal_ausente' };

    const template = this.selecionarTemplateNotificacao(templates, tipo, evento);
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };
    const payload = this.montarPayloadNotificacao(tipo, template, contexto, destino, evento);

    try {
      const mensagem = await this.comunicacoes.dispararMensagem(tenantId, {
        pacienteId: contexto.consulta.pacienteId,
        canalId: canal.id,
        templateId: template.id,
        payload
      });
      await this.processadorNotificacoes.processarMensagem(tenantId, mensagem.id, { propagarErro: false });
      return { status: 'enviado', mensagemId: mensagem.id };
    } catch (erro) {
      return { status: 'falhou', erro: erro instanceof Error ? erro.message : 'Falha ao disparar notificacao.' };
    }
  }

  private selecionarTemplateNotificacao(
    templates: TemplateMensagemOrm[],
    tipo: 'email' | 'whatsapp',
    evento: string
  ): TemplateMensagemOrm | undefined {
    const candidatos = templates.filter((item) => item.canal === tipo && (tipo === 'email' || item.aprovado));
    return (
      candidatos.find((item) => this.obterTextoConteudo(item, 'evento') === evento) ??
      candidatos.find((item) => !this.obterTextoConteudo(item, 'evento'))
    );
  }

  private montarPayloadNotificacao(
    tipo: 'email' | 'whatsapp',
    template: TemplateMensagemOrm,
    contexto: ContextoConsultaCriada,
    destino: string,
    evento: string
  ) {
    const payload: Record<string, unknown> = {
      destino,
      nomePaciente: contexto.pacienteNome,
      profissionalNome: contexto.profissionalNome,
      consultaId: contexto.consulta.id,
      consultaInicioEm: contexto.consulta.inicioEm.toISOString(),
      consultaFimEm: contexto.consulta.fimEm.toISOString(),
      assunto: evento === EVENTO_CONSULTA_CANCELADA ? 'Consulta cancelada - OctaClin' : 'Consulta agendada - OctaClin',
      texto: contexto.textoMensagem,
      observacao: contexto.textoMensagem
    };

    if (tipo !== 'whatsapp') return payload;

    const idioma = this.obterTextoConteudo(template, 'idioma');
    const components = this.montarComponentesTemplateWhatsapp(template, contexto);
    return {
      ...payload,
      evento,
      ...(idioma ? { idioma } : {}),
      ...(components ? { components } : {})
    };
  }

  private montarComponentesTemplateWhatsapp(template: TemplateMensagemOrm, contexto: ContextoConsultaCriada) {
    const parametros = Array.isArray(template.conteudo?.parametros)
      ? template.conteudo.parametros.filter((parametro): parametro is string => typeof parametro === 'string')
      : [];
    if (!parametros.length) return undefined;

    return [
      {
        type: 'body',
        parameters: parametros.map((parametro) => ({
          type: 'text',
          text: this.valorParametroTemplate(parametro, contexto)
        }))
      }
    ];
  }

  private valorParametroTemplate(parametro: string, contexto: ContextoConsultaCriada) {
    const dataConsulta = this.formatarDataConsulta(contexto.consulta.inicioEm, contexto.consulta.timezone);
    const horaConsulta = this.formatarHoraConsulta(contexto.consulta.inicioEm, contexto.consulta.timezone);
    const mapa: Record<string, string | undefined> = {
      nomePaciente: contexto.pacienteNome,
      profissionalNome: contexto.profissionalNome,
      dataConsulta,
      horaConsulta,
      localConsulta: contexto.consulta.local,
      textoMensagem: contexto.textoMensagem
    };
    return mapa[parametro] ?? '';
  }

  private obterTextoConteudo(template: TemplateMensagemOrm, chave: string) {
    const valor = template.conteudo?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private montarTextoMensagem(nomePaciente: string, inicioEm: Date) {
    const data = this.formatarDataConsulta(inicioEm);
    const hora = this.formatarHoraConsulta(inicioEm);

    return `Ola ${nomePaciente}, tudo bem?\n\nPassando para avisar que sua consulta foi agendada para ${data} as ${hora}.\n\nQualquer coisa estou a disposicao!`;
  }

  private montarTextoMensagemCancelamento(nomePaciente: string, inicioEm: Date) {
    const data = this.formatarDataConsulta(inicioEm);
    const hora = this.formatarHoraConsulta(inicioEm);

    return `Ola ${nomePaciente}, tudo bem?\n\nSua consulta agendada para ${data} as ${hora} foi cancelada pelo profissional.\n\nEntre em contato para reagendar quando for conveniente.`;
  }

  private formatarDataConsulta(inicioEm: Date, timezone = 'America/Sao_Paulo') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(inicioEm);
  }

  private formatarHoraConsulta(inicioEm: Date, timezone = 'America/Sao_Paulo') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit'
    }).format(inicioEm);
  }

  private montarDescricaoEvento(contexto: ContextoConsultaCriada) {
    const partes = [
      `Paciente: ${contexto.pacienteNome}`,
      contexto.profissionalNome ? `Profissional: ${contexto.profissionalNome}` : undefined,
      contexto.consulta.local ? `Local: ${contexto.consulta.local}` : undefined,
      contexto.consulta.observacoes ? `Observacoes: ${contexto.consulta.observacoes}` : undefined,
      '',
      'Evento criado automaticamente pelo OctaClin.'
    ];
    return partes.filter((parte) => parte !== undefined).join('\n');
  }

  private nomePacientePayload(consulta: AgendaConsultaOrm) {
    return typeof consulta.payload?.pacienteNome === 'string' ? consulta.payload.pacienteNome : consulta.titulo;
  }

  private nomeProfissionalPayload(consulta: AgendaConsultaOrm) {
    return typeof consulta.payload?.profissionalNome === 'string' ? consulta.payload.profissionalNome : undefined;
  }

  private emailContatoPayload(consulta: AgendaConsultaOrm) {
    return typeof consulta.payload?.emailContato === 'string' ? consulta.payload.emailContato : undefined;
  }

  private obterEmailPaciente(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.obterContatoPaciente(paciente);
    return contato.preferencias.email ? contato.email : undefined;
  }

  private obterWhatsappPaciente(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.obterContatoPaciente(paciente);
    return contato.preferencias.whatsapp ? contato.whatsapp : undefined;
  }

  private obterContatoPaciente(paciente: PacienteOrm): ContatoPacienteAgenda {
    const preferencias = { email: true, whatsapp: true };
    if (!paciente.contatoCriptografado) return { preferencias };
    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    try {
      const parseado = JSON.parse(contato) as {
        email?: unknown;
        whatsapp?: unknown;
        preferencias?: { email?: unknown; whatsapp?: unknown };
      };
      return {
        email: typeof parseado.email === 'string' ? this.normalizarEmail(parseado.email) : undefined,
        whatsapp: typeof parseado.whatsapp === 'string' ? this.normalizarWhatsapp(parseado.whatsapp) : undefined,
        preferencias: {
          email: typeof parseado.preferencias?.email === 'boolean' ? parseado.preferencias.email : true,
          whatsapp: typeof parseado.preferencias?.whatsapp === 'boolean' ? parseado.preferencias.whatsapp : true
        }
      };
    } catch {
      return contato.includes('@')
        ? { email: this.normalizarEmail(contato), preferencias }
        : { whatsapp: this.normalizarWhatsapp(contato), preferencias };
    }
  }

  private normalizarEmail(email?: string): string | undefined {
    const normalizado = email?.trim().toLowerCase();
    return normalizado || undefined;
  }

  private normalizarWhatsapp(whatsapp?: string): string | undefined {
    const normalizado = whatsapp?.replace(/\D/g, '');
    return normalizado || undefined;
  }

  private mapearResposta(
    consulta: AgendaConsultaOrm,
    pacienteNome?: string,
    profissionalNome?: string
  ): ConsultaAgendaRespostaDto {
    const payload = consulta.payload ?? {};
    return {
      id: consulta.id,
      tenantId: consulta.tenantId,
      pacienteId: consulta.pacienteId,
      pacienteNome: pacienteNome ?? (typeof payload.pacienteNome === 'string' ? payload.pacienteNome : undefined),
      profissionalId: consulta.profissionalId,
      profissionalNome: profissionalNome ?? (typeof payload.profissionalNome === 'string' ? payload.profissionalNome : undefined),
      titulo: consulta.titulo,
      inicioEm: consulta.inicioEm,
      fimEm: consulta.fimEm,
      timezone: consulta.timezone,
      status: consulta.status,
      local: consulta.local,
      observacoes: consulta.observacoes,
      googleCalendarId: consulta.googleCalendarId,
      googleEventId: consulta.googleEventId,
      googleEventHtmlLink: consulta.googleEventHtmlLink,
      notificacoes: (consulta.notificacoes ?? {}) as NotificacoesConsultaAgenda,
      payload,
      criadoEm: consulta.criadoEm,
      atualizadoEm: consulta.atualizadoEm
    };
  }
}
