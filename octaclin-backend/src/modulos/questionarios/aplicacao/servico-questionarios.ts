import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { EntityManager, In, IsNull, LessThanOrEqual } from 'typeorm';
import * as cronParser from 'cron-parser';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { normalizarConfiguracaoPergunta } from '../dominio/configuracao-pergunta';
import { MODELOS_QUESTIONARIO, ModeloQuestionarioResumo, resumirModeloQuestionario } from '../dominio/modelos-questionario';
import { normalizarOrdemPerguntas } from '../dominio/reordenacao-perguntas';
import { TipoPergunta, validarTipoPergunta } from '../dominio/tipos-pergunta';
import {
  AtualizarQuestionarioDto,
  AtualizarPerguntaDto,
  CriarAgendamentoQuestionarioDto,
  CriarCategoriaPerguntaDto,
  CriarEnvioQuestionarioManualDto,
  CriarPerguntaDto,
  CriarQuestionarioAPartirModeloDto,
  CriarQuestionarioDto,
  DuplicarQuestionarioDto,
  FinalizarFormularioPacienteDto,
  ReordenarPerguntasDto
} from './dtos';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from '../infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';

type PerguntaComOpcoes = PerguntaOrm & { opcoes: OpcaoPerguntaOrm[] };

export interface FormularioPacientePublico {
  envioId: string;
  titulo: string;
  descricao?: string;
  status: string;
  expiraEm?: Date;
  perguntas: PerguntaComOpcoes[];
}

export interface EnvioQuestionarioManualResposta extends EnvioQuestionarioOrm {
  tokenFormulario: string;
  linkFormulario: string;
}

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

  listarModelosQuestionario(): ModeloQuestionarioResumo[] {
    return MODELOS_QUESTIONARIO.map(resumirModeloQuestionario);
  }

  async criarQuestionarioAPartirModelo(
    tenantId: string,
    modeloId: string,
    dados: CriarQuestionarioAPartirModeloDto
  ): Promise<QuestionarioOrm> {
    const modelo = MODELOS_QUESTIONARIO.find((item) => item.id === modeloId);
    if (!modelo) throw new NotFoundException('Modelo de questionario nao encontrado.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const categoriasPorNome = new Map<string, CategoriaPerguntaOrm>();
      for (const perguntaModelo of modelo.perguntas) {
        const categoriaModelo = perguntaModelo.categoria;
        const existente = await gerenciador.getRepository(CategoriaPerguntaOrm).findOne({
          where: { tenantId, nome: categoriaModelo.nome }
        });
        const categoria =
          existente ??
          (await gerenciador.getRepository(CategoriaPerguntaOrm).save(
            gerenciador.getRepository(CategoriaPerguntaOrm).create({
              tenantId,
              nome: categoriaModelo.nome,
              iconeSvg: categoriaModelo.iconeSvg,
              corHex: categoriaModelo.corHex,
              ordem: categoriaModelo.ordem
            })
          ));
        categoriasPorNome.set(categoriaModelo.nome, categoria);
      }

      const questionario = await gerenciador.getRepository(QuestionarioOrm).save(
        gerenciador.getRepository(QuestionarioOrm).create({
          tenantId,
          profissionalId: dados.profissionalId,
          titulo: dados.titulo?.trim() || modelo.titulo,
          descricao: dados.descricao ?? modelo.descricao,
          status: 'rascunho',
          versao: 1
        })
      );

      for (const [indice, perguntaModelo] of modelo.perguntas.entries()) {
        const categoria = categoriasPorNome.get(perguntaModelo.categoria.nome);
        if (!categoria) throw new NotFoundException('Categoria do modelo nao encontrada.');

        const pergunta = await gerenciador.getRepository(PerguntaOrm).save(
          gerenciador.getRepository(PerguntaOrm).create({
            tenantId,
            questionarioId: questionario.id,
            categoriaId: categoria.id,
            tipo: perguntaModelo.tipo,
            enunciado: perguntaModelo.enunciado,
            peso: String(perguntaModelo.peso),
            obrigatoria: perguntaModelo.obrigatoria,
            configuracao: normalizarConfiguracaoPergunta(perguntaModelo.tipo, perguntaModelo.configuracao),
            ordem: indice + 1
          })
        );

        if (perguntaModelo.opcoes?.length) {
          await gerenciador.getRepository(OpcaoPerguntaOrm).save(
            perguntaModelo.opcoes.map((opcao, indiceOpcao) =>
              gerenciador.getRepository(OpcaoPerguntaOrm).create({
                tenantId,
                perguntaId: pergunta.id,
                rotulo: opcao.rotulo,
                valor: opcao.valor,
                imagemUrl: opcao.imagemUrl,
                ordem: indiceOpcao + 1
              })
            )
          );
        }
      }

      return questionario;
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

  async duplicarQuestionario(
    tenantId: string,
    questionarioId: string,
    dados: DuplicarQuestionarioDto
  ): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioQuestionarios = gerenciador.getRepository(QuestionarioOrm);
      const original = await repositorioQuestionarios.findOne({ where: { id: questionarioId, tenantId } });
      if (!original) throw new NotFoundException('Questionario nao encontrado.');

      const duplicado = await repositorioQuestionarios.save(
        repositorioQuestionarios.create({
          tenantId,
          profissionalId: original.profissionalId,
          titulo: dados.titulo?.trim() || `${original.titulo} (copia)`,
          descricao: original.descricao,
          status: 'rascunho',
          versao: 1
        })
      );

      const perguntasOriginais = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId },
        order: { ordem: 'ASC' }
      });
      const idsPerguntasOriginais = new Set(perguntasOriginais.map((pergunta) => pergunta.id));
      const opcoesOriginais = (
        await gerenciador.getRepository(OpcaoPerguntaOrm).find({
          where: { tenantId },
          order: { ordem: 'ASC' }
        })
      ).filter((opcao) => idsPerguntasOriginais.has(opcao.perguntaId));

      const mapaPerguntas = new Map<string, string>();
      for (const perguntaOriginal of perguntasOriginais) {
        const perguntaDuplicada = await gerenciador.getRepository(PerguntaOrm).save(
          gerenciador.getRepository(PerguntaOrm).create({
            tenantId,
            questionarioId: duplicado.id,
            categoriaId: perguntaOriginal.categoriaId,
            tipo: perguntaOriginal.tipo,
            enunciado: perguntaOriginal.enunciado,
            peso: perguntaOriginal.peso,
            obrigatoria: perguntaOriginal.obrigatoria,
            configuracao: JSON.parse(JSON.stringify(perguntaOriginal.configuracao ?? {})),
            ordem: perguntaOriginal.ordem
          })
        );
        mapaPerguntas.set(perguntaOriginal.id, perguntaDuplicada.id);
      }

      const opcoesDuplicadas = opcoesOriginais.flatMap((opcaoOriginal) => {
        const perguntaId = mapaPerguntas.get(opcaoOriginal.perguntaId);
        if (!perguntaId) return [];
        return gerenciador.getRepository(OpcaoPerguntaOrm).create({
          tenantId,
          perguntaId,
          rotulo: opcaoOriginal.rotulo,
          valor: opcaoOriginal.valor,
          imagemUrl: opcaoOriginal.imagemUrl,
          ordem: opcaoOriginal.ordem
        });
      });
      if (opcoesDuplicadas.length) {
        await gerenciador.getRepository(OpcaoPerguntaOrm).save(opcoesDuplicadas);
      }

      return duplicado;
    });
  }

  async adicionarPergunta(tenantId: string, questionarioId: string, dados: CriarPerguntaDto): Promise<PerguntaOrm> {
    if (!validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    this.validarOpcoes(dados.tipo, dados.opcoes);

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
          configuracao: normalizarConfiguracaoPergunta(dados.tipo, dados.configuracao),
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
      return this.anexarOpcoes(gerenciador, pergunta);
    });
  }

  async listarPerguntas(tenantId: string, questionarioId: string): Promise<PerguntaComOpcoes[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId },
        order: { ordem: 'ASC' }
      });
      return this.anexarOpcoesLote(gerenciador, perguntas);
    });
  }

  async atualizarPergunta(
    tenantId: string,
    questionarioId: string,
    perguntaId: string,
    dados: AtualizarPerguntaDto
  ): Promise<PerguntaComOpcoes> {
    if (dados.tipo && !validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioPerguntas = gerenciador.getRepository(PerguntaOrm);
      const pergunta = await repositorioPerguntas.findOne({
        where: { id: perguntaId, tenantId, questionarioId }
      });
      if (!pergunta) throw new NotFoundException('Pergunta nao encontrada.');

      const tipoFinal = dados.tipo ?? pergunta.tipo;
      this.validarOpcoes(tipoFinal, dados.opcoes, dados.tipo !== undefined);

      if (dados.categoriaId !== undefined) pergunta.categoriaId = dados.categoriaId;
      if (dados.tipo !== undefined) pergunta.tipo = dados.tipo;
      if (dados.enunciado !== undefined) pergunta.enunciado = dados.enunciado;
      if (dados.peso !== undefined) pergunta.peso = String(dados.peso);
      if (dados.obrigatoria !== undefined) pergunta.obrigatoria = dados.obrigatoria;
      if (dados.configuracao !== undefined || dados.tipo !== undefined) {
        pergunta.configuracao = normalizarConfiguracaoPergunta(tipoFinal, dados.configuracao ?? pergunta.configuracao);
      }

      if (dados.opcoes !== undefined) {
        const repositorioOpcoes = gerenciador.getRepository(OpcaoPerguntaOrm);
        await repositorioOpcoes.delete({ tenantId, perguntaId });
        if (tipoFinal === 'multipla_escolha') {
          await repositorioOpcoes.save(
            dados.opcoes.map((opcao, indice) =>
              repositorioOpcoes.create({
                tenantId,
                perguntaId,
                rotulo: opcao.rotulo,
                valor: opcao.valor,
                imagemUrl: opcao.imagemUrl,
                ordem: indice + 1
              })
            )
          );
        }
      }

      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: questionarioId, tenantId }
      });
      if (questionario) {
        questionario.versao += 1;
        await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      }

      const salva = await repositorioPerguntas.save(pergunta);
      return this.anexarOpcoes(gerenciador, salva);
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

  async criarEnvioQuestionarioManual(
    tenantId: string,
    questionarioId: string,
    dados: CriarEnvioQuestionarioManualDto
  ): Promise<EnvioQuestionarioManualResposta> {
    const envio = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({ where: { id: questionarioId, tenantId } });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: dados.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const agora = new Date();
      return gerenciador.getRepository(EnvioQuestionarioOrm).save(
        gerenciador.getRepository(EnvioQuestionarioOrm).create({
          tenantId,
          questionarioId,
          pacienteId: dados.pacienteId,
          status: 'enviado',
          enviadoEm: agora,
          expiraEm: dados.expiraEm ? new Date(dados.expiraEm) : new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
        })
      );
    });

    const tokenFormulario = this.gerarTokenFormularioPaciente(tenantId, envio.id);
    return Object.assign(envio, {
      tokenFormulario,
      linkFormulario: this.montarLinkFormulario(tokenFormulario)
    });
  }

  gerarTokenFormularioPaciente(tenantId: string, envioId: string): string {
    const assinatura = this.assinarTokenFormulario(tenantId, envioId);
    return `${tenantId}.${envioId}.${assinatura}`;
  }

  async obterFormularioPaciente(token: string): Promise<FormularioPacientePublico> {
    const { tenantId, envioId } = this.validarTokenFormulario(token);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({ where: { id: envioId, tenantId } });
      this.validarEnvioFormulario(envio);

      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: envio.questionarioId, tenantId }
      });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      const perguntas = await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, questionario.id);

      return {
        envioId: envio.id,
        titulo: questionario.titulo,
        descricao: questionario.descricao,
        status: envio.status,
        expiraEm: envio.expiraEm,
        perguntas
      };
    });
  }

  async finalizarFormularioPaciente(token: string, dados: FinalizarFormularioPacienteDto) {
    const { tenantId, envioId } = this.validarTokenFormulario(token);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioEnvios = gerenciador.getRepository(EnvioQuestionarioOrm);
      const envio = await repositorioEnvios.findOne({ where: { id: envioId, tenantId } });
      this.validarEnvioFormulario(envio);

      const perguntas = await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, envio.questionarioId);
      this.validarRespostasObrigatorias(perguntas, dados.respostas);

      const agora = new Date();
      const respostaCheckin = await gerenciador.getRepository(RespostaCheckinOrm).save(
        gerenciador.getRepository(RespostaCheckinOrm).create({
          tenantId,
          pacienteId: envio.pacienteId,
          envioQuestionarioId: envio.id,
          finalizadoEm: agora,
          criadoEm: agora
        })
      );

      await gerenciador.getRepository(RespostaValorOrm).save(
        dados.respostas.map((resposta) =>
          gerenciador.getRepository(RespostaValorOrm).create({
            tenantId,
            respostaCheckinId: respostaCheckin.id,
            perguntaId: resposta.perguntaId,
            valor: resposta.valor
          })
        )
      );

      envio.status = 'respondido';
      envio.respondidoEm = agora;
      await repositorioEnvios.save(envio);

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: envio.pacienteId, tenantId } });
      if (paciente) {
        paciente.ultimoCheckinEm = agora;
        await gerenciador.getRepository(PacienteOrm).save(paciente);
      }

      return {
        envioId: envio.id,
        respostaCheckinId: respostaCheckin.id,
        status: envio.status,
        respondidoEm: envio.respondidoEm
      };
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

  private validarOpcoes(tipo: TipoPergunta, opcoes?: { rotulo: string; valor: string }[], exigirQuandoMultipla = true) {
    if (tipo === 'multipla_escolha' && exigirQuandoMultipla && (!opcoes || opcoes.length < 2)) {
      throw new BadRequestException('Perguntas de multipla escolha exigem pelo menos duas opcoes.');
    }
  }

  private segredoFormulario() {
    return process.env.FORMULARIO_PUBLICO_SEGREDO ?? process.env.JWT_SEGREDO ?? 'dev-formulario-publico-secret';
  }

  private assinarTokenFormulario(tenantId: string, envioId: string) {
    return createHmac('sha256', this.segredoFormulario()).update(`${tenantId}.${envioId}`).digest('base64url');
  }

  private validarTokenFormulario(token: string): { tenantId: string; envioId: string } {
    const [tenantId, envioId, assinatura] = token.split('.');
    if (!tenantId || !envioId || !assinatura) throw new BadRequestException('Token do formulario invalido.');

    const esperada = this.assinarTokenFormulario(tenantId, envioId);
    const assinaturaBuffer = Buffer.from(assinatura);
    const esperadaBuffer = Buffer.from(esperada);
    if (assinaturaBuffer.length !== esperadaBuffer.length || !timingSafeEqual(assinaturaBuffer, esperadaBuffer)) {
      throw new BadRequestException('Token do formulario invalido.');
    }

    return { tenantId, envioId };
  }

  private validarEnvioFormulario(envio?: EnvioQuestionarioOrm | null): asserts envio is EnvioQuestionarioOrm {
    if (!envio) throw new NotFoundException('Envio de questionario nao encontrado.');
    if (envio.status === 'respondido') throw new GoneException('Formulario ja respondido.');
    if (envio.status === 'expirado' || (envio.expiraEm && envio.expiraEm <= new Date())) throw new GoneException('Formulario expirado.');
  }

  private validarRespostasObrigatorias(perguntas: PerguntaOrm[], respostas: { perguntaId: string; valor: unknown }[]) {
    const respostasPorPergunta = new Map(respostas.map((resposta) => [resposta.perguntaId, resposta.valor]));
    const idsPerguntas = new Set(perguntas.map((pergunta) => pergunta.id));

    if (respostas.some((resposta) => !idsPerguntas.has(resposta.perguntaId))) {
      throw new BadRequestException('Resposta contem pergunta inexistente no formulario.');
    }

    const obrigatoriaSemResposta = perguntas.find((pergunta) => pergunta.obrigatoria && !this.valorPreenchido(respostasPorPergunta.get(pergunta.id)));
    if (obrigatoriaSemResposta) {
      throw new BadRequestException(`Pergunta obrigatoria sem resposta: ${obrigatoriaSemResposta.enunciado}`);
    }
  }

  private montarLinkFormulario(token: string) {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL(`/formularios/${encodeURIComponent(token)}`, baseUrl);
    return url.toString();
  }

  private valorPreenchido(valor: unknown) {
    if (valor === null || valor === undefined) return false;
    if (typeof valor === 'string') return valor.trim().length > 0;
    if (Array.isArray(valor)) return valor.length > 0;
    return true;
  }

  private async listarPerguntasComOpcoesPorQuestionario(
    gerenciador: EntityManager,
    tenantId: string,
    questionarioId: string
  ): Promise<PerguntaComOpcoes[]> {
    const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
      where: { tenantId, questionarioId },
      order: { ordem: 'ASC' }
    });
    const idsPerguntas = new Set(perguntas.map((pergunta) => pergunta.id));
    const opcoes = (
      await gerenciador.getRepository(OpcaoPerguntaOrm).find({
        where: { tenantId },
        order: { ordem: 'ASC' }
      })
    ).filter((opcao) => idsPerguntas.has(opcao.perguntaId));

    const opcoesPorPergunta = new Map<string, OpcaoPerguntaOrm[]>();
    opcoes.forEach((opcao) => {
      const atuais = opcoesPorPergunta.get(opcao.perguntaId) ?? [];
      atuais.push(opcao);
      opcoesPorPergunta.set(opcao.perguntaId, atuais);
    });

    return perguntas.map((pergunta) => Object.assign(pergunta, { opcoes: opcoesPorPergunta.get(pergunta.id) ?? [] }));
  }

  private async anexarOpcoes(gerenciador: EntityManager, pergunta: PerguntaOrm): Promise<PerguntaComOpcoes> {
    const opcoes = await gerenciador.getRepository(OpcaoPerguntaOrm).find({
      where: { tenantId: pergunta.tenantId, perguntaId: pergunta.id },
      order: { ordem: 'ASC' }
    });
    return Object.assign(pergunta, { opcoes });
  }

  private async anexarOpcoesLote(gerenciador: EntityManager, perguntas: PerguntaOrm[]): Promise<PerguntaComOpcoes[]> {
    if (!perguntas.length) return [];

    const opcoes = await gerenciador.getRepository(OpcaoPerguntaOrm).find({
      where: { tenantId: perguntas[0].tenantId, perguntaId: In(perguntas.map((pergunta) => pergunta.id)) },
      order: { ordem: 'ASC' }
    });
    const opcoesPorPergunta = new Map<string, OpcaoPerguntaOrm[]>();
    opcoes.forEach((opcao) => {
      const atuais = opcoesPorPergunta.get(opcao.perguntaId) ?? [];
      atuais.push(opcao);
      opcoesPorPergunta.set(opcao.perguntaId, atuais);
    });

    return perguntas.map((pergunta) => Object.assign(pergunta, { opcoes: opcoesPorPergunta.get(pergunta.id) ?? [] }));
  }
}
