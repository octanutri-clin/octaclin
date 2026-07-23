import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, MoreThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProcessadorNotificacoes } from '../../comunicacoes/aplicacao/processador-notificacoes';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { CancelarConsultaAgendaDto, ConsultaAgendaRespostaDto, CriarConsultaAgendaDto, RemarcarConsultaAgendaDto } from './dtos';
import { ResultadoGoogleCalendar, ServicoGoogleCalendar } from './servico-google-calendar';

const EVENTO_CONSULTA_AGENDADA = 'agenda.consulta.agendada';

type ResultadoNotificacaoAgenda =
  | { status: 'enviado'; mensagemId: string }
  | { status: 'ignorado'; motivo: string }
  | { status: 'falhou'; erro: string };

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
    private readonly processadorNotificacoes: ProcessadorNotificacoes
  ) {}

  async listarConsultas(tenantId: string): Promise<ConsultaAgendaRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
        where: { tenantId, inicioEm: MoreThanOrEqual(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)) },
        order: { inicioEm: 'ASC' },
        take: 200
      });
      return consultas.map((consulta) => this.mapearResposta(consulta));
    });
  }

  async criarConsulta(tenantId: string, dados: CriarConsultaAgendaDto): Promise<ConsultaAgendaRespostaDto> {
    const contexto = await this.criarRegistroInterno(tenantId, dados);
    const google = await this.googleCalendar.criarEvento({
      resumo: `Consulta OctaClin - ${contexto.pacienteNome}`,
      descricao: this.montarDescricaoEvento(contexto),
      inicioEm: contexto.consulta.inicioEm,
      fimEm: contexto.consulta.fimEm,
      timezone: contexto.consulta.timezone
    });
    const notificacoes: Record<string, ResultadoNotificacaoAgenda> =
      dados.enviarNotificacoes === false
        ? { email: { status: 'ignorado', motivo: 'notificacoes_desativadas' }, whatsapp: { status: 'ignorado', motivo: 'notificacoes_desativadas' } }
        : await this.enviarNotificacoes(tenantId, contexto);

    const consultaAtualizada = await this.atualizarResultadoIntegracoes(tenantId, contexto.consulta.id, google, notificacoes);
    return this.mapearResposta(consultaAtualizada, contexto.pacienteNome, contexto.profissionalNome);
  }

  async remarcarConsulta(tenantId: string, consultaId: string, dados: RemarcarConsultaAgendaDto): Promise<ConsultaAgendaRespostaDto> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = this.calcularFim(inicioEm, dados);
    if (fimEm <= inicioEm) throw new BadRequestException('Horario final deve ser posterior ao inicio da consulta.');

    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({ where: { id: consultaId, tenantId } });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (atual.status === 'cancelada') throw new BadRequestException('Consulta cancelada nao pode ser remarcada.');

      await this.validarConflitoHorario(gerenciador, tenantId, atual.profissionalId, { inicioEm, fimEm }, atual.id);
      const inicioAnterior = atual.inicioEm;
      const fimAnterior = atual.fimEm;
      atual.inicioEm = inicioEm;
      atual.fimEm = fimEm;
      atual.local = dados.local !== undefined ? textoOpcional(dados.local) : atual.local;
      atual.observacoes = dados.observacoes !== undefined ? textoOpcional(dados.observacoes) : atual.observacoes;
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'remarcada',
        inicioAnteriorEm: inicioAnterior.toISOString(),
        fimAnteriorEm: fimAnterior.toISOString(),
        inicioNovoEm: inicioEm.toISOString(),
        fimNovoEm: fimEm.toISOString()
      });
      return repositorio.save(atual);
    });

    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.atualizarEvento({
          calendarId: consulta.googleCalendarId,
          eventId: consulta.googleEventId,
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
          local: consulta.local
        })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    return this.mapearResposta(await this.aplicarResultadoGoogle(tenantId, consulta.id, google));
  }

  async cancelarConsulta(tenantId: string, consultaId: string, dados: CancelarConsultaAgendaDto): Promise<ConsultaAgendaRespostaDto> {
    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({ where: { id: consultaId, tenantId } });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (atual.status === 'cancelada') return atual;

      atual.status = 'cancelada';
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'cancelada',
        motivo: textoOpcional(dados.motivo),
        canceladaEm: new Date().toISOString()
      });
      return repositorio.save(atual);
    });

    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.cancelarEvento({ calendarId: consulta.googleCalendarId, eventId: consulta.googleEventId })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    return this.mapearResposta(await this.aplicarResultadoGoogle(tenantId, consulta.id, google));
  }

  private async criarRegistroInterno(tenantId: string, dados: CriarConsultaAgendaDto): Promise<ContextoConsultaCriada> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = this.calcularFim(inicioEm, dados);
    if (fimEm <= inicioEm) throw new BadRequestException('Horario final deve ser posterior ao inicio da consulta.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: dados.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const profissionalId = dados.profissionalId ?? paciente.profissionalResponsavelId;
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
      const consulta = await repositorio.save(
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
      );

      return { consulta, pacienteNome, profissionalNome, emailContato, whatsappContato, textoMensagem };
    });
  }

  private async atualizarResultadoIntegracoes(
    tenantId: string,
    consultaId: string,
    google: ResultadoGoogleCalendar,
    notificacoes: Record<string, ResultadoNotificacaoAgenda>
  ): Promise<AgendaConsultaOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({ where: { id: consultaId, tenantId } });
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
      where: { tenantId, profissionalId, status: 'agendada' },
      take: 500
    });
    const conflito = consultas.some(
      (consulta) =>
        consulta.id !== ignorarConsultaId &&
        consulta.inicioEm < janela.fimEm &&
        consulta.fimEm > janela.inicioEm
    );
    if (conflito) throw new BadRequestException('Ja existe consulta agendada neste horario para o profissional.');
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

  private async enviarNotificacoes(tenantId: string, contexto: ContextoConsultaCriada) {
    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId),
      this.comunicacoes.listarTemplates(tenantId)
    ]);

    const email = await this.enviarNotificacao(tenantId, 'email', contexto, canais, templates);
    const whatsapp = await this.enviarNotificacao(tenantId, 'whatsapp', contexto, canais, templates);
    return { email, whatsapp };
  }

  private async enviarNotificacao(
    tenantId: string,
    tipo: 'email' | 'whatsapp',
    contexto: ContextoConsultaCriada,
    canais: CanalNotificacaoOrm[],
    templates: TemplateMensagemOrm[]
  ): Promise<ResultadoNotificacaoAgenda> {
    const destino = tipo === 'email' ? contexto.emailContato : contexto.whatsappContato;
    if (!destino) return { status: 'ignorado', motivo: 'contato_ausente' };

    const canal = canais.find((item) => item.tipo === tipo && item.ativo);
    if (!canal) return { status: 'ignorado', motivo: 'canal_ausente' };

    const template = this.selecionarTemplateNotificacao(templates, tipo, EVENTO_CONSULTA_AGENDADA);
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };
    const payload = this.montarPayloadNotificacao(tipo, template, contexto, destino, EVENTO_CONSULTA_AGENDADA);

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
      assunto: 'Consulta agendada - OctaClin',
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
      notificacoes: consulta.notificacoes ?? {},
      payload,
      criadoEm: consulta.criadoEm,
      atualizadoEm: consulta.atualizadoEm
    };
  }
}
