import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, In, IsNull, LessThan, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { PROFISSIONAL_SENTINELA_INEXISTENTE } from '../../../infraestrutura/seguranca/escopo-profissional';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { AgendaSolicitacaoOrm } from '../../agenda/infraestrutura/agenda-solicitacao.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import {
  AlertaDashboardClinicoDto,
  AtendimentoDashboardClinicoDto,
  ComunicacaoDashboardClinicoDto,
  ContextoDashboardClinicoDto,
  FaixaSemRetorno,
  FiltrosDashboardClinicoDto,
  FormularioPendenteDashboardClinicoDto,
  IndicadoresDashboardClinicoDto,
  NivelRiscoDashboard,
  OcultacaoAlertaDashboardClinicoDto,
  PeriodoDashboardClinico,
  ResumoDashboardClinicoDto,
  SemRetornoDashboardClinicoDto,
  SolicitacaoPendenteDashboardClinicoDto,
  TarefaVencidaDashboardClinicoDto
} from './dtos-dashboard-clinico';
import { DashboardAlertaOcultoOrm } from '../infraestrutura/dashboard-alerta-oculto.orm';

const LIMITE_FILA = 50;
const TIMEZONE_CLINICO_PADRAO = 'America/Sao_Paulo';
const STATUS_PACIENTE_INATIVO = new Set(['inativo', 'pausado', 'encerrado', 'fechado']);
const STATUS_COMUNICACAO_ALERTA = new Set(['pendente', 'falhou', 'recebido']);
const STATUS_CONSULTA_ATIVA = new Set(['agendada', 'reagendada']);
const TIPOS_ALERTA_OCULTAVEIS = new Set([
  'tarefa_vencida',
  'atendimento_proximo',
  'formulario_pendente',
  'solicitacao_pendente',
  'comunicacao_alerta'
]);

interface ContextoProfissionalResolvido {
  id: string;
  usuarioId: string;
  nome: string;
}

interface DadosAgregados {
  consultas: AgendaConsultaOrm[];
  pacientes: PacienteOrm[];
  consultasConcluidas: AgendaConsultaOrm[];
  tarefas: AcompanhamentoTarefaOrm[];
  envios: EnvioQuestionarioOrm[];
  solicitacoes: AgendaSolicitacaoOrm[];
  mensagens: MensagemNotificacaoOrm[];
  ocultacoes: DashboardAlertaOcultoOrm[];
}

@Injectable()
export class ServicoDashboardClinico {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obterResumo(
    tenantId: string,
    filtros: FiltrosDashboardClinicoDto,
    usuario: UsuarioAutenticado
  ): Promise<ResumoDashboardClinicoDto> {
    this.garantirPapelPermitido(usuario);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const periodo = filtros.periodo ?? 'hoje';
      const intervalo = this.calcularIntervalo(periodo);
      const contexto = await this.resolverContextoProfissional(
        gerenciador,
        tenantId,
        filtros.profissionalId,
        usuario
      );

      if (!contexto) {
        return this.resumoVazio(periodo, intervalo.inicioEm, intervalo.fimEm, true);
      }

      const pacientes = await gerenciador.getRepository(PacienteOrm).find({
        where: {
          tenantId,
          profissionalResponsavelId: contexto.id,
          arquivadoEm: IsNull()
        },
        order: { criadoEm: 'ASC' }
      });
      const pacientesAtivos = pacientes.filter(
        (paciente) =>
          paciente.tenantId === tenantId &&
          paciente.profissionalResponsavelId === contexto.id &&
          !paciente.arquivadoEm &&
          !STATUS_PACIENTE_INATIVO.has(paciente.statusAdesao)
      );
      const pacienteIds = pacientesAtivos.map((paciente) => paciente.id);

      const dados = await this.buscarDadosAgregados(
        gerenciador,
        tenantId,
        contexto,
        usuario.usuarioId,
        intervalo,
        pacientesAtivos,
        pacienteIds
      );

      return this.montarResumo(tenantId, periodo, intervalo, contexto, dados, usuario.usuarioId);
    });
  }

  async ocultarAlerta(
    tenantId: string,
    alertaId: string,
    usuario: UsuarioAutenticado
  ): Promise<OcultacaoAlertaDashboardClinicoDto> {
    this.garantirPapelPermitido(usuario);
    const partes = this.validarAlertaId(alertaId);
    if (partes.tipo === 'sem_retorno_risco_alto') {
      throw new BadRequestException('Alertas de risco alto nao podem ser ocultados.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const contexto = await this.resolverContextoProfissional(
        gerenciador,
        tenantId,
        partes.profissionalId,
        usuario
      );
      if (!contexto || contexto.id !== partes.profissionalId) {
        throw new ForbiddenException('Alerta fora do escopo profissional.');
      }

      await this.garantirAlertaAtual(gerenciador, tenantId, contexto, partes);

      const repositorio = gerenciador.getRepository(DashboardAlertaOcultoOrm);
      const existente = await repositorio.findOne({
        where: { tenantId, usuarioId: usuario.usuarioId, alertaId }
      });
      const ocultoAteEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const registro =
        existente ??
        repositorio.create({
          tenantId,
          usuarioId: usuario.usuarioId,
          alertaId,
          ocultoAteEm
        });
      registro.ocultoAteEm = ocultoAteEm;
      await repositorio.save(registro);

      return { alertaId, ocultoAteEm };
    });
  }

  private async buscarDadosAgregados(
    gerenciador: EntityManager,
    tenantId: string,
    contexto: ContextoProfissionalResolvido,
    usuarioId: string,
    intervalo: { inicioEm: Date; fimEm: Date },
    pacientes: PacienteOrm[],
    pacienteIds: string[]
  ): Promise<DadosAgregados> {
    if (!pacienteIds.length) {
      const [consultas, solicitacoes, ocultacoes] = await Promise.all([
        gerenciador.getRepository(AgendaConsultaOrm).find({
          where: {
            tenantId,
            profissionalId: contexto.id,
            inicioEm: Between(intervalo.inicioEm, intervalo.fimEm)
          },
          order: { inicioEm: 'ASC' }
        }),
        gerenciador.getRepository(AgendaSolicitacaoOrm).find({
          where: {
            tenantId,
            profissionalId: contexto.id,
            status: 'pendente',
            expiraEm: MoreThan(new Date())
          },
          order: { inicioEm: 'ASC' }
        }),
        gerenciador.getRepository(DashboardAlertaOcultoOrm).find({
          where: { tenantId, usuarioId, ocultoAteEm: MoreThan(new Date()) }
        })
      ]);
      return {
        consultas,
        pacientes,
        consultasConcluidas: [],
        tarefas: [],
        envios: [],
        solicitacoes,
        mensagens: [],
        ocultacoes
      };
    }

    const [consultas, consultasConcluidas, tarefas, envios, solicitacoes, mensagens, ocultacoes] =
      await Promise.all([
        gerenciador.getRepository(AgendaConsultaOrm).find({
          where: {
            tenantId,
            profissionalId: contexto.id,
            inicioEm: Between(intervalo.inicioEm, intervalo.fimEm)
          },
          order: { inicioEm: 'ASC' }
        }),
        gerenciador.getRepository(AgendaConsultaOrm).find({
          where: {
            tenantId,
            pacienteId: In(pacienteIds),
            status: 'concluida'
          },
          order: { inicioEm: 'DESC' }
        }),
        gerenciador.getRepository(AcompanhamentoTarefaOrm).find({
          where: {
            tenantId,
            profissionalId: contexto.usuarioId,
            pacienteId: In(pacienteIds),
            status: In(['pendente', 'em_andamento']),
            vencimentoEm: LessThan(new Date())
          },
          order: { vencimentoEm: 'ASC' }
        }),
        gerenciador.getRepository(EnvioQuestionarioOrm).find({
          where: {
            tenantId,
            pacienteId: In(pacienteIds),
            status: 'respondido',
            revisadoEm: IsNull()
          },
          order: { respondidoEm: 'ASC' }
        }),
        gerenciador.getRepository(AgendaSolicitacaoOrm).find({
          where: {
            tenantId,
            profissionalId: contexto.id,
            status: 'pendente',
            expiraEm: MoreThan(new Date())
          },
          order: { inicioEm: 'ASC' }
        }),
        gerenciador.getRepository(MensagemNotificacaoOrm).find({
          where: {
            tenantId,
            pacienteId: In(pacienteIds),
            status: In(['pendente', 'falhou', 'recebido'])
          },
          order: { criadoEm: 'DESC' }
        }),
        gerenciador.getRepository(DashboardAlertaOcultoOrm).find({
          where: { tenantId, usuarioId, ocultoAteEm: MoreThan(new Date()) }
        })
      ]);

    return {
      consultas,
      pacientes,
      consultasConcluidas,
      tarefas,
      envios,
      solicitacoes,
      mensagens,
      ocultacoes
    };
  }

  private montarResumo(
    tenantId: string,
    periodo: PeriodoDashboardClinico,
    intervalo: { inicioEm: Date; fimEm: Date },
    contexto: ContextoProfissionalResolvido,
    dados: DadosAgregados,
    usuarioId: string
  ): ResumoDashboardClinicoDto {
    const pacientes = dados.pacientes.filter(
      (paciente) =>
        paciente.tenantId === tenantId &&
        paciente.profissionalResponsavelId === contexto.id &&
        !paciente.arquivadoEm &&
        !STATUS_PACIENTE_INATIVO.has(paciente.statusAdesao)
    );
    const pacientesPorId = new Map(pacientes.map((paciente) => [paciente.id, paciente]));
    const consultas = dados.consultas
      .filter(
        (consulta) =>
          consulta.tenantId === tenantId &&
          consulta.profissionalId === contexto.id &&
          consulta.inicioEm >= intervalo.inicioEm &&
          consulta.inicioEm <= intervalo.fimEm
      )
      .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime());
    const consultasConcluidas = dados.consultasConcluidas.filter(
      (consulta) =>
        consulta.tenantId === tenantId &&
        consulta.status === 'concluida' &&
        pacientesPorId.has(consulta.pacienteId)
    );
    const ultimaConcluidaPorPaciente = new Map<string, Date>();
    for (const consulta of consultasConcluidas) {
      const atual = ultimaConcluidaPorPaciente.get(consulta.pacienteId);
      if (!atual || consulta.inicioEm > atual) {
        ultimaConcluidaPorPaciente.set(consulta.pacienteId, consulta.inicioEm);
      }
    }

    const semRetorno = this.montarSemRetorno(pacientes, ultimaConcluidaPorPaciente, contexto.id);
    const atendimentosCompletos = consultas
      .filter((consulta) => pacientesPorId.has(consulta.pacienteId))
      .map((consulta) =>
        this.mapearAtendimento(consulta, pacientesPorId.get(consulta.pacienteId)!, contexto.id)
      );
    const tarefasVencidas = this.montarTarefas(dados.tarefas, pacientesPorId, contexto);
    const formulariosPendentes = this.montarFormularios(dados.envios, pacientesPorId, contexto.id);
    const solicitacoesPendentes = this.montarSolicitacoes(
      dados.solicitacoes,
      contexto.id,
      tenantId
    );
    const comunicacoes = this.montarComunicacoes(dados.mensagens, pacientesPorId, contexto.id);
    const ocultas = new Set(
      dados.ocultacoes
        .filter(
          (ocultacao) =>
            ocultacao.usuarioId === usuarioId &&
            ocultacao.ocultoAteEm.getTime() > Date.now() &&
            ocultacao.tenantId === tenantId
        )
        .map((ocultacao) => ocultacao.alertaId)
    );
    const alertas = this.montarAlertas(
      contexto.id,
      semRetorno,
      tarefasVencidas,
      atendimentosCompletos,
      formulariosPendentes,
      solicitacoesPendentes,
      comunicacoes
    ).filter((alerta) => !alerta.ocultavel || !ocultas.has(alerta.id));

    return {
      contexto: {
        periodo,
        inicioEm: intervalo.inicioEm,
        fimEm: intervalo.fimEm,
        profissionalId: contexto.id,
        profissionalNome: contexto.nome
      },
      indicadores: this.montarIndicadores(
        consultas,
        semRetorno,
        tarefasVencidas,
        formulariosPendentes,
        solicitacoesPendentes,
        comunicacoes
      ),
      atendimentos: atendimentosCompletos.slice(0, LIMITE_FILA),
      semRetorno: semRetorno.slice(0, LIMITE_FILA),
      tarefasVencidas: tarefasVencidas.slice(0, LIMITE_FILA),
      formulariosPendentes: formulariosPendentes.slice(0, LIMITE_FILA),
      solicitacoesPendentes: solicitacoesPendentes.slice(0, LIMITE_FILA),
      comunicacoes: comunicacoes.slice(0, LIMITE_FILA),
      alertas: alertas.slice(0, LIMITE_FILA),
      selecaoObrigatoria: false
    };
  }

  private montarSemRetorno(
    pacientes: PacienteOrm[],
    ultimaConcluidaPorPaciente: Map<string, Date>,
    profissionalId: string
  ): SemRetornoDashboardClinicoDto[] {
    return pacientes
      .map((paciente) => {
        const ultimaConsultaConcluidaEm = ultimaConcluidaPorPaciente.get(paciente.id);
        const referencia = ultimaConsultaConcluidaEm ?? paciente.criadoEm;
        const diasSemRetorno = Math.floor((Date.now() - referencia.getTime()) / (24 * 60 * 60 * 1000));
        const scoreRisco = Number(paciente.scoreRisco);
        return {
          pacienteId: paciente.id,
          profissionalId,
          pacienteNome: this.criptografia.descriptografar(paciente.nomeCriptografado),
          nivelRisco: this.calcularNivelRisco(paciente.statusAdesao, scoreRisco),
          scoreRisco,
          diasSemRetorno,
          faixa: this.calcularFaixaSemRetorno(diasSemRetorno),
          ultimaConsultaConcluidaEm
        };
      })
      .filter((item) => item.diasSemRetorno >= 30)
      .sort((a, b) => {
        const risco = this.pesoRisco(b.nivelRisco) - this.pesoRisco(a.nivelRisco);
        return risco || b.diasSemRetorno - a.diasSemRetorno;
      });
  }

  private montarTarefas(
    tarefas: AcompanhamentoTarefaOrm[],
    pacientes: Map<string, PacienteOrm>,
    contexto: ContextoProfissionalResolvido
  ): TarefaVencidaDashboardClinicoDto[] {
    return tarefas
      .filter(
        (tarefa) =>
          pacientes.has(tarefa.pacienteId) &&
          tarefa.profissionalId === contexto.usuarioId &&
          (tarefa.status === 'pendente' || tarefa.status === 'em_andamento') &&
          !!tarefa.vencimentoEm &&
          tarefa.vencimentoEm.getTime() < Date.now()
      )
      .map((tarefa) => ({
        id: tarefa.id,
        pacienteId: tarefa.pacienteId,
        profissionalId: contexto.id,
        pacienteNome: this.nomePaciente(pacientes, tarefa.pacienteId),
        titulo: tarefa.titulo,
        prioridade: tarefa.prioridade,
        vencimentoEm: tarefa.vencimentoEm!
      }))
      .sort((a, b) => a.vencimentoEm.getTime() - b.vencimentoEm.getTime());
  }

  private montarFormularios(
    envios: EnvioQuestionarioOrm[],
    pacientes: Map<string, PacienteOrm>,
    profissionalId: string
  ): FormularioPendenteDashboardClinicoDto[] {
    return envios
      .filter(
        (envio) =>
          pacientes.has(envio.pacienteId) &&
          envio.status === 'respondido' &&
          !envio.revisadoEm
      )
      .map((envio) => ({
        id: envio.id,
        pacienteId: envio.pacienteId,
        profissionalId,
        pacienteNome: this.nomePaciente(pacientes, envio.pacienteId),
        questionarioId: envio.questionarioId,
        respondidoEm: envio.respondidoEm
      }))
      .sort((a, b) => (a.respondidoEm?.getTime() ?? 0) - (b.respondidoEm?.getTime() ?? 0));
  }

  private montarSolicitacoes(
    solicitacoes: AgendaSolicitacaoOrm[],
    profissionalId: string,
    tenantId: string
  ): SolicitacaoPendenteDashboardClinicoDto[] {
    return solicitacoes
      .filter(
        (solicitacao) =>
          solicitacao.profissionalId === profissionalId &&
          solicitacao.tenantId === tenantId &&
          solicitacao.status === 'pendente' &&
          solicitacao.expiraEm.getTime() > Date.now()
      )
      .map((solicitacao) => ({
        id: solicitacao.id,
        profissionalId,
        solicitanteNome: this.criptografia.descriptografar(solicitacao.nomeCriptografado),
        inicioEm: solicitacao.inicioEm,
        fimEm: solicitacao.fimEm,
        expiraEm: solicitacao.expiraEm
      }))
      .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime());
  }

  private montarComunicacoes(
    mensagens: MensagemNotificacaoOrm[],
    pacientes: Map<string, PacienteOrm>,
    profissionalId: string
  ): ComunicacaoDashboardClinicoDto[] {
    return mensagens
      .filter(
        (mensagem) =>
          !!mensagem.pacienteId &&
          pacientes.has(mensagem.pacienteId) &&
          STATUS_COMUNICACAO_ALERTA.has(mensagem.status)
      )
      .map((mensagem) => ({
        id: mensagem.id,
        pacienteId: mensagem.pacienteId!,
        profissionalId,
        pacienteNome: this.nomePaciente(pacientes, mensagem.pacienteId!),
        status: mensagem.status as ComunicacaoDashboardClinicoDto['status'],
        criadoEm: mensagem.criadoEm
      }))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  private montarAlertas(
    profissionalId: string,
    semRetorno: SemRetornoDashboardClinicoDto[],
    tarefas: TarefaVencidaDashboardClinicoDto[],
    atendimentos: AtendimentoDashboardClinicoDto[],
    formularios: FormularioPendenteDashboardClinicoDto[],
    solicitacoes: SolicitacaoPendenteDashboardClinicoDto[],
    comunicacoes: ComunicacaoDashboardClinicoDto[]
  ): AlertaDashboardClinicoDto[] {
    const alertas: AlertaDashboardClinicoDto[] = [];

    for (const item of semRetorno.filter((paciente) => paciente.nivelRisco === 'alto')) {
      alertas.push({
        id: `sem_retorno_risco_alto:${profissionalId}:${item.pacienteId}`,
        tipo: 'sem_retorno_risco_alto',
        prioridade: 1,
        recursoId: item.pacienteId,
        pacienteId: item.pacienteId,
        ocorridoEm: item.ultimaConsultaConcluidaEm ?? new Date(0),
        ocultavel: false
      });
    }
    for (const item of tarefas) {
      alertas.push({
        id: `tarefa_vencida:${profissionalId}:${item.id}`,
        tipo: 'tarefa_vencida',
        prioridade: 2,
        recursoId: item.id,
        pacienteId: item.pacienteId,
        ocorridoEm: item.vencimentoEm,
        ocultavel: true
      });
    }
    for (const item of atendimentos.filter(
      (consulta) =>
        STATUS_CONSULTA_ATIVA.has(consulta.status) && consulta.inicioEm.getTime() >= Date.now()
    )) {
      alertas.push({
        id: `atendimento_proximo:${profissionalId}:${item.id}`,
        tipo: 'atendimento_proximo',
        prioridade: 3,
        recursoId: item.id,
        pacienteId: item.pacienteId,
        ocorridoEm: item.inicioEm,
        ocultavel: true
      });
    }
    for (const item of formularios) {
      alertas.push({
        id: `formulario_pendente:${profissionalId}:${item.id}`,
        tipo: 'formulario_pendente',
        prioridade: 4,
        recursoId: item.id,
        pacienteId: item.pacienteId,
        ocorridoEm: item.respondidoEm ?? new Date(0),
        ocultavel: true
      });
    }
    for (const item of solicitacoes) {
      alertas.push({
        id: `solicitacao_pendente:${profissionalId}:${item.id}`,
        tipo: 'solicitacao_pendente',
        prioridade: 5,
        recursoId: item.id,
        ocorridoEm: item.inicioEm,
        ocultavel: true
      });
    }
    for (const item of comunicacoes) {
      alertas.push({
        id: `comunicacao_alerta:${profissionalId}:${item.id}`,
        tipo: 'comunicacao_alerta',
        prioridade: 6,
        recursoId: item.id,
        pacienteId: item.pacienteId,
        ocorridoEm: item.criadoEm,
        ocultavel: true
      });
    }

    return alertas.sort(
      (a, b) => a.prioridade - b.prioridade || a.ocorridoEm.getTime() - b.ocorridoEm.getTime()
    );
  }

  private montarIndicadores(
    consultas: AgendaConsultaOrm[],
    semRetorno: SemRetornoDashboardClinicoDto[],
    tarefas: TarefaVencidaDashboardClinicoDto[],
    formularios: FormularioPendenteDashboardClinicoDto[],
    solicitacoes: SolicitacaoPendenteDashboardClinicoDto[],
    comunicacoes: ComunicacaoDashboardClinicoDto[]
  ): IndicadoresDashboardClinicoDto {
    const hoje = this.calcularIntervalo('hoje');
    return {
      consultasHoje: consultas.filter(
        (consulta) => consulta.inicioEm >= hoje.inicioEm && consulta.inicioEm <= hoje.fimEm
      ).length,
      proximas: consultas.filter(
        (consulta) => STATUS_CONSULTA_ATIVA.has(consulta.status) && consulta.inicioEm.getTime() >= Date.now()
      ).length,
      concluidas: consultas.filter((consulta) => consulta.status === 'concluida').length,
      reagendadas: consultas.filter((consulta) => consulta.status === 'reagendada').length,
      canceladas: consultas.filter((consulta) => consulta.status === 'cancelada').length,
      faltas: consultas.filter((consulta) => consulta.status === 'falta').length,
      semRetorno30: semRetorno.filter((paciente) => paciente.faixa === '30').length,
      semRetorno60: semRetorno.filter((paciente) => paciente.faixa === '60').length,
      semRetorno90Mais: semRetorno.filter((paciente) => paciente.faixa === '90+').length,
      formulariosPendentes: formularios.length,
      tarefasVencidas: tarefas.length,
      solicitacoesPendentes: solicitacoes.length,
      comunicacoesEmAlerta: comunicacoes.length,
      pacientesRiscoAlto: semRetorno.filter((paciente) => paciente.nivelRisco === 'alto').length
    };
  }

  private mapearAtendimento(
    consulta: AgendaConsultaOrm,
    paciente: PacienteOrm,
    profissionalId: string
  ): AtendimentoDashboardClinicoDto {
    return {
      id: consulta.id,
      pacienteId: consulta.pacienteId,
      profissionalId,
      pacienteNome: this.criptografia.descriptografar(paciente.nomeCriptografado),
      inicioEm: consulta.inicioEm,
      fimEm: consulta.fimEm,
      status: consulta.status
    };
  }

  private async resolverContextoProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalIdSolicitado: string | undefined,
    usuario: UsuarioAutenticado
  ): Promise<ContextoProfissionalResolvido | undefined> {
    const repositorio = gerenciador.getRepository(ProfissionalOrm);
    if (usuario.papel === 'Professional') {
      const profissional = await repositorio.findOne({
        where: { tenantId, usuarioId: usuario.usuarioId }
      });
      if (!profissional) {
        return {
          id: PROFISSIONAL_SENTINELA_INEXISTENTE,
          usuarioId: usuario.usuarioId,
          nome: ''
        };
      }
      return this.mapearContextoProfissional(profissional, tenantId);
    }

    if (!profissionalIdSolicitado) return undefined;
    const profissional = await repositorio.findOne({
      where: { id: profissionalIdSolicitado, tenantId }
    });
    if (!profissional) {
      throw new NotFoundException('Profissional nao encontrado.');
    }
    return this.mapearContextoProfissional(profissional, tenantId);
  }

  private mapearContextoProfissional(
    profissional: ProfissionalOrm,
    tenantId: string
  ): ContextoProfissionalResolvido {
    if (profissional.tenantId !== tenantId || profissional.arquivadoEm) {
      throw new NotFoundException('Profissional nao encontrado.');
    }
    return {
      id: profissional.id,
      usuarioId: profissional.usuarioId,
      nome: this.criptografia.descriptografar(profissional.nomeCriptografado)
    };
  }

  private resumoVazio(
    periodo: PeriodoDashboardClinico,
    inicioEm: Date,
    fimEm: Date,
    selecaoObrigatoria: boolean
  ): ResumoDashboardClinicoDto {
    return {
      contexto: { periodo, inicioEm, fimEm },
      indicadores: {
        consultasHoje: 0,
        proximas: 0,
        concluidas: 0,
        reagendadas: 0,
        canceladas: 0,
        faltas: 0,
        semRetorno30: 0,
        semRetorno60: 0,
        semRetorno90Mais: 0,
        formulariosPendentes: 0,
        tarefasVencidas: 0,
        solicitacoesPendentes: 0,
        comunicacoesEmAlerta: 0,
        pacientesRiscoAlto: 0
      },
      atendimentos: [],
      semRetorno: [],
      tarefasVencidas: [],
      formulariosPendentes: [],
      solicitacoesPendentes: [],
      comunicacoes: [],
      alertas: [],
      selecaoObrigatoria
    };
  }

  private calcularIntervalo(periodo: PeriodoDashboardClinico): { inicioEm: Date; fimEm: Date } {
    const timezone = this.obterTimezoneClinico();
    const agora = new Date();
    const dataLocal = this.extrairPartesData(agora, timezone);
    const dias = periodo === 'hoje' ? 1 : periodo === 'sete_dias' ? 7 : 30;
    const inicioEm = this.converterInicioLocalParaUtc(
      dataLocal.ano,
      dataLocal.mes,
      dataLocal.dia,
      timezone
    );
    const dataFinal = new Date(Date.UTC(dataLocal.ano, dataLocal.mes - 1, dataLocal.dia + dias));
    const fimExclusivo = this.converterInicioLocalParaUtc(
      dataFinal.getUTCFullYear(),
      dataFinal.getUTCMonth() + 1,
      dataFinal.getUTCDate(),
      timezone
    );
    const fimEm = new Date(fimExclusivo.getTime() - 1);
    return { inicioEm, fimEm };
  }

  private obterTimezoneClinico(): string {
    const configurado = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || TIMEZONE_CLINICO_PADRAO;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: configurado }).format();
      return configurado;
    } catch {
      return TIMEZONE_CLINICO_PADRAO;
    }
  }

  private extrairPartesData(
    data: Date,
    timezone: string
  ): { ano: number; mes: number; dia: number } {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(data);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(partes.find((parte) => parte.type === tipo)?.value);
    return { ano: valor('year'), mes: valor('month'), dia: valor('day') };
  }

  private converterInicioLocalParaUtc(
    ano: number,
    mes: number,
    dia: number,
    timezone: string
  ): Date {
    const alvoUtc = Date.UTC(ano, mes - 1, dia);
    let instante = alvoUtc;

    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const deslocamento = this.calcularDeslocamentoTimezone(new Date(instante), timezone);
      const ajustado = alvoUtc - deslocamento;
      if (ajustado === instante) break;
      instante = ajustado;
    }

    return new Date(instante);
  }

  private calcularDeslocamentoTimezone(data: Date, timezone: string): number {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(data);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(partes.find((parte) => parte.type === tipo)?.value);
    const representacaoUtc = Date.UTC(
      valor('year'),
      valor('month') - 1,
      valor('day'),
      valor('hour'),
      valor('minute'),
      valor('second')
    );
    const instanteSemMilissegundos = Math.floor(data.getTime() / 1000) * 1000;
    return representacaoUtc - instanteSemMilissegundos;
  }

  private async garantirAlertaAtual(
    gerenciador: EntityManager,
    tenantId: string,
    contexto: ContextoProfissionalResolvido,
    partes: { tipo: string; profissionalId: string; recursoId: string }
  ): Promise<void> {
    const agora = Date.now();
    let pacienteId: string | undefined;
    let alertaAtual = false;

    if (partes.tipo === 'tarefa_vencida') {
      const tarefa = await gerenciador.getRepository(AcompanhamentoTarefaOrm).findOne({
        where: {
          id: partes.recursoId,
          tenantId,
          profissionalId: contexto.usuarioId
        }
      });
      pacienteId = tarefa?.pacienteId;
      alertaAtual =
        !!tarefa &&
        (tarefa.status === 'pendente' || tarefa.status === 'em_andamento') &&
        !!tarefa.vencimentoEm &&
        tarefa.vencimentoEm.getTime() < agora;
    } else if (partes.tipo === 'atendimento_proximo') {
      const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
        where: {
          id: partes.recursoId,
          tenantId,
          profissionalId: contexto.id
        }
      });
      pacienteId = consulta?.pacienteId;
      alertaAtual =
        !!consulta &&
        STATUS_CONSULTA_ATIVA.has(consulta.status) &&
        consulta.inicioEm.getTime() >= agora &&
        consulta.inicioEm <= this.calcularIntervalo('trinta_dias').fimEm;
    } else if (partes.tipo === 'formulario_pendente') {
      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({
        where: { id: partes.recursoId, tenantId }
      });
      pacienteId = envio?.pacienteId;
      alertaAtual = !!envio && envio.status === 'respondido' && !envio.revisadoEm;
    } else if (partes.tipo === 'solicitacao_pendente') {
      const solicitacao = await gerenciador.getRepository(AgendaSolicitacaoOrm).findOne({
        where: {
          id: partes.recursoId,
          tenantId,
          profissionalId: contexto.id
        }
      });
      alertaAtual =
        !!solicitacao &&
        solicitacao.status === 'pendente' &&
        solicitacao.expiraEm.getTime() > agora;
    } else if (partes.tipo === 'comunicacao_alerta') {
      const mensagem = await gerenciador.getRepository(MensagemNotificacaoOrm).findOne({
        where: { id: partes.recursoId, tenantId }
      });
      pacienteId = mensagem?.pacienteId;
      alertaAtual =
        !!mensagem && !!mensagem.pacienteId && STATUS_COMUNICACAO_ALERTA.has(mensagem.status);
    }

    if (pacienteId) {
      alertaAtual =
        alertaAtual &&
        (await this.pacientePertenceAoContexto(
          gerenciador,
          tenantId,
          contexto.id,
          pacienteId
        ));
    }

    if (!alertaAtual) {
      throw new BadRequestException('Alerta indisponivel para ocultacao.');
    }
  }

  private async pacientePertenceAoContexto(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string,
    pacienteId: string
  ): Promise<boolean> {
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, profissionalResponsavelId: profissionalId }
    });
    return (
      !!paciente &&
      !paciente.arquivadoEm &&
      !STATUS_PACIENTE_INATIVO.has(paciente.statusAdesao)
    );
  }

  private calcularNivelRisco(statusAdesao: string, scoreRisco: number): NivelRiscoDashboard {
    if (statusAdesao === 'risco' || scoreRisco >= 70) return 'alto';
    if (scoreRisco >= 40) return 'medio';
    return 'baixo';
  }

  private calcularFaixaSemRetorno(dias: number): FaixaSemRetorno {
    if (dias >= 90) return '90+';
    if (dias >= 60) return '60';
    return '30';
  }

  private pesoRisco(nivel: NivelRiscoDashboard): number {
    return nivel === 'alto' ? 3 : nivel === 'medio' ? 2 : 1;
  }

  private nomePaciente(pacientes: Map<string, PacienteOrm>, pacienteId: string): string {
    return this.criptografia.descriptografar(pacientes.get(pacienteId)!.nomeCriptografado);
  }

  private garantirPapelPermitido(usuario: UsuarioAutenticado): void {
    if (usuario.papel !== 'Professional' && usuario.papel !== 'SuperAdmin') {
      throw new ForbiddenException('Acesso restrito ao painel clinico.');
    }
  }

  private validarAlertaId(alertaId: string): {
    tipo: string;
    profissionalId: string;
    recursoId: string;
  } {
    if (!alertaId || alertaId.length > 240) {
      throw new BadRequestException('Alerta invalido.');
    }
    const [tipo, profissionalId, recursoId, ...excedente] = alertaId.split(':');
    if (
      excedente.length ||
      (!TIPOS_ALERTA_OCULTAVEIS.has(tipo) && tipo !== 'sem_retorno_risco_alto') ||
      !/^[a-zA-Z0-9-]+$/.test(profissionalId ?? '') ||
      !/^[a-zA-Z0-9-]+$/.test(recursoId ?? '')
    ) {
      throw new BadRequestException('Alerta invalido.');
    }
    return { tipo, profissionalId, recursoId };
  }
}
