import { Injectable } from '@nestjs/common';
import { Between } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { TipoCanalNotificacao } from '../../comunicacoes/dominio/canal-notificacao';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';

const EVENTO_LEMBRETE_CONSULTA = 'agenda.consulta.lembrete';
const JANELA_LEMBRETE_INICIO_HORAS = 23;
const JANELA_LEMBRETE_FIM_HORAS = 25;

type TipoCanalLembrete = Extract<TipoCanalNotificacao, 'email' | 'whatsapp'>;
type CanalPreferidoPaciente = TipoCanalLembrete | 'qualquer';

type ResultadoCanalLembrete =
  | { status: 'pendente' | 'enviado'; mensagemId: string }
  | { status: 'ignorado'; motivo: string }
  | { status: 'falhou'; erro: string };

interface ResultadoProcessamentoLembretes {
  consultasAvaliadas: number;
  lembretesProcessados: number;
  lembretesIgnorados: number;
}

interface PreferenciasComunicacaoPaciente {
  email: boolean;
  whatsapp: boolean;
  canalPreferido: CanalPreferidoPaciente;
  horarioPermitido: {
    inicio: string;
    fim: string;
    timezone: string;
  };
  contatos: {
    email?: string;
    whatsapp?: string;
  };
}

const PREFERENCIAS_COMUNICACAO_PADRAO: PreferenciasComunicacaoPaciente = {
  email: true,
  whatsapp: true,
  canalPreferido: 'qualquer',
  horarioPermitido: {
    inicio: '08:00',
    fim: '20:00',
    timezone: 'America/Sao_Paulo'
  },
  contatos: {}
};

@Injectable()
export class ServicoLembretesAgenda {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async processarLembretesConsulta(tenantId: string, agora = new Date()): Promise<ResultadoProcessamentoLembretes> {
    const consultas = await this.buscarConsultasParaLembrete(tenantId, agora);
    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId),
      this.comunicacoes.listarTemplates(tenantId)
    ]);

    let lembretesProcessados = 0;
    let lembretesIgnorados = 0;

    for (const consulta of consultas) {
      if (this.lembreteJaProcessado(consulta)) {
        lembretesIgnorados += 1;
        continue;
      }

      const preferencias = await this.obterPreferenciasPaciente(tenantId, consulta.pacienteId);
      let email: ResultadoCanalLembrete;
      let whatsapp: ResultadoCanalLembrete;
      let motivo: string | undefined;

      if (!this.dentroHorarioPermitido(agora, preferencias.horarioPermitido)) {
        motivo = 'fora_horario_preferido';
        email = { status: 'ignorado', motivo };
        whatsapp = { status: 'ignorado', motivo };
      } else {
        email = await this.enviarLembrete(tenantId, 'email', consulta, canais, templates, preferencias);
        whatsapp = await this.enviarLembrete(tenantId, 'whatsapp', consulta, canais, templates, preferencias);
      }

      const status = email.status !== 'ignorado' || whatsapp.status !== 'ignorado' ? 'processado' : 'ignorado';
      const registro = {
        status,
        ...(motivo ? { motivo } : {}),
        processadoEm: agora.toISOString(),
        email,
        whatsapp
      };

      await this.registrarLembrete(tenantId, consulta, registro, agora);
      lembretesProcessados += 1;
    }

    return {
      consultasAvaliadas: consultas.length,
      lembretesProcessados,
      lembretesIgnorados
    };
  }

  private buscarConsultasParaLembrete(tenantId: string, agora: Date) {
    const inicioJanela = new Date(agora.getTime() + JANELA_LEMBRETE_INICIO_HORAS * 60 * 60 * 1000);
    const fimJanela = new Date(agora.getTime() + JANELA_LEMBRETE_FIM_HORAS * 60 * 60 * 1000);

    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(AgendaConsultaOrm).find({
        where: {
          tenantId,
          status: 'agendada',
          inicioEm: Between(inicioJanela, fimJanela)
        },
        order: { inicioEm: 'ASC' },
        take: 100
      })
    );
  }

  private lembreteJaProcessado(consulta: AgendaConsultaOrm) {
    const lembrete = this.objeto(consulta.notificacoes?.lembrete24h);
    return lembrete.status === 'processado';
  }

  private async enviarLembrete(
    tenantId: string,
    tipo: TipoCanalLembrete,
    consulta: AgendaConsultaOrm,
    canais: CanalNotificacaoOrm[],
    templates: TemplateMensagemOrm[],
    preferencias: PreferenciasComunicacaoPaciente
  ): Promise<ResultadoCanalLembrete> {
    if (!preferencias[tipo]) return { status: 'ignorado', motivo: 'preferencia_desativada' };
    if (preferencias.canalPreferido !== 'qualquer' && preferencias.canalPreferido !== tipo) {
      return { status: 'ignorado', motivo: 'canal_nao_preferido' };
    }

    const destino =
      tipo === 'email'
        ? preferencias.contatos.email ?? this.textoPayload(consulta, 'emailContato')
        : preferencias.contatos.whatsapp ?? this.textoPayload(consulta, 'whatsappContato');
    if (!destino) return { status: 'ignorado', motivo: 'contato_ausente' };

    const canal = canais.find((item) => item.tipo === tipo && item.ativo);
    if (!canal) return { status: 'ignorado', motivo: 'canal_ausente' };

    const template = this.selecionarTemplate(templates, tipo, EVENTO_LEMBRETE_CONSULTA);
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };

    try {
      const mensagem = await this.comunicacoes.dispararMensagem(tenantId, {
        pacienteId: consulta.pacienteId,
        canalId: canal.id,
        templateId: template.id,
        payload: this.montarPayload(tipo, template, consulta, destino)
      });
      await this.comunicacoes.publicarEventoNotificacao(tenantId, mensagem.id);
      return { status: 'pendente', mensagemId: mensagem.id };
    } catch (erro) {
      return { status: 'falhou', erro: erro instanceof Error ? erro.message : 'Falha ao enviar lembrete.' };
    }
  }

  private selecionarTemplate(templates: TemplateMensagemOrm[], tipo: TipoCanalLembrete, evento: string) {
    const candidatos = templates.filter((item) => item.canal === tipo && (tipo === 'email' || item.aprovado));
    return (
      candidatos.find((item) => this.textoConteudo(item, 'evento') === evento) ??
      candidatos.find((item) => !this.textoConteudo(item, 'evento'))
    );
  }

  private montarPayload(tipo: TipoCanalLembrete, template: TemplateMensagemOrm, consulta: AgendaConsultaOrm, destino: string) {
    const nomePaciente = this.textoPayload(consulta, 'pacienteNome') ?? consulta.titulo;
    const dataConsulta = this.formatarData(consulta.inicioEm, consulta.timezone);
    const horaConsulta = this.formatarHora(consulta.inicioEm, consulta.timezone);
    const texto = `Ola ${nomePaciente}, tudo bem?\n\nPassando para lembrar que sua consulta esta agendada para ${dataConsulta} as ${horaConsulta}.\n\nQualquer coisa estou a disposicao!`;
    const payload: Record<string, unknown> = {
      destino,
      evento: EVENTO_LEMBRETE_CONSULTA,
      consultaId: consulta.id,
      consultaInicioEm: consulta.inicioEm.toISOString(),
      consultaFimEm: consulta.fimEm.toISOString(),
      nomePaciente,
      profissionalNome: this.textoPayload(consulta, 'profissionalNome'),
      dataConsulta,
      horaConsulta,
      assunto: 'Lembrete de consulta - OctaClin',
      texto,
      observacao: texto
    };

    if (tipo !== 'whatsapp') return payload;

    const idioma = this.textoConteudo(template, 'idioma');
    const components = this.montarComponentesWhatsapp(template, consulta, {
      nomePaciente,
      dataConsulta,
      horaConsulta,
      textoMensagem: texto
    });
    return {
      ...payload,
      ...(idioma ? { idioma } : {}),
      ...(components ? { components } : {})
    };
  }

  private montarComponentesWhatsapp(
    template: TemplateMensagemOrm,
    consulta: AgendaConsultaOrm,
    valores: Record<string, string | undefined>
  ) {
    const parametros = Array.isArray(template.conteudo?.parametros)
      ? template.conteudo.parametros.filter((parametro): parametro is string => typeof parametro === 'string')
      : [];
    if (!parametros.length) return undefined;

    return [
      {
        type: 'body',
        parameters: parametros.map((parametro) => ({
          type: 'text',
          text: valores[parametro] ?? this.textoPayload(consulta, parametro) ?? ''
        }))
      }
    ];
  }

  private registrarLembrete(
    tenantId: string,
    consulta: AgendaConsultaOrm,
    registro: Record<string, unknown>,
    agora: Date
  ) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const notificacoes = {
        ...(consulta.notificacoes ?? {}),
        lembrete24h: registro
      };
      const payload = {
        ...(consulta.payload ?? {}),
        automacoes: [
          ...(Array.isArray(consulta.payload?.automacoes) ? consulta.payload.automacoes : []),
          {
            tipo: EVENTO_LEMBRETE_CONSULTA,
            status: registro.status,
            processadoEm: agora.toISOString()
          }
        ]
      };
      consulta.notificacoes = notificacoes;
      consulta.payload = payload;
      await gerenciador.getRepository(AgendaConsultaOrm).save(consulta);
    });
  }

  private textoPayload(consulta: AgendaConsultaOrm, chave: string) {
    const valor = consulta.payload?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private textoConteudo(template: TemplateMensagemOrm, chave: string) {
    const valor = template.conteudo?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private objeto(valor: unknown): Record<string, unknown> {
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
  }

  private async obterPreferenciasPaciente(tenantId: string, pacienteId: string): Promise<PreferenciasComunicacaoPaciente> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, id: pacienteId } });
      if (!paciente?.contatoCriptografado) return this.preferenciasPadrao();

      const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
      try {
        const parseado = JSON.parse(contato) as {
          email?: unknown;
          whatsapp?: unknown;
          preferencias?: {
            email?: unknown;
            whatsapp?: unknown;
            canalPreferido?: unknown;
            horarioPermitido?: unknown;
          };
        };
        return {
          email: typeof parseado.preferencias?.email === 'boolean' ? parseado.preferencias.email : true,
          whatsapp: typeof parseado.preferencias?.whatsapp === 'boolean' ? parseado.preferencias.whatsapp : true,
          canalPreferido: this.normalizarCanalPreferido(parseado.preferencias?.canalPreferido),
          horarioPermitido: this.normalizarHorarioPermitido(parseado.preferencias?.horarioPermitido),
          contatos: {
            email: typeof parseado.email === 'string' ? this.normalizarEmail(parseado.email) : undefined,
            whatsapp: typeof parseado.whatsapp === 'string' ? this.normalizarWhatsapp(parseado.whatsapp) : undefined
          }
        };
      } catch {
        return contato.includes('@')
          ? { ...this.preferenciasPadrao(), contatos: { email: this.normalizarEmail(contato) } }
          : { ...this.preferenciasPadrao(), contatos: { whatsapp: this.normalizarWhatsapp(contato) } };
      }
    });
  }

  private preferenciasPadrao(): PreferenciasComunicacaoPaciente {
    return {
      ...PREFERENCIAS_COMUNICACAO_PADRAO,
      horarioPermitido: { ...PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido },
      contatos: {}
    };
  }

  private normalizarCanalPreferido(valor: unknown): CanalPreferidoPaciente {
    return valor === 'email' || valor === 'whatsapp' || valor === 'qualquer' ? valor : 'qualquer';
  }

  private normalizarHorarioPermitido(valor: unknown): PreferenciasComunicacaoPaciente['horarioPermitido'] {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return { ...PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido };
    const horario = valor as Record<string, unknown>;
    return {
      inicio:
        typeof horario.inicio === 'string' && this.horarioValido(horario.inicio)
          ? horario.inicio
          : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.inicio,
      fim:
        typeof horario.fim === 'string' && this.horarioValido(horario.fim)
          ? horario.fim
          : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.fim,
      timezone:
        typeof horario.timezone === 'string' && horario.timezone.trim()
          ? horario.timezone.trim().slice(0, 80)
          : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.timezone
    };
  }

  private dentroHorarioPermitido(agora: Date, horario: PreferenciasComunicacaoPaciente['horarioPermitido']): boolean {
    const atual = this.minutosDoDia(this.formatarHoraPreferencia(agora, horario.timezone));
    const inicio = this.minutosDoDia(horario.inicio);
    const fim = this.minutosDoDia(horario.fim);
    if (inicio <= fim) return atual >= inicio && atual <= fim;
    return atual >= inicio || atual <= fim;
  }

  private formatarHoraPreferencia(data: Date, timezone: string) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(data);
    } catch {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(data);
    }
  }

  private minutosDoDia(horario: string): number {
    const [horas, minutos] = horario.split(':').map((parte) => Number(parte));
    return horas * 60 + minutos;
  }

  private normalizarEmail(email?: string): string | undefined {
    const normalizado = email?.trim().toLowerCase();
    return normalizado || undefined;
  }

  private normalizarWhatsapp(whatsapp?: string): string | undefined {
    const normalizado = whatsapp?.replace(/\D/g, '');
    return normalizado || undefined;
  }

  private horarioValido(valor: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
  }

  private formatarData(data: Date, timezone = 'America/Sao_Paulo') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data);
  }

  private formatarHora(data: Date, timezone = 'America/Sao_Paulo') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit'
    }).format(data);
  }
}
