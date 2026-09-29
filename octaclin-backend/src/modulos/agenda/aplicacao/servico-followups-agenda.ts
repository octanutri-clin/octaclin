import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { calcularEtapas, EtapaFollowup, MAX_FOLLOWUPS_CONSULTA, PADRAO_FOLLOWUPS, proximaJanelaPermitida, selecionarSemColisao, validarEtapas } from '../dominio/calendario-followups';
import { dentroHorarioPermitido, interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao } from '../../comunicacoes/dominio/preferencias-comunicacao';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { OcorrenciaFollowupAgendaOrm } from '../infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../infraestrutura/politica-followup-agenda.orm';

export interface SalvarPoliticaFollowup {
  ativo: boolean;
  etapas: EtapaFollowup[];
}

@Injectable()
export class ServicoFollowupsAgenda {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis) {}

  async obterPadrao(tenantId: string) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const politica = await gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { tenantId, consultaId: IsNull() } });
      const consultasHerdando = await gerenciador.getRepository(AgendaConsultaOrm).createQueryBuilder('consulta')
        .leftJoin(PoliticaFollowupAgendaOrm, 'excecao', 'excecao.tenant_id = consulta.tenant_id and excecao.consulta_id = consulta.id')
        .where('consulta.tenant_id = :tenantId and consulta.status in (:...status) and consulta.inicio_em > now() and excecao.id is null', { tenantId, status: ['agendada', 'reagendada'] })
        .getCount();
      return politica ? { ...this.respostaPolitica(politica), consultasHerdando } : { ativo: false, etapas: PADRAO_FOLLOWUPS, versao: 0, configurado: false, consultasHerdando };
    });
  }

  async salvarPadrao(tenantId: string, dados: SalvarPoliticaFollowup) {
    const etapas = this.validarPolitica(dados);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`followup-padrao:${tenantId}`]);
      const repo = gerenciador.getRepository(PoliticaFollowupAgendaOrm);
      const atual = await repo.findOne({ where: { tenantId, consultaId: IsNull() } });
      const politica = await repo.save(repo.create({
        ...(atual ?? {}), tenantId, consultaId: null, ativo: dados.ativo, etapas,
        versao: (atual?.versao ?? 0) + 1
      }));
      return this.respostaPolitica(politica);
    });
  }

  async obterConsulta(tenantId: string, consultaId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const consulta = await this.consultaAutorizada(gerenciador, tenantId, consultaId, usuario);
      const [padrao, excecao, ocorrencias, comprometidas] = await Promise.all([
        gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { tenantId, consultaId: IsNull() } }),
        gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { tenantId, consultaId } }),
        gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).find({ where: { tenantId, consultaId }, order: { envioEm: 'ASC' }, take: 300 }),
        gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).count({ where: { tenantId, consultaId, mensagemId: Not(IsNull()) } })
      ]);
      const politica = excecao ?? padrao;
      const etapas = politica?.etapas ?? PADRAO_FOLLOWUPS;
      const lembreteLegado = consulta.notificacoes?.lembrete24h as { status?: string; email?: { status?: string }; whatsapp?: { status?: string } } | undefined;
      const enviosLegados = lembreteLegado?.status === 'processado' ? Math.max(1, [lembreteLegado.email, lembreteLegado.whatsapp].filter((canal) => canal?.status === 'pendente' || canal?.status === 'enviado').length) : 0;
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: consulta.pacienteId, tenantId } });
      let horario = preferenciasComunicacaoPadrao().horarioPermitido;
      let contatoLegivel = true;
      try {
        if (paciente?.contatoCriptografado) horario = interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado)).horarioPermitido;
      } catch { contatoLegivel = false; }
      const brutas = politica?.ativo ? calcularEtapas(consulta.inicioEm, consulta.timezone, etapas, false) : [];
      const semColisao = new Set(selecionarSemColisao(brutas).map((item) => item.indice));
      const futuras = brutas.map(({ indice, envioEm, etapa }) => {
        const elegivel = envioEm > new Date();
        const efetivoEm = contatoLegivel && elegivel && semColisao.has(indice) ? (dentroHorarioPermitido(envioEm, horario) ? envioEm : proximaJanelaPermitida(envioEm, consulta.inicioEm, horario)) : undefined;
        return { indice, envioEm, efetivoEm, condicao: etapa.condicao, elegivel: Boolean(efetivoEm), motivo: !semColisao.has(indice) ? 'intervalo_colisao' : !contatoLegivel ? 'contato_ilegivel' : !elegivel ? 'horario_passado' : !efetivoEm ? 'janela_sem_tempo' : undefined };
      });
      return {
        consultaId: consulta.id,
        inicioEm: consulta.inicioEm,
        timezone: consulta.timezone,
        origem: excecao ? 'personalizado' : 'padrao',
        configurado: Boolean(padrao),
        ativo: politica?.ativo ?? false,
        etapas,
        versao: politica?.versao ?? 0,
        quantidade: etapas.length,
        saldo: Math.max(0, MAX_FOLLOWUPS_CONSULTA - comprometidas - enviosLegados),
        futuras,
        historico: ocorrencias.map((item) => ({ id: item.id, envioEm: item.envioEm, status: item.status, motivo: item.motivo, mensagemId: item.mensagemId }))
      };
    });
  }

  async salvarExcecao(tenantId: string, consultaId: string, usuario: UsuarioAutenticado, dados: SalvarPoliticaFollowup) {
    const etapas = this.validarPolitica(dados);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const consulta = await this.consultaAutorizada(gerenciador, tenantId, consultaId, usuario, true);
      if (!['agendada', 'reagendada'].includes(consulta.status) || consulta.inicioEm <= new Date()) throw new BadRequestException('Consulta encerrada ou iniciada.');
      const repo = gerenciador.getRepository(PoliticaFollowupAgendaOrm);
      const padrao = await repo.findOne({ where: { tenantId, consultaId: IsNull() } });
      if (!padrao) throw new BadRequestException('Ative primeiro o calendario padrao da clinica.');
      calcularEtapas(consulta.inicioEm, consulta.timezone, etapas);
      const atual = await repo.findOne({ where: { tenantId, consultaId } });
      const politica = await repo.save(repo.create({ ...(atual ?? {}), tenantId, consultaId, ativo: dados.ativo, etapas, versao: (atual?.versao ?? 0) + 1 }));
      await this.reconciliarConsultaNaTransacao(gerenciador, tenantId, consulta);
      return this.respostaPolitica(politica);
    });
  }

  async removerExcecao(tenantId: string, consultaId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const consulta = await this.consultaAutorizada(gerenciador, tenantId, consultaId, usuario, true);
      await gerenciador.getRepository(PoliticaFollowupAgendaOrm).delete({ tenantId, consultaId });
      await this.reconciliarConsultaNaTransacao(gerenciador, tenantId, consulta);
      return { consultaId, origem: 'padrao' as const };
    });
  }

  async reconciliarConsultaNaTransacao(gerenciador: EntityManager, tenantId: string, consulta: AgendaConsultaOrm, agora = new Date()): Promise<void> {
    const repoPolitica = gerenciador.getRepository(PoliticaFollowupAgendaOrm);
    const padrao = await repoPolitica.findOne({ where: { tenantId, consultaId: IsNull() } });
    if (!padrao) return; // Antes do cutover, somente o motor legado opera.
    const excecao = await repoPolitica.findOne({ where: { tenantId, consultaId: consulta.id } });
    const politica = excecao ?? padrao;
    const repo = gerenciador.getRepository(OcorrenciaFollowupAgendaOrm);
    const existentes = await repo.find({ where: { tenantId, consultaId: consulta.id }, order: { criadoEm: 'ASC' } });
    const ativos = ['agendada', 'reagendada'].includes(consulta.status) && consulta.inicioEm > agora && politica.ativo;
    const calculadas = ativos ? selecionarSemColisao(calcularEtapas(consulta.inicioEm, consulta.timezone, politica.etapas, false)) : [];
    const marcadorLegado = consulta.notificacoes?.lembrete24h as { status?: string; email?: { status?: string }; whatsapp?: { status?: string } } | undefined;
    const legacy24h = marcadorLegado?.status === 'processado';
    const enviosLegados = legacy24h ? Math.max(1, [marcadorLegado?.email, marcadorLegado?.whatsapp].filter((canal) => canal?.status === 'pendente' || canal?.status === 'enviado').length) : 0;
    const jaComprometidas = existentes.filter((item) => Boolean(item.mensagemId)).length + enviosLegados;
    const saldo = Math.max(0, MAX_FOLLOWUPS_CONSULTA - jaComprometidas);
    const candidatas = calculadas.filter(({ envioEm, etapa }) => {
      if (envioEm <= agora) return false;
      if (legacy24h && etapa.unidade === 'hora' && etapa.valor === 24) return false;
      if (existentes.some((item) => item.mensagemId && item.inicioConsultaEm.getTime() === consulta.inicioEm.getTime() && item.envioEm.getTime() === envioEm.getTime())) return false;
      return true;
    });
    const selecionadas = saldo > 0 ? candidatas.slice(-saldo) : [];
    const chaves = new Set(selecionadas.map(({ envioEm }) => `${consulta.inicioEm.getTime()}:${envioEm.getTime()}`));
    for (const existente of existentes) {
      if (existente.status !== 'pendente') continue;
      const chave = `${existente.inicioConsultaEm.getTime()}:${existente.envioEm.getTime()}`;
      if (!chaves.has(chave)) await repo.update({ id: existente.id, tenantId }, { status: 'suprimida', motivo: 'calendario_alterado' });
    }
    for (const { indice, envioEm, etapa } of selecionadas) {
      const existente = existentes.find((item) => item.inicioConsultaEm.getTime() === consulta.inicioEm.getTime() && item.envioEm.getTime() === envioEm.getTime());
      if (existente) {
        if (existente.status === 'pendente') await repo.update({ id: existente.id, tenantId }, { condicao: etapa.condicao, politicaId: politica.id, politicaVersao: politica.versao });
        continue;
      }
      await repo.createQueryBuilder().insert().values({
        tenantId, consultaId: consulta.id, politicaId: politica.id, inicioConsultaEm: consulta.inicioEm, indice, condicao: etapa.condicao,
        envioEm, disponivelEm: envioEm, status: 'pendente', politicaVersao: politica.versao,
        chaveIdempotencia: `agenda-followup:${consulta.id}:${consulta.inicioEm.getTime()}:${envioEm.getTime()}`
      }).orIgnore().execute();
    }
    consulta.followupPoliticaId = politica.id;
    consulta.followupVersao = politica.versao;
    await gerenciador.getRepository(AgendaConsultaOrm).update({ id: consulta.id, tenantId }, { followupPoliticaId: politica.id, followupVersao: politica.versao });
  }

  /** Cursor implicito pelo par (politica_id, versao) da consulta. Lote finito por tenant. */
  async reconciliarPendentes(tenantId: string, limite = 50): Promise<number> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const padrao = await gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { tenantId, consultaId: IsNull() } });
      if (!padrao) return 0;
      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).createQueryBuilder('consulta')
        .leftJoin(PoliticaFollowupAgendaOrm, 'excecao', 'excecao.tenant_id = consulta.tenant_id and excecao.consulta_id = consulta.id')
        .where('consulta.tenant_id = :tenantId and consulta.status in (:...status) and consulta.inicio_em > now()', { tenantId, status: ['agendada', 'reagendada'] })
        .andWhere('(consulta.followup_politica_id is distinct from coalesce(excecao.id, :padraoId) or consulta.followup_versao is distinct from coalesce(excecao.versao, :padraoVersao))', { padraoId: padrao.id, padraoVersao: padrao.versao })
        .orderBy('consulta.inicio_em', 'ASC').take(limite).getMany();
      for (const consulta of consultas) await this.reconciliarConsultaNaTransacao(gerenciador, tenantId, consulta);
      return consultas.length;
    });
  }

  private validarPolitica(dados: SalvarPoliticaFollowup): EtapaFollowup[] {
    if (!dados || typeof dados.ativo !== 'boolean') throw new BadRequestException('Estado do calendario invalido.');
    const etapas = validarEtapas(dados.etapas);
    calcularEtapas(new Date('2028-03-31T12:00:00.000Z'), 'UTC', etapas);
    return etapas;
  }

  private async consultaAutorizada(gerenciador: EntityManager, tenantId: string, consultaId: string, usuario: UsuarioAutenticado, bloquear = false): Promise<AgendaConsultaOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
      where: { id: consultaId, tenantId, ...(profissionalId ? { profissionalId } : {}) },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!consulta) throw new NotFoundException('Consulta nao encontrada.');
    return consulta;
  }

  private respostaPolitica(politica: PoliticaFollowupAgendaOrm) {
    return { ativo: politica.ativo, etapas: politica.etapas, versao: politica.versao, configurado: true };
  }
}
