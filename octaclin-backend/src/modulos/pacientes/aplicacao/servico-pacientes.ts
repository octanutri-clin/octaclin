import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import {
  AtualizarPacienteDto,
  CriarEvolucaoClinicaDto,
  CriarPacienteDto,
  EventoProntuarioPacienteDto,
  EvolucaoClinicaRespostaDto,
  PacienteRespostaDto,
  ProntuarioPacienteRespostaDto
} from './dtos';
import { EvolucaoClinicaOrm } from '../infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

@Injectable()
export class ServicoPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly portalCliente: ServicoPortalCliente
  ) {}

  async criar(tenantId: string, dados: CriarPacienteDto): Promise<PacienteRespostaDto> {
    await this.garantirLimitePermitido(tenantId, 'pacientes');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
      const paciente = repositorio.create({
        tenantId,
        profissionalResponsavelId: dados.profissionalResponsavelId,
        nomeCriptografado: this.criptografia.criptografar(dados.nome),
        contatoCriptografado: dados.contato ? this.criptografia.criptografar(dados.contato) : undefined,
        dataNascimento: dados.dataNascimento,
        statusAdesao: 'novo',
        scoreRisco: '0'
      });

      return this.mapearResposta(await repositorio.save(paciente));
    });
  }

  async listar(tenantId: string, pagina = 1, limite = 25): Promise<{ itens: PacienteRespostaDto[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [itens, total] = await gerenciador.getRepository(PacienteOrm).findAndCount({
        where: { tenantId, arquivadoEm: IsNull() },
        order: { criadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      return { itens: itens.map((paciente) => this.mapearResposta(paciente)), total };
    });
  }

  async obterPorId(tenantId: string, pacienteId: string): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });

      if (!paciente) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      return this.mapearResposta(paciente);
    });
  }

  async atualizar(tenantId: string, pacienteId: string, dados: AtualizarPacienteDto): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
      const paciente = await repositorio.findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });

      if (!paciente) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      if (dados.profissionalResponsavelId) paciente.profissionalResponsavelId = dados.profissionalResponsavelId;
      if (dados.nome) paciente.nomeCriptografado = this.criptografia.criptografar(dados.nome);
      if (dados.contato) paciente.contatoCriptografado = this.criptografia.criptografar(dados.contato);
      if (dados.dataNascimento) paciente.dataNascimento = dados.dataNascimento;
      if (dados.statusAdesao) paciente.statusAdesao = dados.statusAdesao;
      if (dados.scoreRisco !== undefined) paciente.scoreRisco = String(dados.scoreRisco);

      return this.mapearResposta(await repositorio.save(paciente));
    });
  }

  async arquivar(tenantId: string, pacienteId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(PacienteOrm).update(
        { id: pacienteId, tenantId, arquivadoEm: IsNull() },
        { arquivadoEm: new Date(), statusAdesao: 'inativo' }
      );

      if (!resultado.affected) {
        throw new NotFoundException('Paciente nao encontrado.');
      }
    });
  }

  private mapearResposta(paciente: PacienteOrm): PacienteRespostaDto {
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
      criadoEm: paciente.criadoEm,
      atualizadoEm: paciente.atualizadoEm
    };
  }

  async criarEvolucaoClinica(
    tenantId: string,
    pacienteId: string,
    autorUsuarioId: string,
    dados: CriarEvolucaoClinicaDto
  ): Promise<EvolucaoClinicaRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId);

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

  async listarEvolucoesClinicas(tenantId: string, pacienteId: string): Promise<EvolucaoClinicaRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteExiste(gerenciador, tenantId, pacienteId);
      const evolucoes = await gerenciador.getRepository(EvolucaoClinicaOrm).find({
        where: { tenantId, pacienteId },
        order: { criadoEm: 'DESC' },
        take: 50
      });

      return evolucoes.map((evolucao) => this.mapearEvolucao(evolucao));
    });
  }

  async obterProntuario(tenantId: string, pacienteId: string): Promise<ProntuarioPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteOrm = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });

      if (!pacienteOrm) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      const [consultas, envios, respostas, mensagens, evolucoes] = await Promise.all([
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
        gerenciador.getRepository(MensagemNotificacaoOrm).find({
          where: { tenantId, pacienteId },
          order: { criadoEm: 'DESC' },
          take: 30
        }),
        gerenciador.getRepository(EvolucaoClinicaOrm).find({
          where: { tenantId, pacienteId },
          order: { criadoEm: 'DESC' },
          take: 50
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
        ...mensagens.map((mensagem) => this.mapearEventoMensagem(mensagem)),
        ...evolucoes.map((evolucao) => this.mapearEventoEvolucao(evolucao))
      ]
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, 80);

      return {
        paciente: this.mapearResposta(pacienteOrm),
        resumo: {
          consultas: consultas.length,
          formulariosPendentes: envios.filter((envio) => envio.status === 'pendente' || envio.status === 'enviado').length,
          respostas: respostas.length,
          mensagens: mensagens.length,
          evolucoes: evolucoes.length,
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

  private async garantirPacienteExiste(gerenciador: EntityManager, tenantId: string, pacienteId: string) {
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
    });

    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    return paciente;
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

  private extrairTextoMensagem(mensagem: MensagemNotificacaoOrm): string | undefined {
    const payload = mensagem.payload ?? {};
    const candidatos = [payload.texto, payload.mensagem, payload.body, payload.conteudo];
    const texto = candidatos.find((valor) => typeof valor === 'string' && valor.trim().length > 0);
    return typeof texto === 'string' ? texto : mensagem.erro;
  }
}
