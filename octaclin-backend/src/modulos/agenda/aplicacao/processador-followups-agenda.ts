import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Brackets, DataSource, In, LessThan, MoreThan, Not } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { canalPermitido, dentroHorarioPermitido, interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao, PreferenciasComunicacaoPaciente } from '../../comunicacoes/dominio/preferencias-comunicacao';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { OcorrenciaFollowupAgendaOrm } from '../infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../infraestrutura/politica-followup-agenda.orm';
import { ServicoFollowupsAgenda } from './servico-followups-agenda';
import { proximaJanelaPermitida } from '../dominio/calendario-followups';
import { normalizarLinkTeleconsulta, normalizarModalidadeConsulta } from '../dominio/teleconsulta';

const EVENTO_FOLLOWUP = 'agenda.consulta.followup';

@Injectable()
export class ProcessadorFollowupsAgenda {
  private readonly logger = new Logger(ProcessadorFollowupsAgenda.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly followups: ServicoFollowupsAgenda,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  @Cron('*/1 * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Follow-ups de agenda', async (tenantId) => {
      await this.followups.reconciliarPendentes(tenantId);
      await this.processarTenant(tenantId);
    }, { timeoutMs: 25_000 });
  }

  @Cron('*/10 * * * *')
  async reconciliarEntregasIncertas(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Entregas incertas de follow-up', async (tenantId) => {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const repo = gerenciador.getRepository(MensagemNotificacaoOrm);
        const mensagens = await repo.createQueryBuilder('mensagem')
          .where('mensagem.tenant_id = :tenantId and mensagem.status = :status', { tenantId, status: 'processando' })
          .andWhere("mensagem.payload ->> 'evento' = :evento", { evento: EVENTO_FOLLOWUP })
          .andWhere('mensagem.tentativa_externa_em < :limite', { limite: new Date(Date.now() - 60 * 60000) })
          .orderBy('mensagem.tentativa_externa_em', 'ASC').take(100)
          .setLock('pessimistic_write').setOnLocked('skip_locked').getMany();
        for (const mensagem of mensagens) {
          await repo.update({ id: mensagem.id, tenantId, status: 'processando' }, { status: 'falhou', erro: 'Entrega incerta; requer reconciliacao manual.' });
          await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).createQueryBuilder().update()
            .set({ status: 'falhou', motivo: 'entrega_incerta' })
            .where('tenant_id = :tenantId and chave_idempotencia = :chave and status in (:...status)', { tenantId, chave: mensagem.chaveIdempotencia, status: ['processando', 'enfileirada'] })
            .execute();
        }
      });
    }, { timeoutMs: 25_000 });
  }

  async processarTenant(tenantId: string, agora = new Date()): Promise<void> {
    const ids = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repo = gerenciador.getRepository(OcorrenciaFollowupAgendaOrm);
      const encontrados = await repo.createQueryBuilder('ocorrencia')
        .where('ocorrencia.tenant_id = :tenantId and ocorrencia.disponivel_em <= :agora', { tenantId, agora })
        .andWhere(new Brackets((consulta) => consulta.where("ocorrencia.status = 'pendente'").orWhere("ocorrencia.status = 'processando' and ocorrencia.reivindicado_em < :limite", { limite: new Date(agora.getTime() - 5 * 60000) })))
        .orderBy('ocorrencia.disponivel_em', 'ASC').take(30)
        .setLock('pessimistic_write').setOnLocked('skip_locked').getMany();
      for (const item of encontrados) await repo.update({ id: item.id, tenantId }, { status: 'processando', reivindicadoEm: agora });
      return encontrados.map((item) => item.id);
    });
    for (const id of ids) {
      try {
        await this.processarOcorrencia(tenantId, id, agora);
      } catch {
        await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repo = gerenciador.getRepository(OcorrenciaFollowupAgendaOrm);
          const item = await repo.findOne({ where: { tenantId, id, status: 'processando' } });
          if (item) {
            const tentativas = (item.tentativas ?? 0) + 1;
            await repo.update({ tenantId, id }, {
              status: tentativas >= 5 ? 'falhou' : 'pendente',
              tentativas, motivo: 'falha_tecnica', disponivelEm: new Date(agora.getTime() + 5 * 60000)
            });
          }
        });
        this.logger.warn(`Falha tecnica em follow-up de agenda; tentativa registrada no tenant.`);
      }
    }
  }

  private async processarOcorrencia(tenantId: string, id: string, agora: Date): Promise<void> {
    const contexto = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repo = gerenciador.getRepository(OcorrenciaFollowupAgendaOrm);
      const item = await repo.findOne({ where: { id, tenantId, status: 'processando' } });
      if (!item) return undefined;
      const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({ where: { id: item.consultaId, tenantId } });
      const suprimir = async (motivo: string) => {
        await repo.update({ id, tenantId }, { status: 'suprimida', motivo });
        return undefined;
      };
      if (!consulta || !['agendada', 'reagendada'].includes(consulta.status) || consulta.inicioEm <= agora || consulta.inicioEm.getTime() !== item.inicioConsultaEm.getTime()) return suprimir('consulta_alterada');
      if (item.condicao === 'somente_se_nao_confirmada' && (consulta.notificacoes?.confirmacaoPaciente as { status?: string } | undefined)?.status === 'confirmada') return suprimir('consulta_confirmada');
      const politica = await gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { id: consulta.followupPoliticaId, tenantId } });
      if (!politica?.ativo || politica.id !== item.politicaId || politica.versao !== item.politicaVersao) return suprimir('politica_alterada');
      const avisoImediato = consulta.notificacoes?.email as { status?: string } | undefined;
      const avisoWhatsapp = consulta.notificacoes?.whatsapp as { status?: string } | undefined;
      if (Math.abs(item.envioEm.getTime() - consulta.criadoEm.getTime()) < 30 * 60000 && (avisoImediato?.status === 'pendente' || avisoWhatsapp?.status === 'pendente')) return suprimir('aviso_imediato_proximo');
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: consulta.pacienteId, tenantId } });
      if (!paciente) return suprimir('paciente_indisponivel');
      let preferencias: PreferenciasComunicacaoPaciente;
      try {
        preferencias = paciente.contatoCriptografado ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado)) : preferenciasComunicacaoPadrao();
      } catch {
        return suprimir('contato_ilegivel');
      }
      if (!dentroHorarioPermitido(agora, preferencias.horarioPermitido)) {
        const proximo = proximaJanelaPermitida(agora, consulta.inicioEm, preferencias.horarioPermitido);
        if (!proximo) return suprimir('janela_sem_tempo');
        await repo.update({ id, tenantId }, { status: 'pendente', disponivelEm: proximo, motivo: 'janela_adiada' });
        return undefined;
      }
      const proximas = await repo.find({ where: {
        tenantId, consultaId: consulta.id, id: Not(item.id), envioEm: LessThan(item.envioEm),
        reivindicadoEm: MoreThan(new Date(agora.getTime() - 30 * 60000)),
        status: In(['processando', 'enfileirada', 'enviada'])
      }, order: { reivindicadoEm: 'DESC' }, take: 1 });
      const anterior = proximas[0];
      if (anterior?.reivindicadoEm) {
        const proximo = new Date(anterior.reivindicadoEm.getTime() + 30 * 60000);
        if (proximo >= consulta.inicioEm) return suprimir('intervalo_minimo');
        await repo.update({ id, tenantId }, { status: 'pendente', disponivelEm: proximo, motivo: 'intervalo_adiado' });
        return undefined;
      }
      return { item, consulta, preferencias };
    });
    if (!contexto) return;
    const { item, consulta, preferencias } = contexto;
    const [canais, templates] = await Promise.all([this.comunicacoes.listarCanais(tenantId), this.comunicacoes.listarTemplates(tenantId)]);
    const tipos = preferencias.canalPreferido === 'whatsapp' ? ['whatsapp'] : preferencias.canalPreferido === 'email' ? ['email'] : ['email', 'whatsapp'];
    const pares = tipos.map((tipo) => {
      const canal = canais.find((c) => c.tipo === tipo && c.ativo && (c.tipo === 'email' || c.tipo === 'whatsapp') && canalPermitido(preferencias, c.tipo));
      const template = canal && (templates.find((t) => t.canal === canal.tipo && (canal.tipo === 'email' || t.aprovado) && t.conteudo?.evento === 'agenda.consulta.lembrete') ?? templates.find((t) => t.canal === canal.tipo && (canal.tipo === 'email' || t.aprovado) && !t.conteudo?.evento));
      return { canal, template };
    });
    const escolhido = pares.find((par) => par.canal && par.template);
    const canal = escolhido?.canal;
    const template = escolhido?.template;
    if (!canal || !template) {
      await this.executorTenant.executar(tenantId, (gerenciador) => gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id, tenantId }, { status: 'suprimida', motivo: !canal ? 'canal_indisponivel' : 'template_indisponivel' }));
      return;
    }
    const tipo = canal.tipo as 'email' | 'whatsapp';
    const nomePaciente = typeof consulta.payload?.pacienteNome === 'string' ? consulta.payload.pacienteNome : '';
    const dataConsulta = new Intl.DateTimeFormat('pt-BR', { timeZone: consulta.timezone, dateStyle: 'short' }).format(consulta.inicioEm);
    const horaConsulta = new Intl.DateTimeFormat('pt-BR', { timeZone: consulta.timezone, timeStyle: 'short' }).format(consulta.inicioEm);
    const linkTeleconsulta = normalizarModalidadeConsulta(consulta.modalidade) === 'online' ? normalizarLinkTeleconsulta(consulta.linkTeleconsulta) : undefined;
    const texto = `Lembrete: sua consulta esta agendada para ${dataConsulta} as ${horaConsulta}.${linkTeleconsulta ? ` Acesse a sala no horario: ${linkTeleconsulta}` : ''}`;
    const valores: Record<string, string> = { nomePaciente, dataConsulta, horaConsulta, textoMensagem: texto, profissionalNome: typeof consulta.payload?.profissionalNome === 'string' ? consulta.payload.profissionalNome : '', linkTeleconsulta: linkTeleconsulta ?? '' };
    const parametros = Array.isArray(template.conteudo?.parametros) ? template.conteudo.parametros.filter((valor): valor is string => typeof valor === 'string') : [];
    const payload: Record<string, unknown> = {
      destino: preferencias.contatos[tipo], evento: EVENTO_FOLLOWUP,
      consultaId: consulta.id, consultaInicioEm: consulta.inicioEm.toISOString(), followupOcorrenciaId: item.id,
      condicao: item.condicao, nomePaciente, dataConsulta, horaConsulta,
      modalidade: consulta.modalidade, ...(linkTeleconsulta ? { linkTeleconsulta } : {}),
      assunto: 'Lembrete de consulta - OctaClin', texto, observacao: texto,
      ...(tipo === 'whatsapp' ? { idioma: template.conteudo?.idioma ?? 'pt_BR', components: [{ type: 'body', parameters: parametros.map((parametro) => ({ type: 'text', text: valores[parametro] ?? '' })) }] } : {})
    };
    const mensagem = await this.comunicacoes.dispararMensagemSistema(tenantId, {
      pacienteId: consulta.pacienteId, canalId: canal.id, templateId: template.id,
      chaveIdempotencia: item.chaveIdempotencia, payload
    });
    await this.executorTenant.executar(tenantId, (gerenciador) => gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id, tenantId, status: 'processando' }, { status: mensagem.status === 'enviado' ? 'enviada' : 'enfileirada', mensagemId: mensagem.id }));
  }
}
