import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { aceitaAlgumCanal, canalPermitido, dentroHorarioPermitido, interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao } from '../../comunicacoes/dominio/preferencias-comunicacao';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { EVENTO_REAGENDAMENTO_APOS_FALTA, lerReagendamentoAposFalta, prazoReagendamentoVencido, ReagendamentoAposFalta } from '../dominio/reagendamento-apos-falta';

@Injectable()
export class ProcessadorReagendamentoAposFalta {
  private readonly logger = new Logger(ProcessadorReagendamentoAposFalta.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  @Cron('*/1 * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Reagendamento apos falta', async (tenantId) => {
      await this.processarTenant(tenantId);
    }, { timeoutMs: 25_000 });
  }

  async processarTenant(tenantId: string, agora = new Date()): Promise<void> {
    const ids = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).createQueryBuilder('consulta')
        .select(['consulta.id'])
        .where('consulta.tenant_id = :tenantId and consulta.status = :status', { tenantId, status: 'falta' })
        .andWhere("consulta.payload -> 'reagendamentoAposFalta' ->> 'estado' = 'aprovado'")
        .andWhere("(consulta.payload -> 'reagendamentoAposFalta' ->> 'proximaTentativaEm' is null or consulta.payload -> 'reagendamentoAposFalta' ->> 'proximaTentativaEm' <= :agoraIso)", { agoraIso: agora.toISOString() })
        .orderBy('consulta.atualizado_em', 'ASC').take(30).getMany();
      return consultas.map((consulta) => consulta.id);
    });
    for (const id of ids) {
      try {
        await this.processarConsulta(tenantId, id, agora);
      } catch {
        try {
          await this.executorTenant.executar(tenantId, async (gerenciador) => {
            const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
            const atual = await repositorio.findOne({ where: { id, tenantId, status: 'falta' }, lock: { mode: 'pessimistic_write' } });
            const decisao = lerReagendamentoAposFalta(atual?.payload);
            if (atual && decisao?.estado === 'aprovado') {
              await repositorio.update({ id, tenantId }, {
                payload: { ...atual.payload, reagendamentoAposFalta: { ...decisao, motivo: 'falha_tecnica', proximaTentativaEm: new Date(agora.getTime() + 5 * 60000).toISOString() } }
              });
            }
          });
        } catch { /* A proxima rodada tenta novamente; nao registrar identificadores. */ }
        this.logger.warn('Falha tecnica ao processar contato de reagendamento apos falta.');
      }
    }
  }

  private async processarConsulta(tenantId: string, consultaId: string, agora: Date): Promise<void> {
    const contexto = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({ where: { id: consultaId, tenantId, status: 'falta' } });
      const estado = lerReagendamentoAposFalta(consulta?.payload);
      if (!consulta || estado?.estado !== 'aprovado') return undefined;
      const atualizar = async (novo: ReagendamentoAposFalta) => {
        await repositorio.update({ id: consultaId, tenantId, status: 'falta' }, {
          payload: { ...consulta.payload, reagendamentoAposFalta: novo }
        });
      };
      if (prazoReagendamentoVencido(consulta.fimEm, agora)) {
        await atualizar({ ...estado, estado: 'expirado' });
        return undefined;
      }
      if (consulta.fimEm > agora) return undefined;
      const retorno = await repositorio.findOne({
        where: { tenantId, pacienteId: consulta.pacienteId, status: In(['agendada', 'reagendada']), inicioEm: MoreThan(agora) }
      });
      if (retorno) {
        await atualizar({ ...estado, estado: 'suprimido', motivo: 'consulta_futura' });
        return undefined;
      }
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: consulta.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente || ['inativo', 'pausado', 'encerrado', 'fechado'].includes(paciente.statusAdesao)) {
        await atualizar({ ...estado, estado: 'suprimido', motivo: 'paciente_indisponivel' });
        return undefined;
      }
      let preferencias;
      try {
        preferencias = paciente.contatoCriptografado
          ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
          : preferenciasComunicacaoPadrao();
      } catch {
        await atualizar({ ...estado, estado: 'suprimido', motivo: 'contato_ilegivel' });
        return undefined;
      }
      if (!aceitaAlgumCanal(preferencias)) {
        await atualizar({ ...estado, estado: 'suprimido', motivo: 'sem_consentimento' });
        return undefined;
      }
      if (!dentroHorarioPermitido(agora, preferencias.horarioPermitido)) {
        await atualizar({ ...estado, proximaTentativaEm: new Date(agora.getTime() + 15 * 60000).toISOString() });
        return undefined;
      }
      return { consulta, estado, preferencias };
    });
    if (!contexto) return;

    const { consulta, estado, preferencias } = contexto;
    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId), this.comunicacoes.listarTemplates(tenantId)
    ]);
    const tipos: Array<'email' | 'whatsapp'> = preferencias.canalPreferido === 'qualquer'
      ? ['email', 'whatsapp'] : [preferencias.canalPreferido];
    const escolhido = tipos.map((tipo) => ({
      canal: canais.find((canal) => canal.tipo === tipo && canal.ativo && canalPermitido(preferencias, tipo)),
      template: templates.find((template) => template.canal === tipo && template.conteudo?.evento === EVENTO_REAGENDAMENTO_APOS_FALTA && (tipo === 'email' || template.aprovado))
    })).find((par) => par.canal && par.template);
    if (!escolhido?.canal || !escolhido.template) {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
        const atual = await repositorio.findOne({ where: { id: consultaId, tenantId, status: 'falta' }, lock: { mode: 'pessimistic_write' } });
        const decisao = lerReagendamentoAposFalta(atual?.payload);
        if (atual && decisao?.estado === 'aprovado') {
          await repositorio.update({ id: consultaId, tenantId }, {
            payload: { ...atual.payload, reagendamentoAposFalta: { ...decisao, motivo: 'configuracao_indisponivel', proximaTentativaEm: new Date(agora.getTime() + 60 * 60000).toISOString() } }
          });
        }
      });
      return;
    }
    if (prazoReagendamentoVencido(consulta.fimEm, new Date())) return;
    const tipo = escolhido.canal.tipo as 'email' | 'whatsapp';
    const texto = 'Podemos ajudar voce a marcar um novo horario. Responda por este canal se desejar.';
    const parametros = Array.isArray(escolhido.template.conteudo?.parametros)
      ? escolhido.template.conteudo.parametros.filter((valor): valor is string => typeof valor === 'string') : [];
    const valores: Record<string, string> = { textoMensagem: texto, nomePaciente: '', dataConsulta: '', horaConsulta: '', profissionalNome: '' };
    const mensagem = await this.comunicacoes.dispararMensagemSistema(tenantId, {
      pacienteId: consulta.pacienteId,
      canalId: escolhido.canal.id,
      templateId: escolhido.template.id,
      chaveIdempotencia: `reagendamento-apos-falta:${tenantId}:${consulta.id}`,
      payload: {
        evento: EVENTO_REAGENDAMENTO_APOS_FALTA,
        consultaId: consulta.id,
        destino: preferencias.contatos[tipo],
        texto,
        assunto: 'Novo horario - OctaClin',
        ...(tipo === 'whatsapp' ? {
          idioma: escolhido.template.conteudo?.idioma ?? 'pt_BR',
          components: [{ type: 'body', parameters: parametros.map((parametro) => ({ type: 'text', text: valores[parametro] ?? '' })) }]
        } : {})
      }
    });
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({ where: { id: consultaId, tenantId, status: 'falta' }, lock: { mode: 'pessimistic_write' } });
      const decisaoAtual = lerReagendamentoAposFalta(atual?.payload);
      if (atual && decisaoAtual?.estado === 'aprovado') {
        await repositorio.update({ id: consultaId, tenantId }, {
          payload: { ...atual.payload, reagendamentoAposFalta: { ...decisaoAtual, estado: 'enfileirado', mensagemId: mensagem.id, motivo: undefined, proximaTentativaEm: undefined } }
        });
      }
    });
  }
}
