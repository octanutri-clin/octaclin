import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { And, ArrayContains, EntityManager, FindOptionsWhere, In, IsNull, LessThan, MoreThanOrEqual, Not, Raw } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
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
import {
  AtualizarPacienteDto,
  AtualizarTarefaAcompanhamentoDto,
  CriarEvolucaoClinicaDto,
  CriarPacienteDto,
  CriarTarefaAcompanhamentoDto,
  EventoProntuarioPacienteDto,
  EvolucaoClinicaRespostaDto,
  PacienteRespostaDto,
  ProntuarioPacienteRespostaDto,
  TarefaAcompanhamentoRespostaDto,
  ListarPacientesDto
} from './dtos';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { EvolucaoClinicaOrm } from '../infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

@Injectable()
export class ServicoPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly portalCliente: ServicoPortalCliente
  ) {}

  async criar(tenantId: string, dados: CriarPacienteDto, usuario: UsuarioAutenticado): Promise<PacienteRespostaDto> {
    await this.garantirLimitePermitido(tenantId, 'pacientes');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
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
        statusAdesao: 'novo',
        scoreRisco: '0'
      });

      return this.mapearResposta(await repositorio.save(paciente));
    });
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
      const paciente = await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId, usuario);
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
        { arquivadoEm: new Date(), statusAdesao: 'inativo' }
      );

      if (!resultado.affected) {
        throw new NotFoundException('Paciente nao encontrado.');
      }
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
      statusAdesao: paciente.statusAdesao,
      scoreRisco: paciente.scoreRisco,
      ultimoCheckinEm: paciente.ultimoCheckinEm,
      ultimaConsultaConcluidaEm: resumoConsultas?.ultimaConsultaConcluidaEm,
      proximaConsultaEm: resumoConsultas?.proximaConsultaEm,
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

  private async garantirLimitePermitido(tenantId: string, recurso: 'pacientes') {
    const limite = await this.portalCliente.checarLimite(tenantId, recurso);
    if (!limite.permitido) {
      throw new ForbiddenException(limite.mensagem ?? 'Limite do plano atingido para esta acao.');
    }
  }

  private async garantirPacienteExiste(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      }
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
