import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull, MoreThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProcessadorNotificacoes } from '../../comunicacoes/aplicacao/processador-notificacoes';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { ConsultaAgendaRespostaDto, CriarConsultaAgendaDto } from './dtos';
import { ResultadoGoogleCalendar, ServicoGoogleCalendar } from './servico-google-calendar';

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

  private async criarRegistroInterno(tenantId: string, dados: CriarConsultaAgendaDto): Promise<ContextoConsultaCriada> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = dados.fimEm
      ? dataValida(dados.fimEm)
      : new Date(inicioEm.getTime() + (dados.duracaoMinutos ?? 50) * 60 * 1000);
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

    const template = templates.find((item) => item.canal === tipo && (tipo === 'email' || item.aprovado));
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };

    try {
      const mensagem = await this.comunicacoes.dispararMensagem(tenantId, {
        pacienteId: contexto.consulta.pacienteId,
        canalId: canal.id,
        templateId: template.id,
        payload: {
          destino,
          nomePaciente: contexto.pacienteNome,
          profissionalNome: contexto.profissionalNome,
          consultaId: contexto.consulta.id,
          consultaInicioEm: contexto.consulta.inicioEm.toISOString(),
          consultaFimEm: contexto.consulta.fimEm.toISOString(),
          assunto: 'Consulta agendada - OctaClin',
          texto: contexto.textoMensagem,
          observacao: contexto.textoMensagem
        }
      });
      await this.processadorNotificacoes.processarMensagem(tenantId, mensagem.id, { propagarErro: false });
      return { status: 'enviado', mensagemId: mensagem.id };
    } catch (erro) {
      return { status: 'falhou', erro: erro instanceof Error ? erro.message : 'Falha ao disparar notificacao.' };
    }
  }

  private montarTextoMensagem(nomePaciente: string, inicioEm: Date) {
    const data = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(inicioEm);
    const hora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    }).format(inicioEm);

    return `Ola ${nomePaciente}, tudo bem?\n\nPassando para avisar que sua consulta foi agendada para ${data} as ${hora}.\n\nQualquer coisa estou a disposicao!`;
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

  private obterEmailPaciente(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    return contato.includes('@') ? contato : undefined;
  }

  private obterWhatsappPaciente(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    return contato.includes('@') ? undefined : contato.replace(/\D/g, '');
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
