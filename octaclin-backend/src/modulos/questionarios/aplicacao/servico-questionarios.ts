import { autorizarContextoAgendamento, projetarAgendamento } from './acesso-agendamento';
import { AcaoAgendamento, planejarComandoAgendamento } from '../dominio/estado-agendamento';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { resumirRespostas } from './resumo-respostas';
import { calcularCompletudeHistorica, completudeDesconhecida } from '../dominio/completude-historica';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ValidarPreviaEditorDto, ProblemaEditor } from './dto-validacao-editor';
import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { EntityManager, ILike, In, IsNull, LessThanOrEqual, Not } from 'typeorm';
import { resolverProximaExecucao } from '../dominio/proxima-execucao';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { formatarCsvRespostas } from './csv-respostas';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { obterSegredoFormularioPublico } from '../../../infraestrutura/seguranca/segredo-formulario-publico';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { registrarEventoWebhook } from '../../integracoes/aplicacao/registrar-evento-webhook';
import { dispararGatilhoAutomacao } from '../../automacoes/aplicacao/disparar-gatilho-automacao';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { SessaoUsuarioOrm } from '../../auth/infraestrutura/sessao-usuario.orm';
import { copiarDefinicaoPergunta, planejarInsercaoCopiaPergunta } from '../dominio/copia-pergunta';
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
  CriarEnviosQuestionarioLoteDto,
  CriarPerguntaDto,
  CriarQuestionarioAPartirModeloDto,
  CriarQuestionarioDto,
  DuplicarQuestionarioDto,
  FiltrosMatrizLongitudinalDto,
  FinalizarFormularioPacienteDto,
  ReordenarPerguntasDto,
  SalvarRascunhoFormularioPacienteDto
} from './dtos';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from '../infraestrutura/categoria-pergunta.orm';
import {
  EnvioQuestionarioOrm,
  PerguntaSnapshotQuestionario,
  SnapshotEstruturaQuestionario
} from '../infraestrutura/envio-questionario.orm';
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
  perguntas: PerguntaSnapshotQuestionario[];
  respostasRascunho?: { perguntaId: string; valor: unknown }[];
  rascunhoAtualizadoEm?: Date;
  rascunhoVersao: number;
}

export interface EnvioQuestionarioManualResposta extends EnvioQuestionarioOrm {
  tokenFormulario: string;
  linkFormulario: string;
}

export interface RespostaQuestionarioRecebida {
  respostaId: string;
  envioId: string;
  pacienteId: string;
  questionarioId: string;
  finalizadoEm?: Date;
  totalRespostas: number;
  respostas: {
    perguntaId: string;
    enunciado: string;
    tipo: TipoPergunta;
    valor: unknown;
  }[];
}

export interface VersaoQuestionario extends SnapshotEstruturaQuestionario {
  atual: boolean;
  capturadoEm?: Date;
  totalEnvios: number;
}

export interface FiltrosLeituraClinicaQuestionario {
  pacienteId?: string;
}

export interface LeituraClinicaQuestionario {
  questionarioId: string;
  filtroPacienteId?: string;
  resumo: {
    totalRespostas: number;
    totalPacientes: number;
    totalPerguntas: number;
    mediaRespostasPorEnvio: number;
    ultimaRespostaEm?: Date;
  };
  pacientes: {
    pacienteId: string;
    totalRespostas: number;
    totalValoresRespondidos: number;
    mediaRespostasPorEnvio: number;
    ultimaRespostaEm?: Date;
  }[];
  perguntas: {
    perguntaId: string;
    enunciado: string;
    tipo: TipoPergunta;
    totalRespostas: number;
    totalSim?: number;
    totalNao?: number;
    mediaNumerica?: number;
    textosRecentes: string[];
    distribuicao: { valor: string; total: number }[];
  }[];
  respostas: RespostaQuestionarioRecebida[];
}

export interface MatrizLongitudinalRespostas {
  filtros: FiltrosMatrizLongitudinalDto;
  resumo: {
    totalRespostas: number;
    totalIndicadores: number;
    primeiraRespostaEm?: Date;
    ultimaRespostaEm?: Date;
  };
  indicadores: {
    pacienteId: string;
    questionarioId: string;
    questionarioTitulo: string;
    perguntaId: string;
    categoriaId: string;
    enunciado: string;
    tipo: Extract<TipoPergunta, 'likert' | 'linear' | 'metrica'>;
    unidade?: string;
    atual: { valor: number; finalizadoEm: Date };
    anterior?: { valor: number; finalizadoEm: Date };
    delta?: number;
    historico: { valor: number; finalizadoEm: Date }[];
  }[];
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

  async criarQuestionario(tenantId: string, dados: CriarQuestionarioDto, usuario: UsuarioAutenticado): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(QuestionarioOrm).save(
        gerenciador.getRepository(QuestionarioOrm).create({
          tenantId,
          profissionalId: profissionalIdDoUsuario ?? dados.profissionalId,
          titulo: dados.titulo,
          descricao: dados.descricao,
          status: 'rascunho',
          versao: 1
        })
      );
    });
  }

  async listarQuestionarios(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pagina = 1,
    limite = 25,
    busca?: string
  ): Promise<{ itens: QuestionarioOrm[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const [itens, total] = await gerenciador.getRepository(QuestionarioOrm).findAndCount({
        where: {
          tenantId,
          ...(profissionalId ? { profissionalId } : {}),
          ...(busca?.trim() ? { titulo: ILike(`%${busca.trim()}%`) } : {})
        },
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
    dados: CriarQuestionarioAPartirModeloDto,
    usuario: UsuarioAutenticado
  ): Promise<QuestionarioOrm> {
    const modelo = MODELOS_QUESTIONARIO.find((item) => item.id === modeloId);
    if (!modelo) throw new NotFoundException('Modelo de questionario nao encontrado.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
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
          profissionalId: profissionalIdDoUsuario ?? dados.profissionalId,
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
    dados: AtualizarQuestionarioDto,
    usuario: UsuarioAutenticado
  ): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(QuestionarioOrm);
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_write');

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
    dados: DuplicarQuestionarioDto,
    usuario: UsuarioAutenticado
  ): Promise<QuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioQuestionarios = gerenciador.getRepository(QuestionarioOrm);
      const original = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);

      const duplicado = await repositorioQuestionarios.save(
        repositorioQuestionarios.create({
          tenantId,
          profissionalId: profissionalIdDoUsuario ?? original.profissionalId,
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
            ordem: perguntaOriginal.ordem,
            chaveClinica: perguntaOriginal.chaveClinica,
            visivelBiblioteca: false
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

  async prepararCopiaPergunta(tenantId: string, questionarioId: string, perguntaId: string, usuario: UsuarioAutenticado) {
    this.validarAtorCopia(tenantId, usuario);
    return this.executarComandoCopia(tenantId, async (gerenciador) => {
      const { questionario, perguntas, origem, sessaoExpiraEm } = await this.carregarEstadoCopia(gerenciador, tenantId, questionarioId, perguntaId, usuario, 'pessimistic_read');
      const resultado = { revisao: this.revisaoCopia(questionario, perguntas, origem.id, usuario), definicao: copiarDefinicaoPergunta(origem) };
      if (sessaoExpiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão expirada durante a preparação.');
      return resultado;
    });
  }

  async duplicarPergunta(tenantId: string, questionarioId: string, perguntaId: string, revisaoEsperada: string, usuario: UsuarioAutenticado) {
    this.validarAtorCopia(tenantId, usuario);
    if (typeof revisaoEsperada !== 'string' || !/^[a-f0-9]{64}$/.test(revisaoEsperada)) {
      throw new BadRequestException('Revisão da cópia inválida. Confira novamente a pergunta.');
    }
    return this.executarComandoCopia(tenantId, async (gerenciador) => {
      const { questionario, perguntas, origem, sessaoExpiraEm } = await this.carregarEstadoCopia(gerenciador, tenantId, questionarioId, perguntaId, usuario, 'pessimistic_write');
      const atual = this.revisaoCopia(questionario, perguntas, origem.id, usuario);
      if (!timingSafeEqual(Buffer.from(atual, 'hex'), Buffer.from(revisaoEsperada, 'hex'))) {
        throw new ConflictException('A prévia está desatualizada. Confira o questionário antes de duplicar novamente.');
      }
      const definicao = copiarDefinicaoPergunta(origem);
      const copiaId = randomUUID();
      const plano = planejarInsercaoCopiaPergunta(perguntas, origem.id, copiaId);
      const { opcoes, ...campos } = definicao;
      const repositorio = gerenciador.getRepository(PerguntaOrm);
      await repositorio.save(repositorio.create({ ...campos, id: copiaId, tenantId, questionarioId,
        ordem: plano.find((item) => item.id === copiaId)!.ordem }));
      if (opcoes.length) {
        const repoOpcoes = gerenciador.getRepository(OpcaoPerguntaOrm);
        await repoOpcoes.save(opcoes.map((opcao) => repoOpcoes.create({ ...opcao,
          imagemUrl: opcao.imagemUrl ?? undefined, id: randomUUID(), tenantId, perguntaId: copiaId })));
      }
      for (const item of plano) {
        if (item.id !== copiaId) await repositorio.update({ id: item.id, tenantId, questionarioId }, { ordem: item.ordem });
      }
      questionario.versao += 1;
      await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      if (sessaoExpiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão expirada durante a cópia.');
      return { perguntaId: copiaId, versaoQuestionario: questionario.versao };
    });
  }

  async obterVersaoEditor(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const q = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      return { versao: q.versao };
    });
  }

  async validarPreviaEditor(tenantId: string, questionarioId: string, dados: ValidarPreviaEditorDto, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async gerenciador => {
      // Escritores do questionário usam FOR UPDATE; a prévia mantém a leitura coerente.
      const q = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      if (q.versao !== dados.versaoEsperada) throw new ConflictException('O questionário mudou. Confira a versão salva novamente, preservando suas edições locais.');
      const perguntas = await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, questionarioId);
      const edicoes = new Map(dados.perguntas.map(item => [item.id, item.dados]));
      if (edicoes.size !== dados.perguntas.length || [...edicoes.keys()].some(id => !perguntas.some(p => p.id === id))) {
        throw new BadRequestException('Uma edição não pertence ao questionário disponível.');
      }
      const problemas: ProblemaEditor[] = [];
      if (!dados.titulo.trim()) problemas.push({ campo: 'titulo', codigo: 'titulo_ausente' });
      for (const salva of perguntas) {
        const p = { ...salva, ...(edicoes.get(salva.id) ?? {}) };
        const adicionar = (campo: ProblemaEditor['campo'], codigo: ProblemaEditor['codigo']) => problemas.push({ perguntaId: salva.id, campo, codigo });
        if (typeof p.enunciado !== 'string' || !p.enunciado.trim()) adicionar('enunciado', 'enunciado_ausente');
        const entrada = plainToInstance(AtualizarPerguntaDto, {
          categoriaId: p.categoriaId, tipo: p.tipo, enunciado: p.enunciado,
          peso: p.peso === null || p.peso === undefined ? NaN : Number(p.peso),
          obrigatoria: p.obrigatoria, chaveClinica: p.chaveClinica, visivelBiblioteca: p.visivelBiblioteca,
          configuracao: p.configuracao, opcoes: (p.opcoes ?? []).map(o => ({ rotulo: o.rotulo, valor: o.valor, imagemUrl: o.imagemUrl }))
        });
        for (const erro of validateSync(entrada, { whitelist: true, forbidNonWhitelisted: true })) {
          const campo = ['peso', 'categoriaId', 'tipo', 'configuracao', 'opcoes'].includes(erro.property) ? erro.property as ProblemaEditor['campo'] : 'dados';
          adicionar(campo, 'dados_invalidos');
        }
        try { this.validarOpcoes(p.tipo, p.opcoes); }
        catch (erro) { if (!(erro instanceof BadRequestException)) throw erro; adicionar('opcoes', 'opcoes_insuficientes'); }
        if (p.configuracao === null || typeof p.configuracao !== 'object' || Array.isArray(p.configuracao)) adicionar('configuracao', 'configuracao_invalida');
        else try { normalizarConfiguracaoPergunta(p.tipo, p.configuracao); }
        catch (erro) { if (!(erro instanceof BadRequestException)) throw erro; adicionar('configuracao', 'configuracao_invalida'); }
      }
      return { versao: q.versao, problemas };
    });
  }

  async adicionarPergunta(
    tenantId: string,
    questionarioId: string,
    dados: CriarPerguntaDto,
    usuario: UsuarioAutenticado
  ): Promise<PerguntaOrm> {
    if (!validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    this.validarOpcoes(dados.tipo, dados.opcoes);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_write');

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
          ordem: totalPerguntas + 1,
          chaveClinica: this.normalizarChaveClinica(dados.chaveClinica),
          visivelBiblioteca: dados.visivelBiblioteca ?? false
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

  async listarPerguntas(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado): Promise<PerguntaComOpcoes[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId },
        order: { ordem: 'ASC' }
      });
      return this.anexarOpcoesLote(gerenciador, perguntas);
    });
  }

  async listarBibliotecaPerguntas(
    tenantId: string,
    filtros: { busca?: string; categoriaId?: string } = {}
  ): Promise<PerguntaComOpcoes[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PerguntaOrm);
      const where = { tenantId, visivelBiblioteca: true, ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}) };
      const referencias = await repositorio.find({ where, select: { questionarioId: true } });
      const pais = [...new Set(referencias.map((item) => item.questionarioId))].sort();
      if (!pais.length) return [];
      // Uma consulta por lote; ordem global dos pais, sem locks por pergunta.
      const bloqueados: { id: string }[] = await gerenciador.query('SELECT id FROM questionarios WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE', [tenantId, pais]);
      if (!bloqueados.length) return [];
      const perguntas = await repositorio.find({
        where: {
          ...where, questionarioId: In(bloqueados.map((item) => item.id))
        },
        order: { ordem: 'ASC' }
      });
      const busca = filtros.busca?.trim().toLocaleLowerCase('pt-BR');
      const filtradas = busca
        ? perguntas.filter((pergunta) =>
            [pergunta.enunciado, pergunta.chaveClinica ?? ''].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca))
          )
        : perguntas;
      return this.anexarOpcoesLote(gerenciador, filtradas);
    });
  }

  async incluirPerguntaBiblioteca(
    tenantId: string,
    perguntaId: string,
    questionarioId: string,
    usuario: UsuarioAutenticado
  ): Promise<PerguntaComOpcoes> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioPerguntas = gerenciador.getRepository(PerguntaOrm);
      const referencia = await repositorioPerguntas.findOne({
        where: { id: perguntaId, tenantId, visivelBiblioteca: true }
      });
      if (!referencia) throw new NotFoundException('Pergunta da biblioteca nao encontrada.');
      for (const id of [...new Set([questionarioId, referencia.questionarioId].map((id) => id.toLowerCase()))].sort()) {
        const pai = await gerenciador.getRepository(QuestionarioOrm).findOne({
          where: { id, tenantId }, lock: { mode: 'pessimistic_write' }
        });
        if (!pai) throw new NotFoundException('Questionario nao encontrado.');
      }
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario);
      const origem = await repositorioPerguntas.findOne({
        where: { id: perguntaId, tenantId, questionarioId: referencia.questionarioId, visivelBiblioteca: true }
      });
      if (!origem) throw new NotFoundException('Pergunta da biblioteca nao encontrada.');

      const totalPerguntas = await repositorioPerguntas.count({ where: { tenantId, questionarioId } });
      const copia = await repositorioPerguntas.save(
        repositorioPerguntas.create({
          tenantId,
          questionarioId,
          categoriaId: origem.categoriaId,
          tipo: origem.tipo,
          enunciado: origem.enunciado,
          peso: origem.peso,
          obrigatoria: origem.obrigatoria,
          configuracao: JSON.parse(JSON.stringify(origem.configuracao ?? {})),
          ordem: totalPerguntas + 1,
          chaveClinica: origem.chaveClinica,
          visivelBiblioteca: false
        })
      );
      const opcoes = await gerenciador.getRepository(OpcaoPerguntaOrm).find({
        where: { tenantId, perguntaId: origem.id },
        order: { ordem: 'ASC' }
      });
      if (opcoes.length) {
        await gerenciador.getRepository(OpcaoPerguntaOrm).save(
          opcoes.map((opcao) =>
            gerenciador.getRepository(OpcaoPerguntaOrm).create({
              tenantId,
              perguntaId: copia.id,
              rotulo: opcao.rotulo,
              valor: opcao.valor,
              imagemUrl: opcao.imagemUrl,
              ordem: opcao.ordem
            })
          )
        );
      }

      questionario.versao += 1;
      await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      return this.anexarOpcoes(gerenciador, copia);
    });
  }

  async atualizarPergunta(
    tenantId: string,
    questionarioId: string,
    perguntaId: string,
    dados: AtualizarPerguntaDto,
    usuario: UsuarioAutenticado
  ): Promise<PerguntaComOpcoes> {
    if (dados.tipo && !validarTipoPergunta(dados.tipo)) {
      throw new BadRequestException('Tipo de pergunta nao suportado.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_write');
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
      if (dados.chaveClinica !== undefined) pergunta.chaveClinica = this.normalizarChaveClinica(dados.chaveClinica);
      if (dados.visivelBiblioteca !== undefined) pergunta.visivelBiblioteca = dados.visivelBiblioteca;
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

      questionario.versao += 1;
      await gerenciador.getRepository(QuestionarioOrm).save(questionario);

      const salva = await repositorioPerguntas.save(pergunta);
      return this.anexarOpcoes(gerenciador, salva);
    });
  }

  async reordenarPerguntas(
    tenantId: string,
    questionarioId: string,
    dados: ReordenarPerguntasDto,
    usuario: UsuarioAutenticado
  ): Promise<PerguntaOrm[]> {
    const ordemNormalizada = normalizarOrdemPerguntas(dados.perguntas);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_write');
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
      questionario.versao += 1;
      await gerenciador.getRepository(QuestionarioOrm).save(questionario);
      return repositorio.find({ where: { tenantId, questionarioId }, order: { ordem: 'ASC' } });
    });
  }

  async criarAgendamento(tenantId: string, dados: CriarAgendamentoQuestionarioDto, usuario: UsuarioAutenticado) {
    if (!dados.regraCron && !dados.dataFixa) throw new BadRequestException('Informe regraCron ou dataFixa.');
    return this.executarComandoCopia(tenantId, async (m) => {
      await autorizarContextoAgendamento(m, tenantId, dados.questionarioId, dados.pacienteId, usuario.usuarioId, usuario);
      // Relógio depois dos locks: nunca iniciar uma execução única já vencida.
      const agora = new Date();
      const proximaExecucaoEm = this.calcularProximaExecucao(dados.regraCron, dados.dataFixa, dados.timezone, agora);
      if (!Number.isFinite(proximaExecucaoEm.getTime()) || proximaExecucaoEm <= agora) throw new BadRequestException('Informe uma ocorrência futura.');
      const repo = m.getRepository(AgendamentoQuestionarioOrm);
      const a = await repo.save(repo.create({tenantId,questionarioId:dados.questionarioId,pacienteId:dados.pacienteId,
        regraCron:dados.regraCron,dataFixa:dados.dataFixa ? new Date(dados.dataFixa) : undefined,
        timezone:dados.timezone??'America/Sao_Paulo',ativo:true,proximaExecucaoEm,revisao:1,autorizadoPorUsuarioId:usuario.usuarioId}));
      await registrarAuditoriaNaTransacao(m,{tenantId,usuarioId:usuario.usuarioId,acao:'questionarios.agendamento.criar',recursoTipo:'agendamento_questionario',recursoId:a.id});
      return projetarAgendamento(a);
    });
  }

  async listarAgendamentos(tenantId: string, questionarioId: string, pacienteId: string, pagina: number, usuario: UsuarioAutenticado) {
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000) throw new BadRequestException('Página inválida.');
    return this.executarComandoCopia(tenantId, async m => {
      await autorizarContextoAgendamento(m,tenantId,questionarioId,pacienteId,usuario.usuarioId,usuario);
      const lista = await m.getRepository(AgendamentoQuestionarioOrm).find({where:{tenantId,questionarioId,pacienteId},
        order:{criadoEm:'DESC',id:'DESC'},take:26,skip:(pagina-1)*25});
      return {itens:lista.slice(0,25).map(projetarAgendamento),pagina,temMais:lista.length>25};
    });
  }

  async comandarAgendamento(tenantId: string, questionarioId: string, pacienteId: string, agendamentoId: string,
    acao: AcaoAgendamento, revisaoEsperada: number, confirmar: boolean, usuario: UsuarioAutenticado) {
    if (confirmar !== true) throw new BadRequestException('Confirme explicitamente a operação.');
    return this.executarComandoCopia(tenantId, async m => {
      await autorizarContextoAgendamento(m,tenantId,questionarioId,pacienteId,usuario.usuarioId,usuario);
      const repo=m.getRepository(AgendamentoQuestionarioOrm);
      const a=await repo.findOne({where:{id:agendamentoId,tenantId,questionarioId,pacienteId},lock:{mode:'pessimistic_write'}});
      if (!a) throw new NotFoundException('Agendamento não disponível.');
      const novo=planejarComandoAgendamento(a,acao,revisaoEsperada,usuario.usuarioId,new Date());
      // A espera pela agenda pode ultrapassar a validade da sessão; não reler fora de ordem.
      const sessao=await m.getRepository(SessaoUsuarioOrm).findOne({where:{id:usuario.sessaoId,tenantId,usuarioId:usuario.usuarioId},select:{id:true,expiraEm:true}});
      if (!sessao || sessao.expiraEm.getTime()<=Date.now()) throw new UnauthorizedException('Sessão encerrada.');
      const {affected}=await repo.update({id:a.id,tenantId,revisao:revisaoEsperada},{ativo:novo.ativo,pausadoEm:novo.pausadoEm,
        proximaExecucaoEm:novo.proximaExecucaoEm,autorizadoPorUsuarioId:novo.autorizadoPorUsuarioId,revisao:novo.revisao});
      if(affected!==1)throw new ConflictException('Agendamento alterado. Confira e confirme novamente.');
      await registrarAuditoriaNaTransacao(m,{tenantId,usuarioId:usuario.usuarioId,acao:`questionarios.agendamento.${acao}`,recursoTipo:'agendamento_questionario',recursoId:a.id});
      return projetarAgendamento(novo);
    });
  }

  async criarEnvioQuestionarioManual(
    tenantId: string,
    questionarioId: string,
    dados: CriarEnvioQuestionarioManualDto,
    usuario: UsuarioAutenticado
  ): Promise<EnvioQuestionarioManualResposta> {
    const envio = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      const snapshotEstrutura = await this.capturarSnapshotEstruturaQuestionario(gerenciador, tenantId, questionario);

      await this.garantirPacienteAtivoDoProfissional(gerenciador, tenantId, dados.pacienteId, usuario);

      const agora = new Date();
      return gerenciador.getRepository(EnvioQuestionarioOrm).save(
        gerenciador.getRepository(EnvioQuestionarioOrm).create({
          tenantId,
          questionarioId,
          pacienteId: dados.pacienteId,
          status: 'enviado',
          enviadoEm: agora,
          expiraEm: dados.expiraEm ? new Date(dados.expiraEm) : new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000),
          snapshotEstrutura
        })
      );
    });

    const tokenFormulario = this.gerarTokenFormularioPaciente(tenantId, envio.id);
    return Object.assign(envio, {
      tokenFormulario,
      linkFormulario: this.montarLinkFormulario(tokenFormulario)
    });
  }

  async criarEnviosQuestionarioLote(
    tenantId: string,
    questionarioId: string,
    dados: CriarEnviosQuestionarioLoteDto,
    usuario: UsuarioAutenticado
  ): Promise<{ total: number }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      if (questionario.status !== 'publicado') throw new BadRequestException('Questionario nao publicado.');
      const snapshotEstrutura = await this.capturarSnapshotEstruturaQuestionario(gerenciador, tenantId, questionario);
      for (const pacienteId of dados.pacienteIds) {
        await this.garantirPacienteAtivoDoProfissional(gerenciador, tenantId, pacienteId, usuario);
      }
      const repositorio = gerenciador.getRepository(EnvioQuestionarioOrm);
      const agora = new Date();
      const expiraEm = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
      const envios = dados.pacienteIds.map((pacienteId) => repositorio.create({
        tenantId,
        questionarioId,
        pacienteId,
        status: 'enviado',
        enviadoEm: agora,
        expiraEm,
        snapshotEstrutura
      }));
      await repositorio.save(envios);
      return { total: envios.length };
    });
  }

  async marcarEnvioComoRevisado(
    tenantId: string,
    envioId: string,
    usuario: UsuarioAutenticado
  ): Promise<EnvioQuestionarioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorioEnvios = gerenciador.getRepository(EnvioQuestionarioOrm);
      const envio = await repositorioEnvios.findOne({
        where: { id: envioId, tenantId, status: 'respondido' },
        lock: { mode: 'pessimistic_write' }
      });

      if (!envio) {
        throw new NotFoundException('Envio nao encontrado.');
      }

      if (profissionalId) {
        const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
          where: {
            id: envio.pacienteId,
            tenantId,
            profissionalResponsavelId: profissionalId
          }
        });
        if (!paciente) {
          throw new NotFoundException('Envio nao encontrado.');
        }
      }

      if (envio.revisadoEm) {
        return envio;
      }

      envio.revisadoEm = new Date();
      envio.revisadoPorUsuarioId = usuario.usuarioId;
      return repositorioEnvios.save(envio);
    });
  }

  async listarVersoesQuestionario(
    tenantId: string,
    questionarioId: string,
    usuario: UsuarioAutenticado
  ): Promise<VersaoQuestionario[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');

      const envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({ where: { tenantId, questionarioId } });
      const enviosOrdenados = [...envios].sort(
        (a, b) => new Date(a.enviadoEm ?? 0).getTime() - new Date(b.enviadoEm ?? 0).getTime()
      );

      const porVersao = new Map<number, { snapshot: SnapshotEstruturaQuestionario; capturadoEm?: Date; totalEnvios: number }>();
      for (const envio of enviosOrdenados) {
        if (!envio.snapshotEstrutura) continue;
        const versao = envio.snapshotEstrutura.versaoQuestionario;
        const existente = porVersao.get(versao);
        if (existente) {
          existente.totalEnvios += 1;
        } else {
          porVersao.set(versao, { snapshot: envio.snapshotEstrutura, capturadoEm: envio.enviadoEm, totalEnvios: 1 });
        }
      }

      const versaoAtualDados = porVersao.get(questionario.versao);
      const snapshotAtual = await this.capturarSnapshotEstruturaQuestionario(gerenciador, tenantId, questionario);
      porVersao.delete(questionario.versao);

      const versoes: VersaoQuestionario[] = [
        {
          ...snapshotAtual,
          atual: true,
          capturadoEm: versaoAtualDados?.capturadoEm,
          totalEnvios: versaoAtualDados?.totalEnvios ?? 0
        },
        ...[...porVersao.values()].map(({ snapshot, capturadoEm, totalEnvios }) => ({
          ...snapshot,
          atual: false,
          capturadoEm,
          totalEnvios
        }))
      ];

      return versoes.sort((a, b) => b.versaoQuestionario - a.versaoQuestionario);
    });
  }

  async obterCompletudeHistorica(tenantId: string, questionarioId: string, respostaId: string, usuario: UsuarioAutenticado) {
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const { resposta, envio, valores } = await this.lerRespostaHistoricaAutorizada(gerenciador, tenantId, questionarioId, respostaId, usuario);
      let completude = calcularCompletudeHistorica(envio.snapshotEstrutura, valores, valor => this.valorPreenchido(valor));
      if (completude.estado === 'disponivel') {
        // Leitura factual de presença, não revalidação clínica de uma submissão antiga.
        if (!envio.snapshotEstrutura!.perguntas.every(p => validarTipoPergunta(p.tipo))) {
          completude = completudeDesconhecida('snapshot_invalido');
        } else if (!valores.every(({ valor }) => valor === null || valor === undefined ||
          typeof valor === 'string' || typeof valor === 'boolean' ||
          (typeof valor === 'number' && Number.isFinite(valor)) ||
          (Array.isArray(valor) && valor.every(item => typeof item === 'string')))) {
          completude = completudeDesconhecida('respostas_incompativeis');
        }
      }
      return { respostaId: resposta.id, envioId: envio.id, completude };
    });
  }

  private async lerRespostaHistoricaAutorizada(gerenciador: EntityManager, tenantId: string, questionarioId: string, respostaId: string, usuario: UsuarioAutenticado) {
    // Ordem global: questionário → paciente → envio. Autorizar antes do snapshot/valores.
    await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
    const resposta = await gerenciador.getRepository(RespostaCheckinOrm).findOne({
      where: { id: respostaId, tenantId },
      select: { id: true, pacienteId: true, envioQuestionarioId: true, finalizadoEm: true }
    });
    // A data histórica é opcional: a conclusão é comprovada pelo envio respondido abaixo.
    if (!resposta) throw new NotFoundException('Resposta indisponível.');
    const paciente = await this.garantirPacienteAtivoDoProfissional(gerenciador, tenantId, resposta.pacienteId, usuario, 'pessimistic_read', true);
    if (paciente.statusCicloVida === 'DELETED' || paciente.statusCicloVida === 'DELETION_PENDING') throw new NotFoundException('Resposta indisponível.');
    const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({
      where: { id: resposta.envioQuestionarioId, tenantId, questionarioId, pacienteId: paciente.id, status: 'respondido' },
      select: { id: true, snapshotEstrutura: true }, lock: { mode: 'pessimistic_read' }
    });
    if (!envio) throw new NotFoundException('Resposta indisponível.');
    const valores = await gerenciador.getRepository(RespostaValorOrm).find({
      where: { tenantId, respostaCheckinId: resposta.id }, select: { perguntaId: true, valor: true }
    });
    return { resposta, envio, valores };
  }

  /** Internal transaction boundary for bounded readers. Authorization is never conveyed by a cursor. */
  async lerQuestionarioAutorizado<T>(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado,
    ler: (gerenciador: EntityManager, profissionalId: string | undefined) => Promise<T>): Promise<T> {
    return this.executorTenant.executar(tenantId, async gerenciador => {
      await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, 'pessimistic_read');
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      if (profissionalId) {
        const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
          where: {id: profissionalId, tenantId, usuarioId: usuario.usuarioId, arquivadoEm: IsNull()},
          select: {id: true}, lock: {mode: 'pessimistic_read'}
        });
        if (!profissional) throw new NotFoundException('Questionário indisponível.');
      }
      return ler(gerenciador, profissionalId);
    });
  }

  async listarRespostasQuestionario(
    tenantId: string,
    questionarioId: string,
    usuario: UsuarioAutenticado,
    idsExportacao?: string[]
  ): Promise<RespostaQuestionarioRecebida[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario);

      let envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
        where: { tenantId, questionarioId }, ...(idsExportacao ? { select: { id: true } } : {})
      });
      const respostasCheckin = envios.length
        ? await gerenciador.getRepository(RespostaCheckinOrm).find({
            where: { tenantId, envioQuestionarioId: In(envios.map((envio) => envio.id)), ...(idsExportacao ? { id: In(idsExportacao) } : {}) },
            ...(idsExportacao ? { select: { id: true, pacienteId: true, envioQuestionarioId: true, finalizadoEm: true } } : {})
          })
        : [];

      if (idsExportacao) {
        const encontrados = new Set(respostasCheckin.map(resposta => resposta.id));
        if (idsExportacao.some(id => !encontrados.has(id))) throw new NotFoundException('Seleção de respostas indisponível. Atualize a consulta.');
        const pacienteIds = [...new Set(respostasCheckin.map(resposta => resposta.pacienteId))].sort();
        const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
        // Autorizar e manter a carteira estável antes da leitura dos valores.
        const permitidos: { id: string }[] = await gerenciador.query(
          `SELECT id FROM pacientes WHERE tenant_id = $1 AND id = ANY($2::uuid[])
           AND arquivado_em IS NULL AND ($3::uuid IS NULL OR profissional_responsavel_id = $3)
           ORDER BY id FOR SHARE`, [tenantId, pacienteIds, profissionalId ?? null]
        );
        const autorizados = new Set(permitidos.map(p => p.id));
        if (pacienteIds.some(id => !autorizados.has(id))) throw new NotFoundException('Seleção de respostas indisponível. Atualize a consulta.');
        const idsEnvio = [...new Set(respostasCheckin.map(resposta => resposta.envioQuestionarioId))];
        envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
          where: { tenantId, questionarioId, id: In(idsEnvio) },
          select: { id: true, questionarioId: true, snapshotEstrutura: true }
        });
        if (envios.length !== idsEnvio.length) throw new NotFoundException('Seleção de respostas indisponível. Atualize a consulta.');
      }

      const enviosPorId = new Map(envios.map((envio) => [envio.id, envio]));

      const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId },
        order: { ordem: 'ASC' }
      });
      const perguntasPorId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
      const valores = respostasCheckin.length
        ? await gerenciador.getRepository(RespostaValorOrm).find({
            where: { tenantId, respostaCheckinId: In(respostasCheckin.map((resposta) => resposta.id)) }
          })
        : [];

      const valoresPorResposta = new Map<string, RespostaValorOrm[]>();
      valores.forEach((valor) => {
        const atuais = valoresPorResposta.get(valor.respostaCheckinId) ?? [];
        atuais.push(valor);
        valoresPorResposta.set(valor.respostaCheckinId, atuais);
      });

      return respostasCheckin
        .sort((a, b) => (b.finalizadoEm?.getTime() ?? 0) - (a.finalizadoEm?.getTime() ?? 0))
        .map((resposta) => {
          const envio = enviosPorId.get(resposta.envioQuestionarioId);
          const respostas = (valoresPorResposta.get(resposta.id) ?? []).flatMap((valor) => {
            const pergunta = envio?.snapshotEstrutura?.perguntas.find((item) => item.id === valor.perguntaId) ?? perguntasPorId.get(valor.perguntaId);
            if (!pergunta) return [];
            return {
              perguntaId: pergunta.id,
              enunciado: pergunta.enunciado,
              tipo: pergunta.tipo,
              valor: valor.valor
            };
          });

          return {
            respostaId: resposta.id,
            envioId: resposta.envioQuestionarioId,
            pacienteId: resposta.pacienteId,
            questionarioId: envio?.questionarioId ?? questionarioId,
            finalizadoEm: resposta.finalizadoEm,
            totalRespostas: respostas.length,
            respostas
          };
        });
    });
  }

  /**
   * Exportacao das respostas em formato largo: uma linha por resposta e uma
   * coluna por pergunta, que e como a clinica usa a planilha. Reaproveita
   * `listarRespostasQuestionario`, entao o questionario de outro profissional
   * continua barrado pela mesma checagem.
   */
  async exportarRespostasCsv(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado, respostaIds?: string[]): Promise<string> {
    let ids: string[] | undefined;
    if (respostaIds !== undefined) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!Array.isArray(respostaIds) || !respostaIds.length || respostaIds.length > 1000 || respostaIds.some(id => typeof id !== 'string' || !uuid.test(id))) {
        throw new BadRequestException('Selecione entre 1 e 1000 envios válidos. Refine os filtros se necessário.');
      }
      ids = respostaIds.map(id => id.toLowerCase());
      if (new Set(ids).size !== ids.length) throw new BadRequestException('Seleção de respostas inválida.');
    }
    const respostas = await this.listarRespostasQuestionario(tenantId, questionarioId, usuario, ids);

    return formatarCsvRespostas(respostas);
  }

  async obterLeituraClinicaQuestionario(
    tenantId: string,
    questionarioId: string,
    filtros: FiltrosLeituraClinicaQuestionario = {},
    usuario: UsuarioAutenticado
  ): Promise<LeituraClinicaQuestionario> {
    const respostas = await this.listarRespostasQuestionario(tenantId, questionarioId, usuario);
    const respostasFiltradas = filtros.pacienteId ? respostas.filter((resposta) => resposta.pacienteId === filtros.pacienteId) : respostas;
    const perguntas = await this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(PerguntaOrm).find({ where: { tenantId, questionarioId }, order: { ordem: 'ASC' } })
    );
    return resumirRespostas(questionarioId, respostasFiltradas, perguntas, filtros.pacienteId);
  }

  async obterMatrizLongitudinalRespostas(
    tenantId: string,
    filtros: FiltrosMatrizLongitudinalDto,
    usuario: UsuarioAutenticado
  ): Promise<MatrizLongitudinalRespostas> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const questionarios = await gerenciador.getRepository(QuestionarioOrm).find({
        where: { tenantId, ...(profissionalId ? { profissionalId } : {}) }
      });
      const questionariosFiltrados = filtros.questionarioId
        ? questionarios.filter((questionario) => questionario.id === filtros.questionarioId)
        : questionarios;
      const questionariosPorId = new Map(questionariosFiltrados.map((questionario) => [questionario.id, questionario]));
      if (!questionariosPorId.size) {
        return { filtros, resumo: { totalRespostas: 0, totalIndicadores: 0 }, indicadores: [] };
      }
      const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId: In([...questionariosPorId.keys()]) }
      });
      const perguntasPorId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));

      const envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
        where: { tenantId, questionarioId: In([...questionariosPorId.keys()]) }
      });
      const enviosFiltrados = filtros.pacienteId ? envios.filter((envio) => envio.pacienteId === filtros.pacienteId) : envios;
      const pacientesPermitidos = profissionalId
        ? new Set(
            (
              await gerenciador.getRepository(PacienteOrm).find({
                where: { tenantId, profissionalResponsavelId: profissionalId }
              })
            ).map((paciente) => paciente.id)
          )
        : undefined;
      const enviosVisiveis = pacientesPermitidos ? enviosFiltrados.filter((envio) => pacientesPermitidos.has(envio.pacienteId)) : enviosFiltrados;
      const enviosPorId = new Map(enviosVisiveis.map((envio) => [envio.id, envio]));
      const respostas = enviosPorId.size
        ? await gerenciador.getRepository(RespostaCheckinOrm).find({
            where: { tenantId, envioQuestionarioId: In([...enviosPorId.keys()]) }
          })
        : [];
      const inicioEm = filtros.inicioEm ? new Date(filtros.inicioEm) : undefined;
      const fimEm = filtros.fimEm ? new Date(filtros.fimEm) : undefined;
      if (fimEm && filtros.fimEm?.length === 10) fimEm.setHours(23, 59, 59, 999);
      const respostasFiltradas = respostas.filter(
        (resposta) =>
          resposta.finalizadoEm &&
          (!inicioEm || resposta.finalizadoEm >= inicioEm) &&
          (!fimEm || resposta.finalizadoEm <= fimEm)
      );
      const valores = respostasFiltradas.length
        ? await gerenciador.getRepository(RespostaValorOrm).find({
            where: { tenantId, respostaCheckinId: In(respostasFiltradas.map((resposta) => resposta.id)) }
          })
        : [];
      const respostasPorId = new Map(respostasFiltradas.map((resposta) => [resposta.id, resposta]));
      const indicadoresPorChave = new Map<string, MatrizLongitudinalRespostas['indicadores'][number]>();

      valores.forEach((valor) => {
        const resposta = respostasPorId.get(valor.respostaCheckinId);
        const envio = resposta ? enviosPorId.get(resposta.envioQuestionarioId) : undefined;
        const pergunta = envio?.snapshotEstrutura?.perguntas.find((item) => item.id === valor.perguntaId) ?? perguntasPorId.get(valor.perguntaId);
        const numero = Number(valor.valor);
        if (
          !resposta?.finalizadoEm ||
          !envio ||
          !pergunta ||
          !['likert', 'linear', 'metrica'].includes(pergunta.tipo) ||
          !Number.isFinite(numero) ||
          (filtros.categoriaId && pergunta.categoriaId !== filtros.categoriaId)
        ) {
          return;
        }

        const chave = `${resposta.pacienteId}:${envio.questionarioId}:${pergunta.id}`;
        const indicador: MatrizLongitudinalRespostas['indicadores'][number] = indicadoresPorChave.get(chave) ?? {
          pacienteId: resposta.pacienteId,
          questionarioId: envio.questionarioId,
          questionarioTitulo: questionariosPorId.get(envio.questionarioId)?.titulo ?? 'Questionario',
          perguntaId: pergunta.id,
          categoriaId: pergunta.categoriaId,
          enunciado: pergunta.enunciado,
          tipo: pergunta.tipo as Extract<TipoPergunta, 'likert' | 'linear' | 'metrica'>,
          unidade: typeof pergunta.configuracao.unidade === 'string' ? pergunta.configuracao.unidade : undefined,
          atual: { valor: numero, finalizadoEm: resposta.finalizadoEm },
          historico: []
        };
        indicador.historico.push({ valor: numero, finalizadoEm: resposta.finalizadoEm });
        indicadoresPorChave.set(chave, indicador);
      });

      const indicadores = [...indicadoresPorChave.values()]
        .map((indicador) => {
          const historico = indicador.historico.sort((a, b) => b.finalizadoEm.getTime() - a.finalizadoEm.getTime());
          const [atual, anterior] = historico;
          return {
            ...indicador,
            atual,
            anterior,
            delta: anterior ? this.arredondarMedia(atual.valor - anterior.valor, 1) : undefined,
            historico
          };
        })
        .sort((a, b) => b.atual.finalizadoEm.getTime() - a.atual.finalizadoEm.getTime());
      const datas = respostasFiltradas.map((resposta) => resposta.finalizadoEm as Date).sort((a, b) => a.getTime() - b.getTime());

      return {
        filtros,
        resumo: {
          totalRespostas: respostasFiltradas.length,
          totalIndicadores: indicadores.length,
          primeiraRespostaEm: datas[0],
          ultimaRespostaEm: datas.at(-1)
        },
        indicadores
      };
    });
  }

  private validarAtorCopia(tenantId: string, usuario: UsuarioAutenticado) {
    if (tenantId !== usuario.tenantId || !['SuperAdmin', 'Professional', 'Collaborator'].includes(usuario.papel) ||
        !usuario.permissoes.includes('questionarios.gerenciar')) {
      throw new ForbiddenException('Usuário sem permissão para copiar perguntas.');
    }
    if (!usuario.sessaoId) throw new UnauthorizedException('Sessão ativa necessária para copiar perguntas.');
  }

  private async executarComandoCopia<T>(tenantId: string, operacao: (gerenciador: EntityManager) => Promise<T>): Promise<T> {
    try { return await this.executorTenant.executar(tenantId, operacao); }
    catch (erro) {
      const codigo = (erro as { code?: string; driverError?: { code?: string } })?.driverError?.code ?? (erro as { code?: string })?.code;
      if (['40P01', '40001', '55P03'].includes(codigo ?? '')) {
        throw new ConflictException('Conflito de edição. Confira o questionário antes de tentar novamente.');
      }
      throw erro;
    }
  }

  private async carregarEstadoCopia(gerenciador: EntityManager, tenantId: string, questionarioId: string, perguntaId: string,
    usuario: UsuarioAutenticado, trava: 'pessimistic_read' | 'pessimistic_write') {
    const questionario = await this.garantirQuestionarioDoProfissional(gerenciador, tenantId, questionarioId, usuario, trava);
    // Verificação atual após eventual espera pelo pai. As travas compartilhadas
    // preservam identidade/sessão/vínculo até o commit, sem ler campos protegidos.
    const identidade = await gerenciador.getRepository(UsuarioOrm).findOne({
      where: { id: usuario.usuarioId, tenantId, ativo: true, role: usuario.papel },
      select: { id: true }, lock: { mode: 'pessimistic_read' }
    });
    const sessao = await gerenciador.getRepository(SessaoUsuarioOrm).findOne({
      where: { id: usuario.sessaoId, usuarioId: usuario.usuarioId, tenantId, revogadoEm: IsNull() },
      select: { id: true, expiraEm: true }, lock: { mode: 'pessimistic_read' }
    });
    // O relógio precisa ser consultado depois da espera pelo lock da sessão.
    if (!identidade || !sessao || sessao.expiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão encerrada ou acesso alterado.');
    if (usuario.papel === 'Professional') {
      const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
        where: { id: questionario.profissionalId, tenantId, usuarioId: usuario.usuarioId, arquivadoEm: IsNull() },
        select: { id: true }, lock: { mode: 'pessimistic_read' }
      });
      if (!profissional) throw new NotFoundException('Questionario nao encontrado.');
    }
    if (questionario.status !== 'rascunho') throw new ConflictException('A cópia está disponível somente em rascunhos.');
    const [legados] = await gerenciador.query(`SELECT EXISTS(SELECT 1 FROM envios_questionario
      WHERE tenant_id=$1 AND questionario_id=$2 AND NOT COALESCE(
        jsonb_typeof(snapshot_estrutura)='object' AND jsonb_typeof(snapshot_estrutura->'perguntas')='array', false)) AS bloqueado`,
      [tenantId, questionarioId]);
    if (legados.bloqueado) throw new ConflictException('A cópia não está disponível enquanto houver envios sem versão preservada.');
    const lista = await gerenciador.getRepository(PerguntaOrm).find({
      where: { tenantId, questionarioId }, order: { ordem: 'ASC', id: 'ASC' }
    });
    const perguntas = await this.anexarOpcoesLote(gerenciador, lista);
    perguntas.forEach((pergunta) => pergunta.opcoes.sort((a, b) => a.ordem - b.ordem || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
    const origem = perguntas.find((pergunta) => pergunta.id === perguntaId.toLowerCase());
    if (!origem) throw new NotFoundException('Pergunta nao encontrada.');
    if (!validarTipoPergunta(origem.tipo)) throw new BadRequestException('Tipo de pergunta não suportado.');
    this.validarOpcoes(origem.tipo, origem.opcoes);
    return { questionario, perguntas, origem, sessaoExpiraEm: sessao.expiraEm };
  }

  private revisaoCopia(questionario: QuestionarioOrm, perguntas: PerguntaComOpcoes[], perguntaId: string, usuario: UsuarioAutenticado): string {
    const ordenar = (valor: unknown): unknown => {
      if (Array.isArray(valor)) return valor.map(ordenar);
      if (valor !== null && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([chave, item]) => [chave, ordenar(item)]));
      }
      return valor;
    };
    const agregado = { id: questionario.id, profissionalId: questionario.profissionalId, versao: questionario.versao,
      status: questionario.status, titulo: questionario.titulo, descricao: questionario.descricao,
      perguntas: perguntas.map((pergunta) => ({ id: pergunta.id, ordem: pergunta.ordem, chaveClinica: pergunta.chaveClinica,
        ...copiarDefinicaoPergunta(pergunta), visivelBiblioteca: pergunta.visivelBiblioteca,
        opcoes: pergunta.opcoes.map(({ id, rotulo, valor, imagemUrl, ordem }) => ({ id, rotulo, valor, imagemUrl, ordem })) })) };
    return createHmac('sha256', obterSegredoFormularioPublico())
      .update(JSON.stringify(ordenar(['octaclin:qst-p05:revisao:v1', usuario.tenantId, usuario.usuarioId, usuario.papel, usuario.sessaoId, perguntaId, agregado])))
      .digest('hex');
  }

  private async garantirQuestionarioDoProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    questionarioId: string,
    usuario: UsuarioAutenticado,
    trava?: 'pessimistic_read' | 'pessimistic_write'
  ): Promise<QuestionarioOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
      where: { id: questionarioId, tenantId, ...(profissionalId ? { profissionalId } : {}) },
      ...(trava ? { lock: { mode: trava } } : {})
    });

    if (!questionario) {
      throw new NotFoundException('Questionario nao encontrado.');
    }

    return questionario;
  }

  private arredondarMedia(total: number, divisor: number): number {
    if (!divisor) return 0;
    return Math.round((total / divisor) * 100) / 100;
  }


  gerarTokenFormularioPaciente(tenantId: string, envioId: string): string {
    const assinatura = this.assinarTokenFormulario(tenantId, envioId);
    return `${tenantId}.${envioId}.${assinatura}`;
  }

  async obterContextoFormularioPaciente(token: string) {
    const { tenantId, envioId } = this.validarTokenFormulario(token);
    const formulario = await this.obterFormularioPaciente(token);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({ where: { id: envioId, tenantId } });
      this.validarEnvioFormulario(envio);
      return { tenantId, envioId, pacienteId: envio.pacienteId, perguntas: formulario.perguntas };
    });
  }

  async obterFormularioPaciente(token: string): Promise<FormularioPacientePublico> {
    const { tenantId, envioId } = this.validarTokenFormulario(token);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({ where: { id: envioId, tenantId } });
      this.validarEnvioFormulario(envio);

      if (envio.snapshotEstrutura) {
        return {
          envioId: envio.id,
          titulo: envio.snapshotEstrutura.titulo,
          descricao: envio.snapshotEstrutura.descricao,
          status: envio.status,
          expiraEm: envio.expiraEm,
          perguntas: envio.snapshotEstrutura.perguntas,
          respostasRascunho: envio.respostasRascunho,
          rascunhoAtualizadoEm: envio.rascunhoAtualizadoEm,
          rascunhoVersao: envio.rascunhoVersao ?? 0
        };
      }

      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: envio.questionarioId, tenantId }, lock: { mode: 'pessimistic_read' }
      });
      if (!questionario) throw new NotFoundException('Questionario nao encontrado.');

      const perguntas = await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, questionario.id);

      return {
        envioId: envio.id,
        titulo: questionario.titulo,
        descricao: questionario.descricao,
        status: envio.status,
        expiraEm: envio.expiraEm,
        perguntas,
        respostasRascunho: envio.respostasRascunho,
        rascunhoAtualizadoEm: envio.rascunhoAtualizadoEm,
        rascunhoVersao: envio.rascunhoVersao ?? 0
      };
    });
  }

  async salvarRascunhoFormularioPaciente(token: string, dados: SalvarRascunhoFormularioPacienteDto) {
    const { tenantId, envioId } = this.validarTokenFormulario(token);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(EnvioQuestionarioOrm);
      const envio = await repositorio.findOne({ where: { id: envioId, tenantId } });
      this.validarEnvioFormulario(envio);

      const versaoAtual = envio.rascunhoVersao ?? 0;
      if (versaoAtual !== dados.versaoBase) {
        throw new ConflictException('Rascunho atualizado em outro dispositivo.');
      }

      const perguntas = envio.snapshotEstrutura?.perguntas ??
        (await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, envio.questionarioId));
      this.validarEstruturaRespostas(perguntas, dados.respostas);
      await this.validarAnexosFormulario(gerenciador, tenantId, envio, perguntas, dados.respostas);

      const agora = new Date();
      const proximaVersao = versaoAtual + 1;
      const resultado = await repositorio.update(
        { id: envioId, tenantId, status: envio.status, rascunhoVersao: versaoAtual },
        {
          respostasRascunho: dados.respostas.map((resposta) => ({ perguntaId: resposta.perguntaId, valor: resposta.valor })) as never,
          rascunhoAtualizadoEm: agora,
          rascunhoVersao: proximaVersao
        }
      );
      if (!resultado.affected) throw new ConflictException('Rascunho atualizado em outro dispositivo.');

      return { rascunhoVersao: proximaVersao, rascunhoAtualizadoEm: agora };
    });
  }

  async finalizarFormularioPaciente(token: string, dados: FinalizarFormularioPacienteDto) {
    const { tenantId, envioId } = this.validarTokenFormulario(token);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioEnvios = gerenciador.getRepository(EnvioQuestionarioOrm);
      const envio = await repositorioEnvios.findOne({
        where: { id: envioId, tenantId },
        lock: { mode: 'pessimistic_write' }
      });
      if (envio?.status === 'respondido') {
        const respostaExistente = await gerenciador.getRepository(RespostaCheckinOrm).findOne({
          where: { envioQuestionarioId: envio.id, tenantId }
        });
        if (respostaExistente) {
          return {
            envioId: envio.id,
            respostaCheckinId: respostaExistente.id,
            status: envio.status,
            respondidoEm: envio.respondidoEm ?? respostaExistente.finalizadoEm
          };
        }
      }
      this.validarEnvioFormulario(envio);

      const perguntas = envio.snapshotEstrutura?.perguntas ?? (await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, envio.questionarioId));
      this.validarEstruturaRespostas(perguntas, dados.respostas);
      this.validarRespostasObrigatorias(perguntas, dados.respostas);
      await this.validarAnexosFormulario(gerenciador, tenantId, envio, perguntas, dados.respostas);

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
      envio.respostasRascunho = undefined;
      envio.rascunhoAtualizadoEm = undefined;
      envio.rascunhoVersao = 0;
      await repositorioEnvios.save(envio);

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: envio.pacienteId, tenantId } });
      if (paciente) {
        paciente.ultimoCheckinEm = agora;
        await gerenciador.getRepository(PacienteOrm).save(paciente);
      }

      await registrarNotificacao(gerenciador, tenantId, {
        tipo: 'formulario_respondido',
        recursoTipo: 'envio_questionario',
        recursoId: envio.id,
        pacienteId: envio.pacienteId
      });

      await registrarEventoWebhook(gerenciador, tenantId, {
        evento: 'formulario.respondido',
        recursoTipo: 'envio_questionario',
        recursoId: envio.id,
        dados: {
          envioId: envio.id,
          questionarioId: envio.questionarioId,
          pacienteId: envio.pacienteId,
          respostaId: respostaCheckin.id,
          respondidoEm: agora.toISOString()
        }
      });

      // Fundacao duravel do PB-03: cria execucao + outbox na mesma transacao do
      // fato de origem. So IDs opacos entram no contexto — nunca a resposta do
      // formulario. Publicar na fila fica a cargo do outbox (retomavel).
      await dispararGatilhoAutomacao(gerenciador, tenantId, {
        tipo: 'questionario.respondido',
        pacienteId: envio.pacienteId,
        origemTipo: 'envio_questionario',
        origemId: envio.id,
        contexto: { evento: 'questionario.respondido', envioId: envio.id }
      });

      return {
        envioId: envio.id,
        respostaCheckinId: respostaCheckin.id,
        status: envio.status,
        respondidoEm: envio.respondidoEm
      };
    });
  }

  async processarAgendamentosVencidos(tenantId: string, agora = new Date()): Promise<number> {
    // Expiração independente: não segurar locks de envios enquanto adquire os de geração.
    await this.executorTenant.executar(tenantId, async m => {
      const repo=m.getRepository(EnvioQuestionarioOrm);
      const expirados=await repo.find({where:{tenantId,status:In(['pendente','enviado']),expiraEm:LessThanOrEqual(agora)}});
      for(const envio of expirados){envio.status='expirado';envio.respostasRascunho=undefined;envio.rascunhoAtualizadoEm=undefined;envio.rascunhoVersao=0;}
      if(expirados.length)await repo.save(expirados);
    });
    const candidatos=await this.executorTenant.executar(tenantId,m=>m.getRepository(AgendamentoQuestionarioOrm).find({
      where:{tenantId,ativo:true,autorizadoPorUsuarioId:Not(IsNull()),pacienteId:Not(IsNull()),proximaExecucaoEm:LessThanOrEqual(agora)},
      select:{id:true,questionarioId:true,pacienteId:true,autorizadoPorUsuarioId:true,revisao:true},
      order:{proximaExecucaoEm:'ASC',id:'ASC'},take:100,
    }));
    let total=0;
    for(const candidato of candidatos){
      // Legados não têm autoridade presumida. Nenhum envio/link anterior é alterado.
      if(!candidato.autorizadoPorUsuarioId || !candidato.pacienteId)continue;
      try{
        total+=await this.executorTenant.executar(tenantId,async m=>{
          await autorizarContextoAgendamento(m,tenantId,candidato.questionarioId,candidato.pacienteId!,candidato.autorizadoPorUsuarioId!);
          const repo=m.getRepository(AgendamentoQuestionarioOrm);
          const a=await repo.findOne({where:{id:candidato.id,tenantId},lock:{mode:'pessimistic_write'}});
          // Releitura depois da espera é obrigatória; candidato não é autorização nem reserva.
          if(!a || a.revisao!==candidato.revisao || a.questionarioId!==candidato.questionarioId || a.pacienteId!==candidato.pacienteId
            || a.autorizadoPorUsuarioId!==candidato.autorizadoPorUsuarioId || !a.ativo || a.pausadoEm
            || !a.proximaExecucaoEm || a.proximaExecucaoEm>agora)return 0;
          if(a.revisao>=2147483647)throw new ConflictException('Revisão de agendamento esgotada.');
          const q=await m.getRepository(QuestionarioOrm).findOne({where:{id:a.questionarioId,tenantId}});
          if(!q)return 0;
          const snapshotEstrutura=await this.capturarSnapshotEstruturaQuestionario(m,tenantId,q);
          const envios=m.getRepository(EnvioQuestionarioOrm);
          await envios.save(envios.create({tenantId,questionarioId:a.questionarioId,pacienteId:a.pacienteId,
            agendamentoId:a.id,status:'pendente',snapshotEstrutura}));
          const proxima=a.regraCron ? this.calcularProximaExecucao(a.regraCron,undefined,a.timezone,agora) : null;
          const {affected}=await repo.update({id:a.id,tenantId,revisao:a.revisao},{ultimaExecucaoEm:agora,
            proximaExecucaoEm:proxima,ativo:!!proxima,revisao:a.revisao+1});
          if(affected!==1)throw new ConflictException('Agendamento alterado.');
          await registrarAuditoriaNaTransacao(m,{tenantId,usuarioId:a.autorizadoPorUsuarioId!,acao:'questionarios.agendamento.gerar',recursoTipo:'agendamento_questionario',recursoId:a.id});
          return 1;
        });
      }catch(erro){
        if(erro instanceof UnauthorizedException || erro instanceof ForbiddenException || erro instanceof NotFoundException){
          // Invalidar apenas a autorização atual do candidato exato. Evita que agendas
          // bloqueadas ocupem indefinidamente o lote; uma reconfirmação concorrente vence pelo CAS.
          await this.executorTenant.executar(tenantId,async m=>{
            const r=await m.getRepository(AgendamentoQuestionarioOrm).update({id:candidato.id,tenantId,
              revisao:candidato.revisao,autorizadoPorUsuarioId:candidato.autorizadoPorUsuarioId!},
              {autorizadoPorUsuarioId:null,revisao:candidato.revisao+1});
            if(r.affected===1)await registrarAuditoriaNaTransacao(m,{tenantId,acao:'questionarios.agendamento.invalidar_autorizacao',recursoTipo:'agendamento_questionario',recursoId:candidato.id});
          });
          continue;
        }
        const codigo=(erro as {code?:string;driverError?:{code?:string}})?.driverError?.code??(erro as {code?:string})?.code;
        // Rollback da ocorrência é integral; não repetir cegamente na mesma execução.
        if(['40P01','40001','55P03'].includes(codigo??''))continue;
        throw erro;
      }
    }
    return total;
  }

  private calcularProximaExecucao(regraCron?:string,dataFixa?:string,timezone='America/Sao_Paulo',base=new Date()):Date {
    return resolverProximaExecucao(regraCron,dataFixa,timezone,base);
  }

  private validarOpcoes(tipo: TipoPergunta, opcoes?: { rotulo: string; valor: string }[], exigirQuandoMultipla = true) {
    if (tipo === 'multipla_escolha' && exigirQuandoMultipla && (!opcoes || opcoes.length < 2)) {
      throw new BadRequestException('Perguntas de multipla escolha exigem pelo menos duas opcoes.');
    }
  }

  private segredoFormulario() {
    return obterSegredoFormularioPublico();
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

  private validarEstruturaRespostas(
    perguntas: Pick<PerguntaSnapshotQuestionario, 'id' | 'tipo' | 'configuracao' | 'opcoes'>[],
    respostas: { perguntaId: string; valor: unknown }[]
  ) {
    const perguntasPorId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
    const ids = new Set<string>();

    for (const resposta of respostas) {
      if (ids.has(resposta.perguntaId)) throw new BadRequestException('Resposta duplicada para a mesma pergunta.');
      ids.add(resposta.perguntaId);

      const pergunta = perguntasPorId.get(resposta.perguntaId);
      if (!pergunta) throw new BadRequestException('Resposta contem pergunta inexistente no formulario.');

      const serializado = JSON.stringify(resposta.valor);
      if (Buffer.byteLength(serializado ?? 'null', 'utf8') > 16 * 1024) {
        throw new BadRequestException('Valor de resposta excede o limite permitido.');
      }

      const configuracao = pergunta.configuracao ?? {};
      const valor = resposta.valor;
      const numeroConfig = (chave: string, padrao: number) => {
        const numero = Number(configuracao[chave]);
        return Number.isFinite(numero) ? numero : padrao;
      };

      if (pergunta.tipo === 'sim_nao' && typeof valor !== 'boolean') {
        throw new BadRequestException('Resposta possui tipo invalido para a pergunta.');
      }
      if (['likert', 'linear', 'metrica'].includes(pergunta.tipo)) {
        const minimo = pergunta.tipo === 'likert' ? numeroConfig('escalaMin', 1) : numeroConfig('minimo', 0);
        const maximo = pergunta.tipo === 'likert' ? numeroConfig('escalaMax', 5) : numeroConfig('maximo', pergunta.tipo === 'linear' ? 10 : 100);
        if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
          throw new BadRequestException('Resposta possui tipo invalido ou valor fora da faixa permitida.');
        }
      }
      if (pergunta.tipo === 'texto_longo') {
        const limite = Math.min(numeroConfig('limiteCaracteres', 1000), 16 * 1024);
        if (typeof valor !== 'string' || valor.length > limite) {
          throw new BadRequestException('Resposta possui tipo invalido ou texto acima do limite permitido.');
        }
      }
      if (pergunta.tipo === 'multipla_escolha') {
        const valores = Array.isArray(valor) ? valor : [valor];
        const multipla = configuracao.multipla === true;
        const permitidos = new Set(pergunta.opcoes.map((opcao) => opcao.valor));
        if ((!multipla && Array.isArray(valor)) || valores.some((item) => typeof item !== 'string' || !permitidos.has(item))) {
          throw new BadRequestException('Resposta possui opcao invalida para a pergunta.');
        }
      }
      if (pergunta.tipo === 'upload_midia') {
        const maxArquivos = numeroConfig('maxArquivos', 1);
        if (!Array.isArray(valor) || valor.length > maxArquivos || valor.some((item) => typeof item !== 'string')) {
          throw new BadRequestException('Resposta possui tipo invalido para o envio de arquivos.');
        }
      }
    }
  }

  private validarRespostasObrigatorias(
    perguntas: Pick<PerguntaOrm, 'id' | 'obrigatoria' | 'enunciado'>[],
    respostas: { perguntaId: string; valor: unknown }[]
  ) {
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

  private async validarAnexosFormulario(
    gerenciador: EntityManager,
    tenantId: string,
    envio: EnvioQuestionarioOrm,
    perguntas: Pick<PerguntaOrm, 'id' | 'tipo'>[],
    respostas: { perguntaId: string; valor: unknown }[]
  ): Promise<void> {
    const perguntasUpload = new Set(perguntas.filter((pergunta) => pergunta.tipo === 'upload_midia').map((pergunta) => pergunta.id));
    const referencias = respostas.flatMap((resposta) =>
      perguntasUpload.has(resposta.perguntaId) && Array.isArray(resposta.valor)
        ? resposta.valor.map((arquivoId) => ({ arquivoId: String(arquivoId), perguntaId: resposta.perguntaId }))
        : []
    );
    if (referencias.length === 0) return;

    const ids = referencias.map((referencia) => referencia.arquivoId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Anexo duplicado no formulario.');
    const arquivos = await gerenciador.getRepository(ArquivoMidiaOrm).find({
      where: { id: In(ids), tenantId, pacienteId: envio.pacienteId, status: 'confirmado' }
    });
    const porId = new Map(arquivos.map((arquivo) => [arquivo.id, arquivo]));
    const invalido = referencias.some(({ arquivoId, perguntaId }) => {
      const vinculo = porId.get(arquivoId)?.metadados?.vinculo as Record<string, string> | undefined;
      return vinculo?.envioid !== envio.id || vinculo.perguntaid !== perguntaId;
    });
    if (invalido) throw new BadRequestException('Anexo nao pertence a este formulario.');
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
    const pai = await gerenciador.getRepository(QuestionarioOrm).findOne({
      where: { tenantId, id: questionarioId }, select: { id: true }, lock: { mode: 'pessimistic_read' }
    });
    if (!pai) throw new NotFoundException('Questionario nao encontrado.');
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

    return perguntas.map((pergunta) => ({ ...pergunta, opcoes: opcoesPorPergunta.get(pergunta.id) ?? [] }));
  }

  private async capturarSnapshotEstruturaQuestionario(
    gerenciador: EntityManager,
    tenantId: string,
    questionario: QuestionarioOrm
  ): Promise<SnapshotEstruturaQuestionario> {
    const perguntas = await this.listarPerguntasComOpcoesPorQuestionario(gerenciador, tenantId, questionario.id);
    return {
      versaoQuestionario: questionario.versao,
      titulo: questionario.titulo,
      descricao: questionario.descricao,
      perguntas: perguntas.map((pergunta) => ({
        id: pergunta.id,
        categoriaId: pergunta.categoriaId,
        tipo: pergunta.tipo,
        enunciado: pergunta.enunciado,
        peso: pergunta.peso,
        obrigatoria: pergunta.obrigatoria,
        configuracao: JSON.parse(JSON.stringify(pergunta.configuracao ?? {})),
        ordem: pergunta.ordem,
        opcoes: pergunta.opcoes.map((opcao) => ({
          id: opcao.id,
          rotulo: opcao.rotulo,
          valor: opcao.valor,
          imagemUrl: opcao.imagemUrl,
          ordem: opcao.ordem
        }))
      }))
    };
  }

  private normalizarChaveClinica(chaveClinica?: string): string | undefined {
    const normalizada = chaveClinica?.trim();
    return normalizada || undefined;
  }

  private async garantirPacienteAtivoDoProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    trava?: 'pessimistic_read',
    somenteAutorizacao = false
  ): Promise<PacienteOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {})
      },
      ...(trava ? { lock: { mode: trava } } : {}),
      ...(somenteAutorizacao ? { select: { id: true, statusCicloVida: true } } : {})
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    return paciente;
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
