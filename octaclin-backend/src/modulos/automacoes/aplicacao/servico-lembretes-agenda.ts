import { Injectable } from '@nestjs/common';
import { Between } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { normalizarLinkTeleconsulta, normalizarModalidadeConsulta } from '../../agenda/dominio/teleconsulta';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import {
  PreferenciasComunicacaoPaciente,
  TipoCanalDireto,
  dentroHorarioPermitido,
  interpretarPreferenciasComunicacao,
  preferenciasComunicacaoPadrao
} from '../../comunicacoes/dominio/preferencias-comunicacao';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';

const EVENTO_LEMBRETE_CONSULTA = 'agenda.consulta.lembrete';
const JANELA_LEMBRETE_INICIO_HORAS = 23;
const JANELA_LEMBRETE_FIM_HORAS = 25;

type TipoCanalLembrete = TipoCanalDireto;

type ResultadoCanalLembrete =
  | { status: 'pendente' | 'enviado'; mensagemId: string }
  | { status: 'ignorado'; motivo: string }
  | { status: 'falhou'; erro: string };

interface ResultadoProcessamentoLembretes {
  consultasAvaliadas: number;
  lembretesProcessados: number;
  lembretesIgnorados: number;
}

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

      if (!dentroHorarioPermitido(agora, preferencias.horarioPermitido)) {
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
      const mensagem = await this.comunicacoes.dispararMensagemSistema(tenantId, {
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
    const modalidade = normalizarModalidadeConsulta(consulta.modalidade);
    const linkTeleconsulta = modalidade === 'online' ? normalizarLinkTeleconsulta(consulta.linkTeleconsulta) : undefined;
    const online = linkTeleconsulta
      ? `\n\nSua consulta e online. Entre por este link no horario: ${linkTeleconsulta}`
      : '';
    const texto = `Ola ${nomePaciente}, tudo bem?\n\nPassando para lembrar que sua consulta esta agendada para ${dataConsulta} as ${horaConsulta}.${online}\n\nQualquer coisa estou a disposicao!`;
    const payload: Record<string, unknown> = {
      destino,
      evento: EVENTO_LEMBRETE_CONSULTA,
      consultaId: consulta.id,
      consultaInicioEm: consulta.inicioEm.toISOString(),
      consultaFimEm: consulta.fimEm.toISOString(),
      modalidade,
      ...(linkTeleconsulta ? { linkTeleconsulta } : {}),
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
      linkTeleconsulta,
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
      if (!paciente?.contatoCriptografado) return preferenciasComunicacaoPadrao();
      return interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado));
    });
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
