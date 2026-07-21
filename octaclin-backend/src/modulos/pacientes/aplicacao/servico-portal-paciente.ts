import { createHmac } from 'crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export interface ResumoPortalPaciente {
  paciente: {
    id: string;
    nome: string;
    statusAdesao: string;
    scoreRisco: string;
    ultimoCheckinEm?: Date;
  };
  resumo: {
    consultasProximas: number;
    formulariosPendentes: number;
    mensagensRecentes: number;
  };
  consultasProximas: {
    id: string;
    titulo: string;
    inicioEm: Date;
    fimEm: Date;
    status: string;
    local?: string;
    googleEventHtmlLink?: string;
  }[];
  formulariosPendentes: {
    envioId: string;
    questionarioId: string;
    titulo: string;
    status: string;
    expiraEm?: Date;
    linkFormulario: string;
  }[];
  mensagensRecentes: {
    id: string;
    titulo: string;
    texto: string;
    status: string;
    criadoEm: Date;
    enviadoEm?: Date;
  }[];
}

@Injectable()
export class ServicoPortalPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obterResumoPortal(tenantId: string, usuarioId: string): Promise<ResumoPortalPaciente> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      const consultas = (
        await gerenciador.getRepository(AgendaConsultaOrm).find({
          where: { tenantId, pacienteId: paciente.id, status: 'agendada' },
          order: { inicioEm: 'ASC' },
          take: 20
        })
      )
        .filter((consulta) => consulta.inicioEm >= new Date())
        .slice(0, 5);

      const envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
        where: { tenantId, pacienteId: paciente.id, status: In(['pendente', 'enviado']) },
        order: { expiraEm: 'ASC' },
        take: 20
      });
      const questionarios = envios.length
        ? await gerenciador.getRepository(QuestionarioOrm).find({
            where: { tenantId, id: In(envios.map((envio) => envio.questionarioId)) }
          })
        : [];
      const questionariosPorId = new Map(questionarios.map((questionario) => [questionario.id, questionario]));

      const mensagens = await gerenciador.getRepository(MensagemNotificacaoOrm).find({
        where: { tenantId, pacienteId: paciente.id },
        order: { criadoEm: 'DESC' },
        take: 5
      });

      const consultasProximas = consultas.map((consulta) => ({
        id: consulta.id,
        titulo: consulta.titulo,
        inicioEm: consulta.inicioEm,
        fimEm: consulta.fimEm,
        status: consulta.status,
        local: consulta.local,
        googleEventHtmlLink: consulta.googleEventHtmlLink
      }));
      const formulariosPendentes = envios.map((envio) => ({
        envioId: envio.id,
        questionarioId: envio.questionarioId,
        titulo: questionariosPorId.get(envio.questionarioId)?.titulo ?? 'Formulario',
        status: envio.status,
        expiraEm: envio.expiraEm,
        linkFormulario: this.montarLinkFormulario(tenantId, envio.id)
      }));
      const mensagensRecentes = mensagens.map((mensagem) => ({
        id: mensagem.id,
        titulo: this.textoPayload(mensagem.payload, 'assunto') ?? 'Mensagem OctaClin',
        texto: this.textoPayload(mensagem.payload, 'texto') ?? this.textoPayload(mensagem.payload, 'observacao') ?? '',
        status: mensagem.status,
        criadoEm: mensagem.criadoEm,
        enviadoEm: mensagem.enviadoEm
      }));

      return {
        paciente: {
          id: paciente.id,
          nome: this.criptografia.descriptografar(paciente.nomeCriptografado),
          statusAdesao: paciente.statusAdesao,
          scoreRisco: paciente.scoreRisco,
          ultimoCheckinEm: paciente.ultimoCheckinEm
        },
        resumo: {
          consultasProximas: consultasProximas.length,
          formulariosPendentes: formulariosPendentes.length,
          mensagensRecentes: mensagensRecentes.length
        },
        consultasProximas,
        formulariosPendentes,
        mensagensRecentes
      };
    });
  }

  private textoPayload(payload: Record<string, unknown>, chave: string): string | undefined {
    const valor = payload[chave];
    return typeof valor === 'string' && valor.trim() ? valor : undefined;
  }

  private montarLinkFormulario(tenantId: string, envioId: string): string {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const assinatura = createHmac('sha256', process.env.FORMULARIO_PUBLICO_SEGREDO ?? 'dev-form-secret')
      .update(`${tenantId}.${envioId}`)
      .digest('base64url');
    return `${baseUrl}/formularios/${tenantId}.${envioId}.${assinatura}`;
  }
}
