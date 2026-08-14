import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { And, ArrayContains, EntityManager, FindOptionsWhere, In, IsNull, LessThan, MoreThanOrEqual, Not, QueryFailedError, Raw } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { montarCsv } from '../../../infraestrutura/exportacao/csv';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { registrarEventoWebhook } from '../../integracoes/aplicacao/registrar-evento-webhook';
import {
  calcularAntropometria,
  compararAvaliacoes,
  dataCivil,
  idadeNaData
} from '../dominio/antropometria';
import type { MedidasAntropometricas, ResultadoAntropometrico } from '../dominio/antropometria';
import {
  AtualizarPacienteDto,
  AtualizarTarefaAcompanhamentoDto,
  AvaliacaoAntropometricaRespostaDto,
  CriarAvaliacaoAntropometricaDto,
  CriarEvolucaoClinicaDto,
  SerieAntropometricaRespostaDto,
  CriarPacienteDto,
  CriarTarefaAcompanhamentoDto,
  EventoProntuarioPacienteDto,
  ListarLinhaTempoProntuarioDto,
  TipoEventoProntuarioPaciente,
  EvolucaoClinicaRespostaDto,
  PacienteRespostaDto,
  PaginaLinhaTempoProntuarioDto,
  ProntuarioPacienteRespostaDto,
  TarefaAcompanhamentoRespostaDto,
  ListarPacientesDto
} from './dtos';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { AvaliacaoAntropometricaOrm } from '../infraestrutura/avaliacao-antropometrica.orm';
import { EvolucaoClinicaOrm } from '../infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

/**
 * Teto de linhas por exportacao. Exportacao em massa de PHI e vetor de
 * exfiltracao: acima disto o caminho e o protocolo LGPD, nao um GET.
 */
export const LIMITE_LINHAS_EXPORTACAO = 5000;
const PAGINA_EXPORTACAO = 100;
const LIMITE_PADRAO_TIMELINE = 20;
const LIMITE_MAXIMO_TIMELINE = 50;
const CONSTRAINT_REFERENCIA_EXTERNA_PACIENTE = 'ux_pacientes_referencia_externa';

interface CursorTimeline {
  data: string;
  id: string;
}

interface LinhaTimelinePaginada {
  id: string;
  tipo: TipoEventoProntuarioPaciente;
  titulo: string;
  data: Date | string;
  status?: string | null;
  origemId?: string | null;
  origem?: string | null;
  responsavelId?: string | null;
  autorUsuarioId?: string | null;
  metadados?: Record<string, unknown> | null;
}

@Injectable()
export class ServicoPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly portalCliente: ServicoPortalCliente
  ) {}

  async criar(tenantId: string, dados: CriarPacienteDto, usuario: UsuarioAutenticado): Promise<PacienteRespostaDto> {
    const referenciaExterna = dados.referenciaExterna?.trim();
    if (referenciaExterna) {
      const existente = await this.executorTenant.executar(tenantId, (gerenciador) =>
        gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, referenciaExterna } })
      );
      if (existente) return this.mapearResposta(existente);
    }
    await this.garantirLimitePermitido(tenantId, 'pacientes');

    try {
      return await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(PacienteOrm);
        if (referenciaExterna) {
          const existente = await repositorio.findOne({ where: { tenantId, referenciaExterna } });
          if (existente) return this.mapearResposta(existente);
        }
        const profissionalResponsavelId =
          usuario.papel === 'Professional'
            ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
            : dados.profissionalResponsavelId;

        await this.garantirProfissionalResponsavelExiste(gerenciador, tenantId, profissionalResponsavelId);
        const paciente = repositorio.create({
          tenantId,
          profissionalResponsavelId,
          nomeCriptografado: this.criptografia.criptografar(dados.nome),
          contatoCriptografado: dados.contato ? this.criptografia.criptografar(dados.contato) : undefined,
          buscaHashes: this.criptografia.gerarHashesBuscaPii(tenantId, [dados.nome, dados.contato]),
          dataNascimento: dados.dataNascimento,
          referenciaExterna,
          statusAdesao: 'novo',
          scoreRisco: '0'
        });

        const salvo = await repositorio.save(paciente);
        await registrarEventoWebhook(gerenciador, tenantId, {
          evento: 'paciente.criado',
          recursoTipo: 'paciente',
          recursoId: salvo.id,
          dados: {
            pacienteId: salvo.id,
            profissionalResponsavelId: salvo.profissionalResponsavelId,
            referenciaExterna: salvo.referenciaExterna
          }
        });
        return this.mapearResposta(salvo);
      });
    } catch (erro) {
      if (!referenciaExterna || !this.ehConflitoReferenciaExterna(erro)) throw erro;
      const existente = await this.executorTenant.executar(tenantId, (gerenciador) =>
        gerenciador.getRepository(PacienteOrm).findOne({ where: { tenantId, referenciaExterna } })
      );
      if (!existente) throw erro;
      return this.mapearResposta(existente);
    }
  }

  private ehConflitoReferenciaExterna(erro: unknown): boolean {
    if (!(erro instanceof QueryFailedError)) return false;
    const postgres = erro.driverError as { code?: string; constraint?: string } | undefined;
    return postgres?.code === '23505' && postgres.constraint === CONSTRAINT_REFERENCIA_EXTERNA_PACIENTE;
  }

  async listar(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pagina = 1,
    limite = 25,
    filtros: ListarPacientesDto = new ListarPacientesDto()
  ): Promise<{ itens: PacienteRespostaDto[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const hashesBusca = filtros.busca?.trim()
        ? this.criptografia.gerarHashesConsultaPii(tenantId, filtros.busca)
        : undefined;
      if (filtros.busca?.trim() && !hashesBusca?.length) return { itens: [], total: 0 };

      const where = this.montarFiltrosListagem(
        tenantId,
        profissionalResponsavelId ?? filtros.profissionalId,
        filtros,
        hashesBusca
      );
      const [itens, total] = await gerenciador.getRepository(PacienteOrm).findAndCount({
        where,
        order: { criadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      const pacientesIds = itens.map((paciente) => paciente.id);
      const consultas = pacientesIds.length
        ? await gerenciador.getRepository(AgendaConsultaOrm).find({
            where: { tenantId, pacienteId: In(pacientesIds) },
            order: { inicioEm: 'DESC' }
          })
        : [];
      const resumoConsultas = this.resumirConsultasPorPaciente(consultas);

      return {
        itens: itens.map((paciente) => this.mapearResposta(paciente, resumoConsultas.get(paciente.id))),
        total
      };
    });
  }

  async listarArquivados(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pagina = 1,
    limite = 25
  ): Promise<{ itens: PacienteRespostaDto[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const [itens, total] = await gerenciador.getRepository(PacienteOrm).findAndCount({
        where: {
          tenantId,
          arquivadoEm: Not(IsNull()),
          ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
        },
        order: { arquivadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      return { itens: itens.map((paciente) => this.mapearResposta(paciente)), total };
    });
  }

  /**
   * Exportacao da carteira em CSV.
   *
   * Pagina a propria `listar` de proposito: o escopo por profissional, o filtro
   * e a busca ja moram la, e uma consulta paralela so para exportar seria a
   * segunda chance de vazar paciente de outro profissional.
   */
  async exportarCsv(
    tenantId: string,
    usuario: UsuarioAutenticado,
    filtros: ListarPacientesDto = new ListarPacientesDto()
  ): Promise<string> {
    const linhas: unknown[][] = [];

    for (let pagina = 1; linhas.length < LIMITE_LINHAS_EXPORTACAO; pagina += 1) {
      const { itens } = await this.listar(tenantId, usuario, pagina, PAGINA_EXPORTACAO, filtros);
      if (!itens.length) break;

      for (const paciente of itens) {
        if (linhas.length >= LIMITE_LINHAS_EXPORTACAO) break;
        linhas.push([
          paciente.id,
          paciente.nome,
          paciente.contato ?? '',
          paciente.dataNascimento ?? '',
          paciente.statusAdesao,
          paciente.scoreRisco,
          paciente.profissionalResponsavelId,
          this.serializarData(paciente.ultimaConsultaConcluidaEm),
          this.serializarData(paciente.proximaConsultaEm),
          this.serializarData(paciente.ultimoCheckinEm),
          this.serializarData(paciente.criadoEm)
        ]);
      }
      if (itens.length < PAGINA_EXPORTACAO) break;
    }

    return montarCsv(
      [
        'id',
        'nome',
        'contato',
        'dataNascimento',
        'statusAdesao',
        'scoreRisco',
        'profissionalResponsavelId',
        'ultimaConsultaConcluidaEm',
        'proximaConsultaEm',
        'ultimoCheckinEm',
        'criadoEm'
      ],
      linhas
    );
  }

  private serializarData(valor?: Date | string): string {
    if (!valor) return '';
    return valor instanceof Date ? valor.toISOString() : valor;
  }

  async obterPorId(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      return this.mapearResposta(paciente);
    });
  }

  async atualizar(
    tenantId: string,
    pacienteId: string,
    dados: AtualizarPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteExiste(
        gerenciador,
        tenantId,
        pacienteId,
        usuario,
        dados.profissionalResponsavelId !== undefined
      );
      const repositorio = gerenciador.getRepository(PacienteOrm);

      if (dados.profissionalResponsavelId) {
        if (usuario.papel === 'Professional') {
          throw new ForbiddenException('Profissional nao pode reatribuir o paciente para outro profissional.');
        }
        await this.garantirProfissionalResponsavelExiste(gerenciador, tenantId, dados.profissionalResponsavelId);
        paciente.profissionalResponsavelId = dados.profissionalResponsavelId;
      }
      if (dados.nome) paciente.nomeCriptografado = this.criptografia.criptografar(dados.nome);
      if (dados.contato) paciente.contatoCriptografado = this.criptografia.criptografar(dados.contato);
      if (dados.nome || dados.contato) {
        paciente.buscaHashes = this.criptografia.gerarHashesBuscaPii(tenantId, [
          dados.nome ?? this.criptografia.descriptografar(paciente.nomeCriptografado),
          dados.contato ?? this.mapearContato(paciente)
        ]);
      }
      if (dados.dataNascimento) paciente.dataNascimento = dados.dataNascimento;
      if (dados.statusAdesao) paciente.statusAdesao = dados.statusAdesao;
      if (dados.scoreRisco !== undefined) paciente.scoreRisco = String(dados.scoreRisco);

      return this.mapearResposta(await repositorio.save(paciente));
    });
  }

  async arquivar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const resultado = await gerenciador.getRepository(PacienteOrm).update(
        {
          id: pacienteId,
          tenantId,
          arquivadoEm: IsNull(),
          ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
        },
        { arquivadoEm: new Date() }
      );

      if (!resultado.affected) {
        throw new NotFoundException('Paciente nao encontrado.');
      }
    });
  }

  async restaurar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.garantirLimitePermitido(tenantId, 'pacientes');
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const resultado = await gerenciador.getRepository(PacienteOrm).update(
        {
          id: pacienteId,
          tenantId,
          arquivadoEm: Not(IsNull()),
          ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
        },
        { arquivadoEm: null }
      );
      if (!resultado.affected) throw new NotFoundException('Paciente arquivado nao encontrado.');
    });
  }

  private mapearResposta(
    paciente: PacienteOrm,
    resumoConsultas?: { ultimaConsultaConcluidaEm?: Date; proximaConsultaEm?: Date }
  ): PacienteRespostaDto {
    return {
      id: paciente.id,
      tenantId: paciente.tenantId,
      usuarioId: paciente.usuarioId,
      profissionalResponsavelId: paciente.profissionalResponsavelId,
      nome: this.criptografia.descriptografar(paciente.nomeCriptografado),
      contato: this.mapearContato(paciente),
      dataNascimento: paciente.dataNascimento,
      referenciaExterna: paciente.referenciaExterna,
      statusAdesao: paciente.statusAdesao,
      scoreRisco: paciente.scoreRisco,
      ultimoCheckinEm: paciente.ultimoCheckinEm,
      ultimaConsultaConcluidaEm: resumoConsultas?.ultimaConsultaConcluidaEm,
      proximaConsultaEm: resumoConsultas?.proximaConsultaEm,
      arquivadoEm: paciente.arquivadoEm,
      criadoEm: paciente.criadoEm,
      atualizadoEm: paciente.atualizadoEm
    };
  }

  private montarFiltrosListagem(
    tenantId: string,
    profissionalResponsavelId: string | undefined,
    filtros: ListarPacientesDto,
    hashesBusca?: string[]
  ): FindOptionsWhere<PacienteOrm> | FindOptionsWhere<PacienteOrm>[] {
    const base: FindOptionsWhere<PacienteOrm> = {
      tenantId,
      arquivadoEm: IsNull(),
      ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}),
      ...(filtros.status ? { statusAdesao: filtros.status } : {}),
      ...(hashesBusca?.length ? { buscaHashes: ArrayContains(hashesBusca) } : {}),
      ...(filtros.semProximaConsulta
        ? {
            id: Raw(
              (alias) => `NOT EXISTS (
                SELECT 1 FROM agenda_consultas consulta
                WHERE consulta.paciente_id = ${alias}
                  AND consulta.tenant_id = :tenantBusca
                  AND consulta.status IN ('agendada', 'reagendada')
                  AND consulta.inicio_em >= NOW()
              )`,
              { tenantBusca: tenantId }
            )
          }
        : {})
    };

    if (filtros.risco === 'alto') {
      if (filtros.status) {
        return filtros.status === 'risco' ? base : { ...base, scoreRisco: MoreThanOrEqual('70') };
      }
      return [{ ...base, statusAdesao: 'risco' }, { ...base, scoreRisco: MoreThanOrEqual('70') }];
    }
    if (filtros.risco === 'medio') {
      return { ...base, statusAdesao: filtros.status ?? Not('risco'), scoreRisco: And(MoreThanOrEqual('40'), LessThan('70')) };
    }
    if (filtros.risco === 'baixo') {
      return { ...base, statusAdesao: filtros.status ?? Not('risco'), scoreRisco: LessThan('40') };
    }
    return base;
  }

  private resumirConsultasPorPaciente(consultas: AgendaConsultaOrm[]) {
    const agora = new Date();
    const resumo = new Map<string, { ultimaConsultaConcluidaEm?: Date; proximaConsultaEm?: Date }>();

    for (const consulta of consultas) {
      const atual = resumo.get(consulta.pacienteId) ?? {};
      if (consulta.status === 'concluida' && !atual.ultimaConsultaConcluidaEm) {
        atual.ultimaConsultaConcluidaEm = consulta.inicioEm;
      }
      if (
        (consulta.status === 'agendada' || consulta.status === 'reagendada') &&
        consulta.inicioEm >= agora &&
        (!atual.proximaConsultaEm || consulta.inicioEm < atual.proximaConsultaEm)
      ) {
        atual.proximaConsultaEm = consulta.inicioEm;
      }
      resumo.set(consulta.pacienteId, atual);
    }

    return resumo;
  }

  async criarEvolucaoClinica(
    tenantId: string,
    pacienteId: string,
    autorUsuarioId: string,
    dados: CriarEvolucaoClinicaDto,
    usuario: UsuarioAutenticado
  ): Promise<EvolucaoClinicaRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);

      const repositorio = gerenciador.getRepository(EvolucaoClinicaOrm);
      const evolucao = repositorio.create({
        tenantId,
        pacienteId,
        autorUsuarioId,
        titulo: dados.titulo.trim(),
        conteudoCriptografado: this.criptografia.criptografar(dados.conteudo.trim()),
        tipo: dados.tipo ?? 'observacao',
        visibilidade: dados.visibilidade ?? 'privada'
      });

      return this.mapearEvolucao(await repositorio.save(evolucao));
    });
  }

  async listarEvolucoesClinicas(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<EvolucaoClinicaRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const evolucoes = await gerenciador.getRepository(EvolucaoClinicaOrm).find({
        where: { tenantId, pacienteId },
        order: { criadoEm: 'DESC' },
        take: 50
      });

      return evolucoes.map((evolucao) => this.mapearEvolucao(evolucao));
    });
  }

  async criarTarefaAcompanhamento(
    tenantId: string,
    pacienteId: string,
    profissionalId: string,
    dados: CriarTarefaAcompanhamentoDto,
    usuario: UsuarioAutenticado
  ): Promise<TarefaAcompanhamentoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);

      const repositorio = gerenciador.getRepository(AcompanhamentoTarefaOrm);
      const tarefa = repositorio.create({
        tenantId,
        pacienteId,
        profissionalId,
        titulo: dados.titulo.trim(),
        descricaoCriptografada: dados.descricao?.trim() ? this.criptografia.criptografar(dados.descricao.trim()) : undefined,
        categoria: dados.categoria ?? 'tarefa',
        prioridade: dados.prioridade ?? 'media',
        status: 'pendente',
        vencimentoEm: dados.vencimentoEm ? new Date(dados.vencimentoEm) : undefined
      });

      return this.mapearTarefa(await repositorio.save(tarefa));
    });
  }

  async listarTarefasAcompanhamento(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<TarefaAcompanhamentoRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const tarefas = await gerenciador.getRepository(AcompanhamentoTarefaOrm).find({
        where: { tenantId, pacienteId },
        order: { vencimentoEm: 'ASC', criadoEm: 'DESC' },
        take: 100
      });

      return tarefas.map((tarefa) => this.mapearTarefa(tarefa));
    });
  }

  async atualizarTarefaAcompanhamento(
    tenantId: string,
    pacienteId: string,
    tarefaId: string,
    dados: AtualizarTarefaAcompanhamentoDto,
    usuario: UsuarioAutenticado
  ): Promise<TarefaAcompanhamentoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(AcompanhamentoTarefaOrm);
      const tarefa = await repositorio.findOne({ where: { id: tarefaId, tenantId, pacienteId } });

      if (!tarefa) {
        throw new NotFoundException('Tarefa de acompanhamento nao encontrada.');
      }

      if (dados.status) {
        tarefa.status = dados.status;
        tarefa.concluidoEm = dados.status === 'concluida' ? new Date() : undefined;
      }

      return this.mapearTarefa(await repositorio.save(tarefa));
    });
  }

  async obterProntuario(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<ProntuarioPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteOrm = await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);

      const [consultas, envios, respostas, diarios, mensagens, evolucoes, tarefas] = await Promise.all([
        gerenciador.getRepository(AgendaConsultaOrm).find({
          where: { tenantId, pacienteId },
          order: { inicioEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(EnvioQuestionarioOrm).find({
          where: { tenantId, pacienteId },
          order: { enviadoEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(RespostaCheckinOrm).find({
          where: { tenantId, pacienteId },
          order: { finalizadoEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(LogDiarioRapidoOrm).find({
          where: { tenantId, pacienteId },
          order: { registradoEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(MensagemNotificacaoOrm).find({
          where: { tenantId, pacienteId },
          order: { criadoEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(EvolucaoClinicaOrm).find({
          where: { tenantId, pacienteId },
          order: { criadoEm: 'DESC' },
          take: 50
        }),
        gerenciador.getRepository(AcompanhamentoTarefaOrm).find({
          where: { tenantId, pacienteId },
          order: { vencimentoEm: 'ASC', criadoEm: 'DESC' },
          take: 100
        })
      ]);

      const idsQuestionarios = Array.from(new Set(envios.map((envio) => envio.questionarioId).filter(Boolean)));
      const questionarios = idsQuestionarios.length
        ? await gerenciador.getRepository(QuestionarioOrm).find({ where: { tenantId, id: In(idsQuestionarios) } })
        : [];
      const questionariosPorId = new Map(questionarios.map((questionario) => [questionario.id, questionario]));
      const enviosPorId = new Map(envios.map((envio) => [envio.id, envio]));

      const linhaDoTempo = [
        ...consultas.map((consulta) => this.mapearEventoConsulta(consulta)),
        ...envios.map((envio) => this.mapearEventoEnvioQuestionario(envio, questionariosPorId.get(envio.questionarioId)?.titulo)),
        ...respostas.map((resposta) =>
          this.mapearEventoRespostaQuestionario(
            resposta,
            questionariosPorId.get(enviosPorId.get(resposta.envioQuestionarioId)?.questionarioId ?? '')?.titulo
          )
        ),
        ...diarios.map((diario) => this.mapearEventoCheckinRapido(diario)),
        ...mensagens.map((mensagem) => this.mapearEventoMensagem(mensagem)),
        ...evolucoes.map((evolucao) => this.mapearEventoEvolucao(evolucao)),
        ...tarefas.map((tarefa) => this.mapearEventoTarefa(tarefa))
      ]
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, 80);

      return {
        paciente: this.mapearResposta(pacienteOrm),
        resumo: {
          consultas: consultas.length,
          formulariosPendentes: envios.filter((envio) => envio.status === 'pendente' || envio.status === 'enviado').length,
          respostas: respostas.length,
          checkinsRapidos: diarios.length,
          mensagens: mensagens.length,
          evolucoes: evolucoes.length,
          tarefasPendentes: tarefas.filter((tarefa) => tarefa.status === 'pendente' || tarefa.status === 'em_andamento').length,
          ultimoEventoEm: linhaDoTempo[0]?.data
        },
        linhaDoTempo
      };
    });
  }

  async listarLinhaDoTempoPaginada(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    filtros: ListarLinhaTempoProntuarioDto = new ListarLinhaTempoProntuarioDto()
  ): Promise<PaginaLinhaTempoProntuarioDto> {
    const limite = filtros.limite ?? LIMITE_PADRAO_TIMELINE;
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO_TIMELINE) {
      throw new BadRequestException(`O limite da timeline deve estar entre 1 e ${LIMITE_MAXIMO_TIMELINE}.`);
    }
    const cursorDecodificado = filtros.cursor ? this.decodificarCursorTimeline(filtros.cursor) : undefined;
    const inicio = filtros.inicio ? new Date(filtros.inicio) : undefined;
    const fim = filtros.fim ? new Date(filtros.fim) : undefined;
    if (inicio && fim && inicio > fim) {
      throw new BadRequestException('A data inicial da timeline deve ser anterior a data final.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const linhas = await gerenciador.query<LinhaTimelinePaginada[]>(`
        WITH contexto AS (
          SELECT profissional_responsavel_id, usuario_id
          FROM pacientes
          WHERE tenant_id = $1 AND id = $2
        ), timeline AS (
          SELECT consulta.id::text AS id, 'consulta'::text AS tipo, consulta.titulo,
            consulta.inicio_em AS data, consulta.status, consulta.id AS "origemId",
            'Agenda'::text AS origem,
            COALESCE(consulta.profissional_id, contexto.profissional_responsavel_id) AS "responsavelId",
            NULL::uuid AS "autorUsuarioId",
            jsonb_build_object('fimEm', consulta.fim_em) AS metadados
          FROM agenda_consultas consulta CROSS JOIN contexto
          WHERE consulta.tenant_id = $1 AND consulta.paciente_id = $2
          UNION ALL
          SELECT envio.id::text, 'formulario'::text, 'Formulario',
            COALESCE(envio.enviado_em, envio.expira_em, 'epoch'::timestamptz), envio.status,
            envio.questionario_id, 'Formularios',
            COALESCE(questionario.profissional_id, contexto.profissional_responsavel_id), NULL::uuid,
            jsonb_build_object('envioQuestionarioId', envio.id, 'expiraEm', envio.expira_em)
          FROM envios_questionario envio
          LEFT JOIN questionarios questionario
            ON questionario.tenant_id = envio.tenant_id AND questionario.id = envio.questionario_id
          CROSS JOIN contexto
          WHERE envio.tenant_id = $1 AND envio.paciente_id = $2
          UNION ALL
          SELECT resposta.id::text, 'resposta_formulario'::text, 'Resposta de formulario',
            COALESCE(resposta.finalizado_em, resposta.criado_em),
            CASE WHEN resposta.finalizado_em IS NULL THEN 'em_andamento' ELSE 'finalizado' END,
            resposta.envio_questionario_id, 'Formularios',
            COALESCE(questionario.profissional_id, contexto.profissional_responsavel_id), contexto.usuario_id,
            jsonb_build_object('envioQuestionarioId', resposta.envio_questionario_id)
          FROM respostas_checkin resposta
          LEFT JOIN envios_questionario envio
            ON envio.tenant_id = resposta.tenant_id AND envio.id = resposta.envio_questionario_id
          LEFT JOIN questionarios questionario
            ON questionario.tenant_id = resposta.tenant_id AND questionario.id = envio.questionario_id
          CROSS JOIN contexto
          WHERE resposta.tenant_id = $1 AND resposta.paciente_id = $2
          UNION ALL
          SELECT diario.id::text, 'checkin_rapido'::text, 'Check-in rapido', diario.registrado_em,
            'registrado', diario.id, 'Portal do paciente', contexto.profissional_responsavel_id,
            contexto.usuario_id, jsonb_build_object('tipoDiario', diario.tipo)
          FROM logs_diario_rapido diario CROSS JOIN contexto
          WHERE diario.tenant_id = $1 AND diario.paciente_id = $2
          UNION ALL
          SELECT mensagem.id::text, 'mensagem'::text,
            CASE WHEN mensagem.status = 'recebido' THEN 'Mensagem recebida' ELSE 'Mensagem' END,
            COALESCE(mensagem.enviado_em, mensagem.criado_em), mensagem.status, mensagem.id,
            'Comunicacoes', contexto.profissional_responsavel_id,
            CASE WHEN mensagem.status = 'recebido' THEN contexto.usuario_id ELSE NULL::uuid END,
            '{}'::jsonb
          FROM mensagens_notificacao mensagem CROSS JOIN contexto
          WHERE mensagem.tenant_id = $1 AND mensagem.paciente_id = $2
          UNION ALL
          SELECT evolucao.id::text, 'evolucao_clinica'::text, evolucao.titulo,
            evolucao.criado_em, evolucao.tipo, evolucao.id, 'Prontuario',
            COALESCE(profissional.id, contexto.profissional_responsavel_id), evolucao.autor_usuario_id,
            jsonb_build_object('visibilidade', evolucao.visibilidade)
          FROM evolucoes_clinicas evolucao
          LEFT JOIN profissionais profissional
            ON profissional.tenant_id = evolucao.tenant_id
            AND profissional.usuario_id = evolucao.autor_usuario_id
            AND profissional.arquivado_em IS NULL
          CROSS JOIN contexto
          WHERE evolucao.tenant_id = $1 AND evolucao.paciente_id = $2
          UNION ALL
          SELECT tarefa.id::text, 'tarefa_acompanhamento'::text, tarefa.titulo,
            COALESCE(tarefa.vencimento_em, tarefa.criado_em), tarefa.status, tarefa.id,
            'Acompanhamento', COALESCE(tarefa.profissional_id, contexto.profissional_responsavel_id),
            NULL::uuid,
            jsonb_build_object('categoria', tarefa.categoria, 'prioridade', tarefa.prioridade, 'concluidoEm', tarefa.concluido_em)
          FROM acompanhamento_tarefas tarefa CROSS JOIN contexto
          WHERE tarefa.tenant_id = $1 AND tarefa.paciente_id = $2
          UNION ALL
          SELECT versao.id::text, 'plano_alimentar_publicado'::text,
            'Plano alimentar publicado', versao.publicada_em, 'publicado', plano.id,
            'Plano alimentar', COALESCE(plano.profissional_id, contexto.profissional_responsavel_id),
            COALESCE(versao.revisada_por_usuario_id, versao.criado_por_usuario_id),
            jsonb_build_object('planoId', plano.id, 'versaoId', versao.id, 'numeroVersao', versao.numero)
          FROM plano_alimentar_versoes versao
          INNER JOIN planos_alimentares plano
            ON plano.tenant_id = versao.tenant_id AND plano.id = versao.plano_id
          CROSS JOIN contexto
          WHERE versao.tenant_id = $1 AND plano.paciente_id = $2
            AND versao.publicada_em IS NOT NULL AND $9::boolean
          UNION ALL
          SELECT avaliacao.id::text, 'avaliacao_antropometrica'::text,
            'Avaliacao antropometrica', avaliacao.avaliada_em::timestamptz,
            CASE WHEN avaliacao.excluida_em IS NULL THEN 'registrada' ELSE 'excluida' END,
            avaliacao.id, 'Antropometria',
            COALESCE(profissional.id, contexto.profissional_responsavel_id), avaliacao.autor_usuario_id,
            jsonb_build_object('protocolo', avaliacao.protocolo)
          FROM avaliacoes_antropometricas avaliacao
          LEFT JOIN profissionais profissional
            ON profissional.tenant_id = avaliacao.tenant_id
            AND profissional.usuario_id = avaliacao.autor_usuario_id
            AND profissional.arquivado_em IS NULL
          CROSS JOIN contexto
          WHERE avaliacao.tenant_id = $1 AND avaliacao.paciente_id = $2
          UNION ALL
          SELECT documento.id::text, 'documento_emitido'::text, documento.titulo,
            documento.emitido_em,
            CASE WHEN documento.cancelado_em IS NULL THEN 'emitido' ELSE 'cancelado' END,
            documento.id, 'Documentos',
            COALESCE(documento.profissional_id, profissional.id, contexto.profissional_responsavel_id),
            documento.autor_usuario_id,
            jsonb_build_object('tipoDocumento', documento.tipo, 'consultaId', documento.consulta_id, 'enviadoEm', documento.enviado_em)
          FROM documentos_emitidos documento
          LEFT JOIN profissionais profissional
            ON profissional.tenant_id = documento.tenant_id
            AND profissional.usuario_id = documento.autor_usuario_id
            AND profissional.arquivado_em IS NULL
          CROSS JOIN contexto
          WHERE documento.tenant_id = $1 AND documento.paciente_id = $2
          UNION ALL
          SELECT arquivo.id::text, 'anexo_confirmado'::text, 'Anexo clinico confirmado',
            arquivo.confirmado_em, 'confirmado', arquivo.id, 'Anexos',
            contexto.profissional_responsavel_id, NULL::uuid,
            jsonb_build_object('categoria', arquivo.categoria, 'tipoMidia', arquivo.tipo, 'mimeType', arquivo.mime_type)
          FROM arquivos_midia arquivo CROSS JOIN contexto
          WHERE arquivo.tenant_id = $1 AND arquivo.paciente_id = $2
            AND arquivo.status = 'confirmado' AND arquivo.confirmado_em IS NOT NULL
          UNION ALL
          SELECT coleta.id::text, 'exame_laboratorial'::text, 'Coleta de exames laboratoriais',
            coleta.coletada_em::timestamptz,
            CASE WHEN coleta.excluida_em IS NULL THEN 'registrada' ELSE 'excluida' END,
            coleta.id, 'Exames laboratoriais',
            COALESCE(profissional.id, contexto.profissional_responsavel_id), coleta.autor_usuario_id,
            jsonb_build_object('recebidaEm', coleta.recebida_em)
          FROM coletas_exames_laboratoriais coleta
          LEFT JOIN profissionais profissional
            ON profissional.tenant_id = coleta.tenant_id
            AND profissional.usuario_id = coleta.autor_usuario_id
            AND profissional.arquivado_em IS NULL
          CROSS JOIN contexto
          WHERE coleta.tenant_id = $1 AND coleta.paciente_id = $2
          UNION ALL
          SELECT fotografia.id::text, 'evolucao_fotografica'::text, 'Serie fotografica clinica',
            fotografia.capturada_em::timestamptz,
            CASE WHEN fotografia.excluida_em IS NULL THEN 'registrada' ELSE 'excluida' END,
            fotografia.id, 'Evolucao fotografica',
            COALESCE(profissional.id, contexto.profissional_responsavel_id), fotografia.autor_usuario_id,
            '{}'::jsonb
          FROM evolucoes_fotograficas fotografia
          LEFT JOIN profissionais profissional
            ON profissional.tenant_id = fotografia.tenant_id
            AND profissional.usuario_id = fotografia.autor_usuario_id
            AND profissional.arquivado_em IS NULL
          CROSS JOIN contexto
          WHERE fotografia.tenant_id = $1 AND fotografia.paciente_id = $2
          UNION ALL
          SELECT ('consulta-pagamento:' || consulta.id::text), 'evento_financeiro'::text,
            'Pagamento de consulta', consulta.pago_em, consulta.status_pagamento, consulta.id,
            'Financeiro', COALESCE(consulta.profissional_id, contexto.profissional_responsavel_id),
            NULL::uuid,
            jsonb_build_object('natureza', 'consulta', 'valorCentavos', consulta.valor_centavos, 'formaPagamento', consulta.forma_pagamento)
          FROM agenda_consultas consulta CROSS JOIN contexto
          WHERE consulta.tenant_id = $1 AND consulta.paciente_id = $2
            AND consulta.pago_em IS NOT NULL AND $10::boolean
          UNION ALL
          SELECT ('pacote-pagamento:' || pacote.id::text), 'evento_financeiro'::text,
            'Pagamento de pacote', pacote.pago_em, pacote.status_pagamento, pacote.id,
            'Financeiro', COALESCE(pacote.profissional_id, contexto.profissional_responsavel_id),
            NULL::uuid,
            jsonb_build_object('natureza', 'pacote', 'valorCentavos', pacote.valor_total_centavos, 'formaPagamento', pacote.forma_pagamento, 'canceladoEm', pacote.cancelado_em)
          FROM pacotes_sessao pacote CROSS JOIN contexto
          WHERE pacote.tenant_id = $1 AND pacote.paciente_id = $2
            AND pacote.pago_em IS NOT NULL AND $10::boolean
        )
        SELECT * FROM timeline
        WHERE ($3::timestamptz IS NULL
          OR data < $3::timestamptz
          OR (data = $3::timestamptz AND id < $4::text))
          AND ($5::text IS NULL OR tipo = $5::text)
          AND ($6::timestamptz IS NULL OR data >= $6::timestamptz)
          AND ($7::timestamptz IS NULL OR data <= $7::timestamptz)
          AND ($8::uuid IS NULL OR "responsavelId" = $8::uuid)
        ORDER BY data DESC, id DESC
        LIMIT $11
      `, [
        tenantId,
        pacienteId,
        cursorDecodificado?.data ?? null,
        cursorDecodificado?.id ?? null,
        filtros.tipo ?? null,
        inicio?.toISOString() ?? null,
        fim?.toISOString() ?? null,
        filtros.responsavelId ?? null,
        usuario.permissoes.includes('planos_alimentares.ler'),
        usuario.permissoes.includes('agenda.financeiro.ler'),
        limite + 1
      ]);

      const itens = linhas.slice(0, limite).map((linha) => ({
        id: linha.id,
        tipo: linha.tipo,
        titulo: linha.titulo,
        data: new Date(linha.data),
        status: linha.status ?? undefined,
        origemId: linha.origemId ?? undefined,
        origem: linha.origem ?? undefined,
        responsavelId: linha.responsavelId ?? undefined,
        autorUsuarioId: linha.autorUsuarioId ?? undefined,
        metadados: linha.metadados ?? undefined
      }));
      const ultimo = itens.at(-1);
      return {
        itens,
        proximoCursor: linhas.length > limite && ultimo
          ? this.codificarCursorTimeline({ data: ultimo.data.toISOString(), id: ultimo.id })
          : undefined
      };
    });
  }

  private async garantirLimitePermitido(tenantId: string, recurso: 'pacientes') {
    const limite = await this.portalCliente.checarLimite(tenantId, recurso);
    if (!limite.permitido) {
      throw new ForbiddenException(limite.mensagem ?? 'Limite do plano atingido para esta acao.');
    }
  }

  /**
   * Avaliacao antropometrica. Append-only: o calculo e feito uma vez, na hora,
   * e gravado junto com o protocolo, a formula, o sexo e a idade usados. Ler o
   * historico nunca recalcula — se o dominio mudar amanha, o registro antigo
   * continua mostrando o numero que o profissional viu e assinou.
   */
  async registrarAvaliacaoAntropometrica(
    tenantId: string,
    pacienteId: string,
    autorUsuarioId: string,
    dados: CriarAvaliacaoAntropometricaDto,
    usuario: UsuarioAutenticado
  ): Promise<AvaliacaoAntropometricaRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);

      const avaliadaEm = dados.avaliadaEm ?? dataCivil(new Date());
      const protocolo = dados.protocolo ?? 'nenhum';
      const idadeAnos = idadeNaData(paciente.dataNascimento, avaliadaEm);
      const medidas: MedidasAntropometricas = {
        pesoKg: dados.pesoKg,
        alturaCm: dados.alturaCm,
        circunferencias: dados.circunferencias,
        dobras: dados.dobras
      };
      const resultado = calcularAntropometria({ medidas, protocolo, sexo: dados.sexo, idadeAnos });

      const repositorio = gerenciador.getRepository(AvaliacaoAntropometricaOrm);
      const avaliacao = await repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId,
          autorUsuarioId,
          avaliadaEm,
          protocolo: resultado.protocoloAplicado,
          sexo: dados.sexo,
          idadeAnos,
          medidasCriptografadas: this.criptografia.criptografar(JSON.stringify(medidas)),
          resultadoCriptografado: this.criptografia.criptografar(JSON.stringify(resultado)),
          formulaAplicada: resultado.formulaAplicada,
          observacoesCriptografadas: dados.observacoes?.trim()
            ? this.criptografia.criptografar(dados.observacoes.trim())
            : undefined
        })
      );

      return this.mapearAvaliacaoAntropometrica(avaliacao);
    });
  }

  async listarAvaliacoesAntropometricas(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<SerieAntropometricaRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const registros = await gerenciador.getRepository(AvaliacaoAntropometricaOrm).find({
        where: { tenantId, pacienteId, excluidaEm: IsNull() },
        order: { avaliadaEm: 'DESC', criadoEm: 'DESC' },
        take: 100
      });

      const avaliacoes = registros.map((registro) => this.mapearAvaliacaoAntropometrica(registro));
      const [atual, anterior] = avaliacoes;
      const deltaUltimas =
        atual && anterior
          ? compararAvaliacoes(
              { ...anterior.resultado, pesoKg: anterior.medidas.pesoKg },
              { ...atual.resultado, pesoKg: atual.medidas.pesoKg }
            )
          : [];

      return { avaliacoes, deltaUltimas };
    });
  }

  /** Exclusao logica: registro errado sai da serie sem sumir do banco. */
  async excluirAvaliacaoAntropometrica(
    tenantId: string,
    pacienteId: string,
    avaliacaoId: string,
    usuario: UsuarioAutenticado
  ): Promise<{ id: string }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(AvaliacaoAntropometricaOrm);
      const avaliacao = await repositorio.findOne({
        where: { id: avaliacaoId, tenantId, pacienteId, excluidaEm: IsNull() }
      });
      if (!avaliacao) throw new NotFoundException('Avaliacao antropometrica nao encontrada.');

      avaliacao.excluidaEm = new Date();
      await repositorio.save(avaliacao);
      return { id: avaliacao.id };
    });
  }

  private mapearAvaliacaoAntropometrica(
    avaliacao: AvaliacaoAntropometricaOrm
  ): AvaliacaoAntropometricaRespostaDto {
    return {
      id: avaliacao.id,
      pacienteId: avaliacao.pacienteId,
      avaliadaEm: avaliacao.avaliadaEm,
      protocolo: avaliacao.protocolo,
      sexo: avaliacao.sexo,
      idadeAnos: avaliacao.idadeAnos,
      medidas: this.lerJsonCriptografado<MedidasAntropometricas>(avaliacao.medidasCriptografadas, {}),
      resultado: this.lerJsonCriptografado<ResultadoAntropometrico>(avaliacao.resultadoCriptografado, {
        protocoloAplicado: 'nenhum',
        avisos: ['registro_ilegivel']
      }),
      formulaAplicada: avaliacao.formulaAplicada,
      observacoes: avaliacao.observacoesCriptografadas
        ? this.criptografia.descriptografar(avaliacao.observacoesCriptografadas)
        : undefined,
      criadoEm: avaliacao.criadoEm
    };
  }

  /**
   * Falha de descriptografia nao pode virar avaliacao vazia parecendo cadastro
   * incompleto: devolve o padrao com aviso explicito de registro ilegivel.
   */
  private lerJsonCriptografado<T>(conteudo: Buffer, padrao: T): T {
    try {
      return JSON.parse(this.criptografia.descriptografar(conteudo)) as T;
    } catch {
      return padrao;
    }
  }

  private async garantirPacienteExiste(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    bloquear = false
  ) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });

    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    return paciente;
  }

  private async garantirProfissionalResponsavelExiste(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalResponsavelId?: string
  ) {
    if (!profissionalResponsavelId) return;

    const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { id: profissionalResponsavelId, tenantId, arquivadoEm: IsNull() }
    });

    if (!profissional) {
      throw new NotFoundException('Profissional responsavel nao encontrado.');
    }
  }

  private mapearEvolucao(evolucao: EvolucaoClinicaOrm): EvolucaoClinicaRespostaDto {
    return {
      id: evolucao.id,
      tenantId: evolucao.tenantId,
      pacienteId: evolucao.pacienteId,
      autorUsuarioId: evolucao.autorUsuarioId,
      titulo: evolucao.titulo,
      conteudo: this.criptografia.descriptografar(evolucao.conteudoCriptografado),
      tipo: evolucao.tipo,
      visibilidade: evolucao.visibilidade,
      criadoEm: evolucao.criadoEm,
      atualizadoEm: evolucao.atualizadoEm
    };
  }

  private mapearTarefa(tarefa: AcompanhamentoTarefaOrm): TarefaAcompanhamentoRespostaDto {
    return {
      id: tarefa.id,
      tenantId: tarefa.tenantId,
      pacienteId: tarefa.pacienteId,
      profissionalId: tarefa.profissionalId,
      titulo: tarefa.titulo,
      descricao: tarefa.descricaoCriptografada ? this.criptografia.descriptografar(tarefa.descricaoCriptografada) : undefined,
      categoria: tarefa.categoria,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      vencimentoEm: tarefa.vencimentoEm,
      concluidoEm: tarefa.concluidoEm,
      criadoEm: tarefa.criadoEm,
      atualizadoEm: tarefa.atualizadoEm
    };
  }

  private mapearContato(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    try {
      const estruturado = JSON.parse(contato) as { email?: unknown; whatsapp?: unknown };
      if (typeof estruturado.email === 'string' && estruturado.email.trim()) return estruturado.email.trim().toLowerCase();
      if (typeof estruturado.whatsapp === 'string' && estruturado.whatsapp.trim()) return estruturado.whatsapp.replace(/\D/g, '');
      return undefined;
    } catch {
      return contato;
    }
  }

  private codificarCursorTimeline(cursor: CursorTimeline): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodificarCursorTimeline(cursor: string): CursorTimeline {
    try {
      const decodificado = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorTimeline>;
      if (typeof decodificado.data !== 'string' || Number.isNaN(new Date(decodificado.data).getTime())) throw new Error('data');
      if (
        typeof decodificado.id !== 'string'
        || decodificado.id.length < 1
        || decodificado.id.length > 128
        || !/^[A-Za-z0-9:_-]+$/.test(decodificado.id)
      ) {
        throw new Error('id');
      }
      return { data: new Date(decodificado.data).toISOString(), id: decodificado.id };
    } catch {
      throw new BadRequestException('Cursor da timeline invalido.');
    }
  }

  private mapearEventoConsulta(consulta: AgendaConsultaOrm): EventoProntuarioPacienteDto {
    return {
      id: consulta.id,
      tipo: 'consulta',
      titulo: consulta.titulo,
      descricao: consulta.local,
      data: consulta.inicioEm,
      status: consulta.status,
      origemId: consulta.id,
      metadados: {
        fimEm: consulta.fimEm,
        googleEventId: consulta.googleEventId,
        googleEventHtmlLink: consulta.googleEventHtmlLink
      }
    };
  }

  private mapearEventoEnvioQuestionario(envio: EnvioQuestionarioOrm, tituloQuestionario?: string): EventoProntuarioPacienteDto {
    return {
      id: envio.id,
      tipo: 'formulario',
      titulo: tituloQuestionario ?? 'Formulario',
      descricao: envio.expiraEm ? `Expira em ${envio.expiraEm.toISOString()}` : undefined,
      data: envio.enviadoEm ?? envio.expiraEm ?? new Date(0),
      status: envio.status,
      origemId: envio.questionarioId,
      metadados: {
        envioQuestionarioId: envio.id,
        expiraEm: envio.expiraEm
      }
    };
  }

  private mapearEventoRespostaQuestionario(resposta: RespostaCheckinOrm, tituloQuestionario?: string): EventoProntuarioPacienteDto {
    return {
      id: resposta.id,
      tipo: 'resposta_formulario',
      titulo: `Resposta de ${tituloQuestionario ?? 'formulario'}`,
      descricao: resposta.scoreFinal ? `Score final ${resposta.scoreFinal}` : undefined,
      data: resposta.finalizadoEm ?? resposta.criadoEm,
      status: resposta.finalizadoEm ? 'finalizado' : 'em_andamento',
      origemId: resposta.envioQuestionarioId,
      metadados: {
        scoreFinal: resposta.scoreFinal
      }
    };
  }

  private mapearEventoCheckinRapido(diario: LogDiarioRapidoOrm): EventoProntuarioPacienteDto {
    const titulos: Record<LogDiarioRapidoOrm['tipo'], string> = {
      refeicao: 'Registro de refeicao',
      humor: 'Check-in rapido',
      agua: 'Registro de agua',
      atividade: 'Registro de atividade'
    };
    const detalhes = [
      typeof diario.valor.humor === 'string' ? `Humor: ${diario.valor.humor}` : undefined,
      typeof diario.valor.adesaoPlano === 'number' ? `Adesao ao plano: ${diario.valor.adesaoPlano}%` : undefined,
      typeof diario.valor.sintomas === 'string' && diario.valor.sintomas.trim() ? `Sintomas: ${diario.valor.sintomas.trim()}` : undefined,
      typeof diario.valor.observacoes === 'string' && diario.valor.observacoes.trim() ? diario.valor.observacoes.trim() : undefined
    ].filter((detalhe): detalhe is string => Boolean(detalhe));

    return {
      id: diario.id,
      tipo: 'checkin_rapido',
      titulo: titulos[diario.tipo],
      descricao: detalhes.join(' - ') || undefined,
      data: diario.registradoEm,
      status: 'registrado',
      origemId: diario.id,
      metadados: { tipoDiario: diario.tipo }
    };
  }

  private mapearEventoMensagem(mensagem: MensagemNotificacaoOrm): EventoProntuarioPacienteDto {
    return {
      id: mensagem.id,
      tipo: 'mensagem',
      titulo: mensagem.status === 'recebido' ? 'Mensagem recebida' : 'Mensagem',
      descricao: this.extrairTextoMensagem(mensagem),
      data: mensagem.enviadoEm ?? mensagem.criadoEm,
      status: mensagem.status,
      origemId: mensagem.id,
      metadados: {
        canalId: mensagem.canalId,
        templateId: mensagem.templateId,
        erro: mensagem.erro
      }
    };
  }

  private mapearEventoEvolucao(evolucao: EvolucaoClinicaOrm): EventoProntuarioPacienteDto {
    return {
      id: evolucao.id,
      tipo: 'evolucao_clinica',
      titulo: evolucao.titulo,
      descricao: this.criptografia.descriptografar(evolucao.conteudoCriptografado),
      data: evolucao.criadoEm,
      status: evolucao.tipo,
      origemId: evolucao.id,
      metadados: {
        autorUsuarioId: evolucao.autorUsuarioId,
        visibilidade: evolucao.visibilidade
      }
    };
  }

  private mapearEventoTarefa(tarefa: AcompanhamentoTarefaOrm): EventoProntuarioPacienteDto {
    return {
      id: tarefa.id,
      tipo: 'tarefa_acompanhamento',
      titulo: tarefa.titulo,
      descricao: tarefa.descricaoCriptografada ? this.criptografia.descriptografar(tarefa.descricaoCriptografada) : undefined,
      data: tarefa.vencimentoEm ?? tarefa.criadoEm,
      status: tarefa.status,
      origemId: tarefa.id,
      metadados: {
        categoria: tarefa.categoria,
        prioridade: tarefa.prioridade,
        profissionalId: tarefa.profissionalId,
        concluidoEm: tarefa.concluidoEm
      }
    };
  }

  private extrairTextoMensagem(mensagem: MensagemNotificacaoOrm): string | undefined {
    const payload = mensagem.payload ?? {};
    const candidatos = [payload.texto, payload.mensagem, payload.body, payload.conteudo];
    const texto = candidatos.find((valor) => typeof valor === 'string' && valor.trim().length > 0);
    return typeof texto === 'string' ? texto : mensagem.erro;
  }
}
