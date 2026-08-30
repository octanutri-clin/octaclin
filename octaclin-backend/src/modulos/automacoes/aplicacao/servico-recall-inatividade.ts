import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import {
  PreferenciasComunicacaoPaciente,
  TipoCanalDireto,
  aceitaAlgumCanal,
  canalPermitido,
  dentroHorarioPermitido,
  interpretarPreferenciasComunicacao,
  preferenciasComunicacaoPadrao
} from '../../comunicacoes/dominio/preferencias-comunicacao';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import {
  CandidatoRecall,
  ConfiguracaoRecallInatividade,
  ExclusaoRecall,
  PacienteParaRecall,
  ehGatilhoInatividade,
  normalizarConfiguracaoRecall,
  selecionarCandidatosRecall
} from '../dominio/recall-inatividade';

export const EVENTO_RECALL_INATIVIDADE = 'paciente.recall.inatividade';

export interface ResultadoSimulacaoRecall {
  execucao: ExecucaoRegraOrm;
  configuracao: ConfiguracaoRecallInatividade;
  candidatos: CandidatoRecall[];
  excluidos: ExclusaoRecall[];
}

export interface ResultadoProcessamentoRecall {
  regrasAvaliadas: number;
  recallsEnviados: number;
  recallsFalhados: number;
  pacientesIgnorados: number;
  /** Regras que nem chegaram a ser avaliadas por falha na selecao. */
  regrasComErro: number;
  /** Contatos que nao puderam ser descriptografados — sinal de problema de chave, nao de cadastro. */
  contatosIlegiveis: number;
}

type ResultadoEnvioRecall =
  | { status: 'enviado'; canal: TipoCanalDireto; mensagemId: string }
  | { status: 'ignorado'; motivo: string }
  | { status: 'falhou'; erro: string };

@Injectable()
export class ServicoRecallInatividade {
  private readonly logger = new Logger(ServicoRecallInatividade.name);

  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly comunicacoes: ServicoComunicacoes,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  /**
   * Simulacao obrigatoria antes de ativar: devolve exatamente quem seria contatado e,
   * para cada excluido, o motivo. Nao envia nada e nao conta para o teto de frequencia.
   */
  async simular(
    tenantId: string,
    regraId: string,
    usuario: UsuarioAutenticado,
    agora = new Date()
  ): Promise<ResultadoSimulacaoRecall> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: regraId, tenantId, ...(profissionalIdDoUsuario ? { profissionalId: profissionalIdDoUsuario } : {}) }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada.');
      if (!ehGatilhoInatividade(regra.gatilho)) {
        throw new BadRequestException('Esta regra nao usa o gatilho de inatividade.');
      }

      const configuracao = normalizarConfiguracaoRecall(regra.gatilho);
      const { candidatos, excluidos } = await this.selecionar(gerenciador, tenantId, regra, configuracao, agora);

      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.save(
        repositorio.create({
          tenantId,
          regraId: regra.id,
          status: candidatos.length ? 'executado' : 'ignorado',
          resultado: {
            simulacao: true,
            executar: candidatos.length > 0,
            gatilho: EVENTO_RECALL_INATIVIDADE,
            configuracao: { ...configuracao },
            totalCandidatos: candidatos.length,
            candidatos: candidatos.map((candidato) => ({
              pacienteId: candidato.pacienteId,
              diasSemConsulta: candidato.diasSemConsulta,
              ultimaConsultaConcluidaEm: candidato.ultimaConsultaConcluidaEm?.toISOString() ?? null
            })),
            excluidos,
            acoesPlanejadas: candidatos.length ? regra.acoes : []
          }
        })
      );

      return { execucao, configuracao, candidatos, excluidos };
    });
  }

  /**
   * Rodada real: percorre as regras de inatividade ativas do tenant e envia o recall.
   * Cada paciente contatado vira uma execucao propria — e assim que o teto de frequencia
   * enxerga o ultimo contato na proxima rodada.
   */
  async processarRecalls(tenantId: string, agora = new Date()): Promise<ResultadoProcessamentoRecall> {
    const regras = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(RegraAutomacaoOrm).find({ where: { tenantId, ativa: true } })
    );
    const regrasInatividade = regras.filter((regra) => ehGatilhoInatividade(regra.gatilho));

    const resultado: ResultadoProcessamentoRecall = {
      regrasAvaliadas: regrasInatividade.length,
      recallsEnviados: 0,
      recallsFalhados: 0,
      pacientesIgnorados: 0,
      regrasComErro: 0,
      contatosIlegiveis: 0
    };
    if (!regrasInatividade.length) return resultado;

    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId),
      this.comunicacoes.listarTemplates(tenantId)
    ]);

    // Cada regra e cada paciente sao isolados: uma falha pontual (banco, rede) nao pode
    // engolir o resto da rodada diaria e deixar os demais sem recall ate o dia seguinte.
    for (const regra of regrasInatividade) {
      const configuracao = normalizarConfiguracaoRecall(regra.gatilho);
      let selecao;
      try {
        selecao = await this.executorTenant.executar(tenantId, (gerenciador) =>
          this.selecionar(gerenciador, tenantId, regra, configuracao, agora)
        );
      } catch (erro) {
        resultado.regrasComErro += 1;
        this.logger.error(
          `Falha ao selecionar candidatos da regra ${regra.id}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
        );
        continue;
      }
      resultado.pacientesIgnorados += selecao.excluidos.length;
      resultado.contatosIlegiveis += selecao.excluidos.filter((item) => item.motivo === 'contato_ilegivel').length;

      for (const candidato of selecao.candidatos) {
        try {
          const envio = await this.enviarRecall(tenantId, regra, candidato, canais, templates, agora);
          if (envio.status === 'enviado') resultado.recallsEnviados += 1;
          else if (envio.status === 'falhou') resultado.recallsFalhados += 1;
          else resultado.pacientesIgnorados += 1;

          await this.registrarExecucao(tenantId, regra, candidato, envio, configuracao);
        } catch (erro) {
          // Chegar aqui significa que ate o registro da execucao falhou. Se o envio tinha
          // acontecido, o paciente fica sem rastro e pode ser recontatado — por isso e error,
          // nao warn.
          resultado.recallsFalhados += 1;
          this.logger.error(
            `Recall da regra ${regra.id} para o paciente ${candidato.pacienteId} nao pode ser concluido nem registrado: ${
              erro instanceof Error ? erro.message : 'erro desconhecido'
            }`
          );
        }
      }
    }

    return resultado;
  }

  private async selecionar(
    gerenciador: EntityManager,
    tenantId: string,
    regra: RegraAutomacaoOrm,
    configuracao: ConfiguracaoRecallInatividade,
    agora: Date
  ) {
    // Escopo duro: a regra so alcanca pacientes do profissional dono dela.
    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      where: { tenantId, profissionalResponsavelId: regra.profissionalId, arquivadoEm: IsNull() }
    });
    if (!pacientes.length) return { candidatos: [], excluidos: [] };

    const pacienteIds = pacientes.map((paciente) => paciente.id);
    const [ultimasConsultas, ultimosRecalls] = await Promise.all([
      this.mapearUltimaConsultaConcluida(gerenciador, tenantId, pacienteIds),
      this.mapearUltimoRecall(gerenciador, tenantId, regra.id, pacienteIds)
    ]);

    const entrada: PacienteParaRecall[] = pacientes.map((paciente) => {
      const { preferencias, ilegivel } = this.preferenciasDoPaciente(paciente);
      return {
        pacienteId: paciente.id,
        statusAdesao: paciente.statusAdesao,
        ultimaConsultaConcluidaEm: ultimasConsultas.get(paciente.id) ?? null,
        ultimoRecallEm: ultimosRecalls.get(paciente.id) ?? null,
        aceitaComunicacao: aceitaAlgumCanal(preferencias),
        possuiContato: Boolean(preferencias.contatos.email || preferencias.contatos.whatsapp),
        contatoIlegivel: ilegivel
      };
    });

    return selecionarCandidatosRecall(entrada, configuracao, agora);
  }

  private async mapearUltimaConsultaConcluida(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteIds: string[]
  ): Promise<Map<string, Date>> {
    const linhas = await gerenciador
      .getRepository(AgendaConsultaOrm)
      .createQueryBuilder('consulta')
      .select('consulta.paciente_id', 'pacienteId')
      .addSelect('MAX(consulta.fim_em)', 'ultimaEm')
      .where('consulta.tenant_id = :tenantId', { tenantId })
      .andWhere('consulta.status = :status', { status: 'concluida' })
      .andWhere('consulta.paciente_id IN (:...pacienteIds)', { pacienteIds })
      .groupBy('consulta.paciente_id')
      .getRawMany<{ pacienteId: string; ultimaEm: Date | string }>();

    return new Map(linhas.map((linha) => [linha.pacienteId, new Date(linha.ultimaEm)]));
  }

  private async mapearUltimoRecall(
    gerenciador: EntityManager,
    tenantId: string,
    regraId: string,
    pacienteIds: string[]
  ): Promise<Map<string, Date>> {
    const execucoes = await gerenciador.getRepository(ExecucaoRegraOrm).find({
      where: { tenantId, regraId, status: 'executado', pacienteId: Not(IsNull()) },
      order: { criadoEm: 'DESC' }
    });

    const conhecidos = new Set(pacienteIds);
    const mapa = new Map<string, Date>();
    for (const execucao of execucoes) {
      // Simulacao nao gasta o teto de frequencia: so contato real conta.
      if (execucao.resultado?.simulacao === true) continue;
      if (!execucao.pacienteId || !conhecidos.has(execucao.pacienteId) || mapa.has(execucao.pacienteId)) continue;
      mapa.set(execucao.pacienteId, execucao.criadoEm);
    }
    return mapa;
  }

  private preferenciasDoPaciente(paciente: PacienteOrm): {
    preferencias: PreferenciasComunicacaoPaciente;
    ilegivel: boolean;
  } {
    if (!paciente.contatoCriptografado) return { preferencias: preferenciasComunicacaoPadrao(), ilegivel: false };
    try {
      return {
        preferencias: interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado)),
        ilegivel: false
      };
    } catch (erro) {
      // Contato ilegivel nao pode virar envio as cegas. Marcado como ilegivel para nao se
      // confundir com paciente sem contato cadastrado — a causa e outra e a acao tambem.
      this.logger.error(
        `Contato do paciente ${paciente.id} nao pode ser lido para recall: ${
          erro instanceof Error ? erro.message : 'erro desconhecido'
        }`
      );
      return { preferencias: preferenciasComunicacaoPadrao(), ilegivel: true };
    }
  }

  private async enviarRecall(
    tenantId: string,
    regra: RegraAutomacaoOrm,
    candidato: CandidatoRecall,
    canais: CanalNotificacaoOrm[],
    templates: TemplateMensagemOrm[],
    agora: Date
  ): Promise<ResultadoEnvioRecall> {
    const leitura = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, id: candidato.pacienteId }
      });
      return paciente ? this.preferenciasDoPaciente(paciente) : null;
    });
    if (!leitura) return { status: 'ignorado', motivo: 'paciente_ausente' };
    if (leitura.ilegivel) return { status: 'ignorado', motivo: 'contato_ilegivel' };
    const preferencias = leitura.preferencias;
    if (!dentroHorarioPermitido(agora, preferencias.horarioPermitido)) {
      return { status: 'ignorado', motivo: 'fora_horario_preferido' };
    }

    const tipo = this.escolherCanal(preferencias);
    if (!tipo) return { status: 'ignorado', motivo: 'sem_canal_permitido' };

    const destino = preferencias.contatos[tipo];
    if (!destino) return { status: 'ignorado', motivo: 'contato_ausente' };

    const canal = canais.find((item) => item.tipo === tipo && item.ativo);
    if (!canal) return { status: 'ignorado', motivo: 'canal_ausente' };

    const template = this.selecionarTemplate(templates, tipo);
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };

    let mensagemId: string;
    try {
      const mensagem = await this.comunicacoes.dispararMensagemSistema(tenantId, {
        pacienteId: candidato.pacienteId,
        canalId: canal.id,
        templateId: template.id,
        payload: {
          destino,
          evento: EVENTO_RECALL_INATIVIDADE,
          regraId: regra.id,
          diasSemConsulta: candidato.diasSemConsulta,
          ultimaConsultaConcluidaEm: candidato.ultimaConsultaConcluidaEm?.toISOString() ?? null
        }
      });
      mensagemId = mensagem.id;
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : 'Falha ao enviar recall.';
      this.logger.warn(`Recall da regra ${regra.id} falhou para o paciente ${candidato.pacienteId}: ${mensagemErro}`);
      return { status: 'falhou', erro: mensagemErro };
    }

    // Daqui em diante o envio ja esta garantido: dispararMensagem grava mensagem e evento de
    // outbox na mesma transacao, e o poller de outbox entrega mesmo sem Redis. Publicar e so
    // o atalho rapido — se falhar nao pode virar 'falhou', senao o teto de frequencia nao
    // enxerga o contato e o paciente recebe recall de novo na proxima rodada.
    try {
      await this.comunicacoes.publicarEventoNotificacao(tenantId, mensagemId);
    } catch (erro) {
      this.logger.warn(
        `Recall ${mensagemId} seguira apenas pelo outbox (publicacao imediata falhou): ${
          erro instanceof Error ? erro.message : 'erro desconhecido'
        }`
      );
    }
    return { status: 'enviado', canal: tipo, mensagemId };
  }

  private escolherCanal(preferencias: PreferenciasComunicacaoPaciente): TipoCanalDireto | null {
    if (preferencias.canalPreferido !== 'qualquer') {
      return canalPermitido(preferencias, preferencias.canalPreferido) ? preferencias.canalPreferido : null;
    }
    if (canalPermitido(preferencias, 'whatsapp')) return 'whatsapp';
    if (canalPermitido(preferencias, 'email')) return 'email';
    return null;
  }

  private selecionarTemplate(templates: TemplateMensagemOrm[], tipo: TipoCanalDireto) {
    // WhatsApp exige template aprovado pela Meta; email nao tem essa exigencia.
    const candidatos = templates.filter((item) => item.canal === tipo && (tipo === 'email' || item.aprovado));
    return candidatos.find((item) => item.conteudo?.evento === EVENTO_RECALL_INATIVIDADE);
  }

  private registrarExecucao(
    tenantId: string,
    regra: RegraAutomacaoOrm,
    candidato: CandidatoRecall,
    envio: ResultadoEnvioRecall,
    configuracao: ConfiguracaoRecallInatividade
  ) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      await repositorio.save(
        repositorio.create({
          tenantId,
          regraId: regra.id,
          pacienteId: candidato.pacienteId,
          status: envio.status === 'enviado' ? 'executado' : envio.status === 'falhou' ? 'falhou' : 'ignorado',
          erro: envio.status === 'falhou' ? envio.erro : undefined,
          resultado: {
            simulacao: false,
            gatilho: EVENTO_RECALL_INATIVIDADE,
            diasSemConsulta: candidato.diasSemConsulta,
            intervaloMinimoDias: configuracao.intervaloMinimoDias,
            envio
          }
        })
      );
    });
  }
}
