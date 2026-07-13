import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull, LessThanOrEqual } from 'typeorm';
import * as cronParser from 'cron-parser';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { normalizarOrdemPerguntas } from '../dominio/reordenacao-perguntas';
import { validarTipoPergunta } from '../dominio/tipos-pergunta';
import {
  AtualizarQuestionarioDto,
  AtualizarPerguntaDto,
  CriarAgendamentoQuestionarioDto,
  CriarCategoriaPerguntaDto,
  CriarPerguntaDto,
  CriarQuestionarioDto,
  ReordenarPerguntasDto
} from './dtos';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from '../infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';

@Injectable()
export class ServicoQuestionarios {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async criarCategoria(tenantId: string, dados: CriarCategoriaPerguntaDto): Promise<CategoriaPerguntaOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(CategoriaPerguntaOrm).save(
        gerenciador.getRepository(CategoriaPerguntaOrm).create({
          tenantId,
          nome: dados.nome,
          iconeSvg: dados.iconeSvg,
          corHex: dados.corHex,
          ordem: dados.ordem ?? 0
        })
      )
    );
  }

  async listarCategorias(tenantId: string): Promise<CategoriaPerguntaOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(CategoriaPerguntaOrm).find({
        where: { tenantId },
        order: { ordem: 'ASC', nome: 'ASC' }
      })
    );
  }

  async criarQuestionario(tenantId: string, dados: CriarQuestionarioDto): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(QuestionarioOrm).save(
        gerenciador.getRepository(QuestionarioOrm).create({
          tenantId,
          profissionalId: dados.profissionalId,
          titulo: dados.titulo,
          descricao: dados.descricao,
          status: 'rascunho',
          versao: 1
        })
      )
    );
  }

  async listarQuestionarios(tenantId: string, pagina = 1, limite = 25): Promise<{ itens: QuestionarioOrm[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [itens, total] = await gerenciador.getRepository(QuestionarioOrm).findAndCount({
        where: { tenantId },
        order: { atualizadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      return { itens, total };
    });
  }

  async atualizarQuestionario(
    tenantId: string,
    questionarioId: string,
    dados: AtualizarQuestionarioDto
  ): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(QuestionarioOrm);
      const questionario = await repositorio.findOne({ where: { id: questionarioId, tenantId } });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      if (dados.titulo !== undefined) questionario.titulo = dados.titulo;
      if (dados.descricao !== undefined) questionario.descricao = dados.descricao;
      if (dados.status !== undefined) questionario.status = dados.status;
      questionario.versao += 1;

      return repositorio.save(questionario);
    });
  }

  async adicionarPergunta(tenantId: string, questionarioId: string, dados: CriarPerguntaDto): Promise<PerguntaOrm> {
    if (!validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    if (['multipla_escolha'].includes(dados.tipo) && (!dados.opcoes || dados.opcoes.length < 2)) {
      throw new BadRequestException('Perguntas de multipla escolha exigem pelo menos duas opcoes.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: questionarioId, tenantId }
      });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      const totalPerguntas = await gerenciador.getRepository(PerguntaOrm).count({
        where: { tenantId, questionarioId }
      });
      const repositorioPerguntas = gerenciador.getRepository(PerguntaOrm);
      const pergunta = await repositorioPerguntas.save(
        repositorioPerguntas.create({
          tenantId,
          questionarioId,
          categoriaId: dados.categoriaId,
          tipo: dados.tipo,
          enunciado: dados.enunciado,
          peso: String(dados.peso),
          obrigatoria: dados.obrigatoria ?? true,
          configuracao: dados.configuracao ?? {},
          ordem: totalPerguntas + 1
        })
      );

      if (dados.opcoes?.length) {
        await gerenciador.getRepository(OpcaoPerguntaOrm).save(
          dados.opcoes.map((opcao, indice) =>
            gerenciador.getRepository(OpcaoPerguntaOrm).create({
              tenantId,
              perguntaId: pergunta.id,
              rotulo: opcao.rotulo,
              valor: opcao.valor,
              imagemUrl: opcao.imagemUrl,
              ordem: indice + 1
            })
          )
        );
      }

      questionario.versao += 1;
      await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      return pergunta;
    });
  }

  async listarPerguntas(tenantId: string, questionarioId: string): Promise<PerguntaOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId },
        order: { ordem: 'ASC' }
      })
    );
  }

  async atualizarPergunta(
    tenantId: string,
    questionarioId: string,
    perguntaId: string,
    dados: AtualizarPerguntaDto
  ): Promise<PerguntaOrm> {
    if (dados.tipo && !validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioPerguntas = gerenciador.getRepository(PerguntaOrm);
      const pergunta = await repositorioPerguntas.findOne({
        where: { id: perguntaId, tenantId, questionarioId }
      });
      if (!pergunta) throw new NotFoundException('Pergunta nao encontrada.');

      if (dados.categoriaId !== undefined) pergunta.categoriaId = dados.categoriaId;
      if (dados.tipo !== undefined) pergunta.tipo = dados.tipo;
      if (dados.enunciado !== undefined) pergunta.enunciado = dados.enunciado;
      if (dados.peso !== undefined) pergunta.peso = String(dados.peso);
      if (dados.obrigatoria !== undefined) pergunta.obrigatoria = dados.obrigatoria;
      if (dados.configuracao !== undefined) pergunta.configuracao = dados.configuracao;

      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: questionarioId, tenantId }
      });
      if (questionario) {
        questionario.versao += 1;
        await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      }

      return repositorioPerguntas.save(pergunta);
    });
  }

  async reordenarPerguntas(tenantId: string, questionarioId: string, dados: ReordenarPerguntasDto): Promise<PerguntaOrm[]> {
    const ordemNormalizada = normalizarOrdemPerguntas(dados.perguntas);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PerguntaOrm);
      const perguntasPersistidas = await repositorio.find({ where: { tenantId, questionarioId } });
      const idsPersistidos = new Set(perguntasPersistidas.map((pergunta) => pergunta.id));

      if (ordemNormalizada.some((pergunta) => !idsPersistidos.has(pergunta.id))) {
        throw new BadRequestException('Reordenacao contem pergunta inexistente no questionario.');
      }

      const mapaOrdem = new Map(ordemNormalizada.map((pergunta) => [pergunta.id, pergunta.ordem]));
      for (const pergunta of perguntasPersistidas) {
        const novaOrdem = mapaOrdem.get(pergunta.id);
        if (novaOrdem !== undefined) pergunta.ordem = novaOrdem;
      }

      await repositorio.save(perguntasPersistidas);
      return repositorio.find({ where: { tenantId, questionarioId }, order: { ordem: 'ASC' } });
    });
  }

  async criarAgendamento(tenantId: string, dados: CriarAgendamentoQuestionarioDto): Promise<AgendamentoQuestionarioOrm> {
    if (!dados.regraCron && !dados.dataFixa) {
      throw new BadRequestException('Informe regraCron ou dataFixa.');
    }

    const proximaExecucaoEm = this.calcularProximaExecucao(dados.regraCron, dados.dataFixa, dados.timezone);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: dados.questionarioId, tenantId }
      });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      return gerenciador.getRepository(AgendamentoQuestionarioOrm).save(
        gerenciador.getRepository(AgendamentoQuestionarioOrm).create({
          tenantId,
          questionarioId: dados.questionarioId,
          regraCron: dados.regraCron,
          dataFixa: dados.dataFixa ? new Date(dados.dataFixa) : undefined,
          timezone: dados.timezone ?? 'America/Sao_Paulo',
          ativo: true,
          proximaExecucaoEm
        })
      );
    });
  }

  async processarAgendamentosVencidos(tenantId: string, agora = new Date()): Promise<number> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const agendamentos = await gerenciador.getRepository(AgendamentoQuestionarioOrm).find({
        where: {
          tenantId,
          ativo: true,
          proximaExecucaoEm: LessThanOrEqual(agora)
        }
      });

      let totalEnvios = 0;
      for (const agendamento of agendamentos) {
        const pacientes = await gerenciador.getRepository(PacienteOrm).find({
          where: { tenantId, arquivadoEm: IsNull() }
        });

        await gerenciador.getRepository(EnvioQuestionarioOrm).save(
          pacientes.map((paciente) =>
            gerenciador.getRepository(EnvioQuestionarioOrm).create({
              tenantId,
              questionarioId: agendamento.questionarioId,
              pacienteId: paciente.id,
              agendamentoId: agendamento.id,
              status: 'pendente'
            })
          )
        );
        totalEnvios += pacientes.length;

        agendamento.ultimaExecucaoEm = agora;
        agendamento.proximaExecucaoEm = agendamento.regraCron
          ? this.calcularProximaExecucao(agendamento.regraCron, undefined, agendamento.timezone, agora)
          : undefined;
        agendamento.ativo = Boolean(agendamento.regraCron);
        await gerenciador.getRepository(AgendamentoQuestionarioOrm).save(agendamento);
      }

      return totalEnvios;
    });
  }

  private calcularProximaExecucao(
    regraCron?: string,
    dataFixa?: string,
    timezone = 'America/Sao_Paulo',
    base = new Date()
  ): Date {
    if (dataFixa) return new Date(dataFixa);
    if (!regraCron) throw new BadRequestException('Regra cron ausente.');

    try {
      return cronParser.parseExpression(regraCron, { currentDate: base, tz: timezone }).next().toDate();
    } catch {
      throw new BadRequestException('Regra cron invalida.');
    }
  }
}
