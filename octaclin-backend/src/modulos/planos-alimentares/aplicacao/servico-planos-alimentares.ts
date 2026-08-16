import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { AvaliacaoAntropometricaOrm } from '../../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import {
  calcularEstimativaEnergetica,
  calcularMetasMacronutrientes,
  calcularNutrientesDaPorcao,
  NutrientesPor100g,
  SexoCalculoEnergetico
} from '../dominio/calculo-nutricional';
import {
  calcularTotaisPlano,
  EstruturaPlanoAlimentar,
  ItemPlanoAlimentar,
  SubstituicaoPlanoAlimentar,
  validarEstruturaPlano
} from '../dominio/plano-alimentar';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import {
  AtualizarRascunhoPlanoAlimentarDto,
  BuscarAlimentosDto,
  CriarPlanoAlimentarDto,
  ListarPlanosAlimentaresDto,
  PAGINA_MAXIMA,
  NutrientesPor100gDto,
  SubstituicaoPlanoAlimentarDto
} from './dtos';

const MOTOR_CALCULO_VERSAO = '1';
// Limiar operacional para pedir revisao humana; nao representa limite clinico universal.
const LIMIAR_DIVERGENCIA_NUTRICIONAL = 0.3;

// `%` e `_` digitados pelo profissional sao literais na busca, nao curingas do LIKE.
function escaparCuringaLike(termo: string): string {
  return termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

interface MedidasAntropometricasPlano {
  pesoKg?: number;
  alturaCm?: number;
}

export type NutrientesPor100gPlano = Omit<NutrientesPor100g, 'fibrasG' | 'sodioMg'> &
  Partial<Pick<NutrientesPor100g, 'fibrasG' | 'sodioMg'>>;

export interface SnapshotComposicao {
  origem: 'catalogo' | 'manual';
  alimentoComposicaoId?: string;
  codigoOrigem?: string;
  descricao: string;
  preparacao?: string;
  fonte?: {
    codigo: string;
    nome: string;
    versao: string;
    baseCodigo?: string;
    hashConteudo: string;
    checksumArquivo?: string;
    esquemaVersao?: string;
    publicadaEm?: string;
    capturadaEm?: string;
  };
  nutrientesPor100g: NutrientesPor100gPlano;
  nutrientesPorcao: SubstituicaoPlanoAlimentar['nutrientes'];
}

interface ItemResolvido {
  dominio: SubstituicaoPlanoAlimentar;
  snapshot: SnapshotComposicao;
}

@Injectable()
export class ServicoPlanosAlimentares {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listar(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarPlanosAlimentaresDto = new ListarPlanosAlimentaresDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const [planos, total] = await gerenciador.getRepository(PlanoAlimentarOrm).findAndCount({
        where: {
          tenantId,
          pacienteId,
          arquivadoEm: IsNull()
        },
        // `id` desempata: criado_em usa default now() e empata entre linhas da
        // mesma transacao, o que faria OFFSET repetir ou pular um plano.
        order: { criadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      if (!planos.length) return { itens: [], total, pagina, limite };

      const versoes = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).find({
        where: { tenantId, planoId: In(planos.map((plano) => plano.id)) },
        order: { numero: 'DESC' }
      });
      return {
        itens: planos.map((plano) =>
          this.montarResumoPlano(plano, versoes.filter((versao) => versao.planoId === plano.id))
        ),
        total,
        pagina,
        limite
      };
    });
  }

  async obterVersao(
    tenantId: string,
    pacienteId: string,
    planoId: string,
    numero: number,
    usuario: UsuarioAutenticado
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario);
      const versao = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId, numero }
      });
      if (!versao) throw new NotFoundException('Versao do plano alimentar nao encontrada.');
      return this.montarVersao(gerenciador, versao);
    });
  }

  async obter(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario);
      return this.montarPlano(gerenciador, plano);
    });
  }

  async criar(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    dados: CriarPlanoAlimentarDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, true);
      const repositorioPlano = gerenciador.getRepository(PlanoAlimentarOrm);
      const plano = await repositorioPlano.save(
        repositorioPlano.create({
          tenantId,
          pacienteId,
          profissionalId: paciente.profissionalResponsavelId,
          criadoPorUsuarioId: usuario.usuarioId,
          tituloCriptografado: this.criptografia.criptografar(dados.titulo.trim())
        })
      );
      const repositorioVersao = gerenciador.getRepository(PlanoAlimentarVersaoOrm);
      await repositorioVersao.save(
        repositorioVersao.create({
          tenantId,
          planoId: plano.id,
          numero: 1,
          criadoPorUsuarioId: usuario.usuarioId
        })
      );
      return this.montarPlano(gerenciador, plano);
    });
  }

  async obterRascunho(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario);
      const rascunho = await this.obterRascunhoAtivo(gerenciador, tenantId, plano.id);
      return this.montarVersao(gerenciador, rascunho);
    });
  }

  async atualizarRascunho(
    tenantId: string,
    pacienteId: string,
    planoId: string,
    usuario: UsuarioAutenticado,
    dados: AtualizarRascunhoPlanoAlimentarDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    if (!dados.aplicabilidadeFormulaConfirmada) {
      throw new BadRequestException('Confirme explicitamente a aplicabilidade da formula antes de calcular o plano.');
    }
    if (dados.possuiCondicaoEspecial) {
      throw new BadRequestException(
        'Condicao especial informada: o calculo automatico nao e seguro e nao esta disponivel nesta fase.'
      );
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId: plano.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        lock: { mode: 'pessimistic_write' }
      });
      if (!rascunho) throw new NotFoundException('Rascunho do plano alimentar nao encontrado.');

      const avaliacao = await gerenciador.getRepository(AvaliacaoAntropometricaOrm).findOne({
        where: {
          id: dados.avaliacaoAntropometricaId,
          tenantId,
          pacienteId,
          excluidaEm: IsNull()
        }
      });
      const entradaCalculo = this.validarAvaliacaoAntropometrica(avaliacao);
      let estimativa: ReturnType<typeof calcularEstimativaEnergetica>;
      let metasMacronutrientes: ReturnType<typeof calcularMetasMacronutrientes>;
      try {
        estimativa = calcularEstimativaEnergetica({
          formula: dados.formula,
          sexo: entradaCalculo.sexo,
          idadeAnos: entradaCalculo.idadeAnos,
          pesoKg: entradaCalculo.pesoKg,
          alturaCm: entradaCalculo.alturaCm,
          fatorAtividade: dados.fatorAtividade
        });
        const metaEnergeticaKcal = estimativa.gastoEnergeticoTotalKcal + (dados.ajusteEnergeticoKcal ?? 0);
        metasMacronutrientes = calcularMetasMacronutrientes(metaEnergeticaKcal, dados.distribuicaoMacros);
      } catch (erro) {
        throw new BadRequestException(erro instanceof Error ? erro.message : 'Dados invalidos para o calculo nutricional.');
      }

      const estrutura = await this.resolverEstrutura(gerenciador, dados);
      let totais: ReturnType<typeof calcularTotaisPlano>;
      try {
        validarEstruturaPlano(estrutura);
        totais = calcularTotaisPlano(estrutura);
      } catch (erro) {
        throw new BadRequestException(erro instanceof Error ? erro.message : 'Estrutura do plano alimentar invalida.');
      }

      const metaEnergeticaKcal = estimativa.gastoEnergeticoTotalKcal + (dados.ajusteEnergeticoKcal ?? 0);
      const alertasDivergenciaClinica = this.avaliarDivergenciasNutricionais(
        metaEnergeticaKcal,
        metasMacronutrientes,
        totais
      );
      const calculoSnapshot = {
        motorCalculoVersao: MOTOR_CALCULO_VERSAO,
        avaliacao: {
          id: avaliacao!.id,
          avaliadaEm: avaliacao!.avaliadaEm,
          sexo: entradaCalculo.sexo,
          idadeAnos: entradaCalculo.idadeAnos,
          pesoKg: entradaCalculo.pesoKg,
          alturaCm: entradaCalculo.alturaCm
        },
        possuiCondicaoEspecial: dados.possuiCondicaoEspecial,
        justificativaCondicaoEspecial: dados.justificativaCondicaoEspecial?.trim(),
        aplicabilidadeFormulaConfirmada: dados.aplicabilidadeFormulaConfirmada,
        fatorAtividade: dados.fatorAtividade,
        estimativa,
        ajusteEnergeticoKcal: dados.ajusteEnergeticoKcal ?? 0,
        metaEnergeticaKcal,
        distribuicaoMacros: dados.distribuicaoMacros,
        metasMacronutrientes,
        alertasDivergenciaClinica,
        justificativaDivergenciaClinica: dados.justificativaDivergenciaClinica?.trim()
      };

      await this.substituirFilhos(gerenciador, tenantId, rascunho.id, estrutura);
      rascunho.avaliacaoAntropometricaId = avaliacao!.id;
      rascunho.formulaCodigo = estimativa.formulaCodigo;
      rascunho.formulaVersao = estimativa.formulaVersao;
      rascunho.motorCalculoVersao = MOTOR_CALCULO_VERSAO;
      rascunho.objetivosCriptografados = this.criptografia.criptografar(dados.objetivos.trim());
      rascunho.observacoesCriptografadas = dados.observacoes?.trim()
        ? this.criptografia.criptografar(dados.observacoes.trim())
        : undefined;
      rascunho.calculoSnapshotCriptografado = this.criptografia.criptografar(JSON.stringify(calculoSnapshot));
      rascunho.totaisSnapshotCriptografado = this.criptografia.criptografar(JSON.stringify(totais));
      rascunho.revisadaEm = undefined;
      rascunho.revisadaPorUsuarioId = undefined;
      rascunho.hashConteudo = undefined;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      return this.montarVersao(gerenciador, rascunho);
    });
  }

  async revisar(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId: plano.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        lock: { mode: 'pessimistic_write' }
      });
      if (!rascunho) throw new NotFoundException('Rascunho do plano alimentar nao encontrado.');
      this.garantirRascunhoCompleto(rascunho);
      const conteudo = await this.montarVersao(gerenciador, rascunho);
      if (!conteudo.refeicoes.length || conteudo.refeicoes.some((refeicao) => !refeicao.itens.length)) {
        throw new BadRequestException('Preencha todas as refeicoes antes da revisao.');
      }
      rascunho.revisadaEm = new Date();
      rascunho.revisadaPorUsuarioId = usuario.usuarioId;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      return this.montarVersao(gerenciador, rascunho);
    });
  }

  async publicar(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, true);
      const repositorioPlano = gerenciador.getRepository(PlanoAlimentarOrm);
      const plano = await repositorioPlano.findOne({
        where: {
          id: planoId,
          tenantId,
          pacienteId,
          arquivadoEm: IsNull()
        },
        lock: { mode: 'pessimistic_write' }
      });
      if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');
      const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId: plano.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        lock: { mode: 'pessimistic_write' }
      });
      if (!rascunho) throw new NotFoundException('Rascunho do plano alimentar nao encontrado.');
      if (!rascunho.revisadaEm || !rascunho.revisadaPorUsuarioId) {
        throw new ConflictException('Revise o plano alimentar antes de publica-lo.');
      }
      this.garantirRascunhoCompleto(rascunho);
      const conteudo = await this.montarVersao(gerenciador, rascunho);
      if (!conteudo.refeicoes.length || conteudo.refeicoes.some((refeicao) => !refeicao.itens.length)) {
        throw new BadRequestException('Plano alimentar precisa de refeicoes preenchidas para publicacao.');
      }

      rascunho.hashConteudo = createHash('sha256')
        .update(this.serializarEstavel(this.conteudoClinicoParaHash(plano, conteudo)))
        .digest('hex');
      rascunho.publicadaEm = new Date();
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      plano.versaoPublicadaAtualId = rascunho.id;
      await repositorioPlano.save(plano);

      const repositorioAuditoria = gerenciador.getRepository(UserActionLogOrm);
      await repositorioAuditoria.save(
        repositorioAuditoria.create({
          tenantId,
          usuarioId: usuario.usuarioId,
          acao: 'planos_alimentares.publicar',
          recursoTipo: 'plano_alimentar',
          recursoId: plano.id,
          metadados: {
            pacienteId,
            versaoId: rascunho.id,
            numeroVersao: rascunho.numero,
            hashConteudo: rascunho.hashConteudo
          }
        })
      );
      return this.montarPlano(gerenciador, plano);
    });
  }

  async criarNovaVersao(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const repositorioVersao = gerenciador.getRepository(PlanoAlimentarVersaoOrm);
      const rascunhoExistente = await repositorioVersao.findOne({
        where: { tenantId, planoId, publicadaEm: IsNull(), descartadaEm: IsNull() }
      });
      if (rascunhoExistente) throw new ConflictException('Ja existe um rascunho ativo para este plano alimentar.');
      if (!plano.versaoPublicadaAtualId) {
        throw new ConflictException('Publique a primeira versao antes de criar uma nova versao.');
      }
      const publicada = await repositorioVersao.findOne({
        where: { id: plano.versaoPublicadaAtualId, tenantId, planoId, descartadaEm: IsNull() }
      });
      if (!publicada?.publicadaEm) throw new ConflictException('Versao publicada atual nao encontrada.');
      const ultima = await repositorioVersao.find({ where: { tenantId, planoId }, order: { numero: 'DESC' }, take: 1 });
      const nova = await repositorioVersao.save(
        repositorioVersao.create({
          tenantId,
          planoId,
          numero: (ultima[0]?.numero ?? 0) + 1,
          criadoPorUsuarioId: usuario.usuarioId,
          avaliacaoAntropometricaId: publicada.avaliacaoAntropometricaId,
          formulaCodigo: publicada.formulaCodigo,
          formulaVersao: publicada.formulaVersao,
          motorCalculoVersao: publicada.motorCalculoVersao,
          objetivosCriptografados: this.copiarBuffer(publicada.objetivosCriptografados),
          observacoesCriptografadas: this.copiarBuffer(publicada.observacoesCriptografadas),
          calculoSnapshotCriptografado: this.copiarBuffer(publicada.calculoSnapshotCriptografado),
          totaisSnapshotCriptografado: this.copiarBuffer(publicada.totaisSnapshotCriptografado)
        })
      );
      await this.clonarFilhos(gerenciador, tenantId, publicada.id, nova.id);
      return this.montarVersao(gerenciador, nova);
    });
  }

  async arquivar(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const instante = new Date();
      const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId, publicadaEm: IsNull(), descartadaEm: IsNull() }
      });
      if (rascunho) {
        rascunho.descartadaEm = instante;
        rascunho.revisadaEm = undefined;
        rascunho.revisadaPorUsuarioId = undefined;
        await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      }
      plano.arquivadoEm = instante;
      await gerenciador.getRepository(PlanoAlimentarOrm).save(plano);
      const repositorioAuditoria = gerenciador.getRepository(UserActionLogOrm);
      await repositorioAuditoria.save(
        repositorioAuditoria.create({
          tenantId,
          usuarioId: usuario.usuarioId,
          acao: 'planos_alimentares.arquivar',
          recursoTipo: 'plano_alimentar',
          recursoId: plano.id,
          metadados: { pacienteId }
        })
      );
      return { id: plano.id, arquivadoEm: instante };
    });
  }

  async buscarAlimentos(
    tenantId: string,
    usuario: UsuarioAutenticado,
    consulta: BuscarAlimentosDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const termo = (consulta.busca ?? '').trim();
    if (termo.length < 2) throw new BadRequestException('Informe ao menos dois caracteres para buscar alimentos.');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const fontesAtivas = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).find({
        where: { situacao: 'ativa' },
        order: { nome: 'ASC', versao: 'DESC' }
      });
      const fontes = fontesAtivas.filter(
        (fonte) =>
          (!consulta.fonteCodigo || fonte.codigo === consulta.fonteCodigo) &&
          (!consulta.versao || fonte.versao === consulta.versao) &&
          (!consulta.baseCodigo || fonte.baseCodigo === consulta.baseCodigo)
      );
      const fontesDisponiveis = fontesAtivas.map((fonte) => ({
        codigo: fonte.codigo,
        nome: fonte.nome,
        versao: fonte.versao,
        baseCodigo: fonte.baseCodigo
      }));
      if (!fontes.length) return { itens: [], total: 0, pagina, limite, fontes: fontesDisponiveis };
      const fontePorId = new Map(fontes.map((fonte) => [fonte.id, fonte]));
      const [alimentos, total] = await gerenciador
        .getRepository(AlimentoComposicaoOrm)
        .createQueryBuilder('alimento')
        .where("lower(alimento.nome) like lower(:busca) escape '\\'", { busca: `%${escaparCuringaLike(termo)}%` })
        .andWhere('alimento.fonte_id in (:...fonteIds)', { fonteIds: [...fontePorId.keys()] })
        .orderBy('alimento.nome', 'ASC')
        // `nome` nao e unico: sem desempate o OFFSET repete ou pula alimento.
        .addOrderBy('alimento.id', 'ASC')
        .skip((pagina - 1) * limite)
        .take(limite)
        .getManyAndCount();
      const itens = alimentos.filter((alimento) => fontePorId.has(alimento.fonteId)).map((alimento) => ({
        id: alimento.id,
        codigoOrigem: alimento.codigoOrigem,
        nome: alimento.nome,
        preparacao: alimento.preparacao,
        nutrientesPor100g: this.obterNutrientesCatalogo(alimento, false),
        disponivelParaCalculo: this.composicaoEssencialCatalogoCompleta(alimento),
        fonte: fontePorId.has(alimento.fonteId)
          ? {
              codigo: fontePorId.get(alimento.fonteId)!.codigo,
              nome: fontePorId.get(alimento.fonteId)!.nome,
              versao: fontePorId.get(alimento.fonteId)!.versao,
              baseCodigo: fontePorId.get(alimento.fonteId)!.baseCodigo,
              licenca: fontePorId.get(alimento.fonteId)!.licenca,
              urlFonte: fontePorId.get(alimento.fonteId)!.urlFonte,
              publicadaEm: fontePorId.get(alimento.fonteId)!.publicadaEm,
              checksumArquivo: fontePorId.get(alimento.fonteId)!.checksumArquivo,
              esquemaVersao: fontePorId.get(alimento.fonteId)!.esquemaVersao,
              capturadaEm: fontePorId.get(alimento.fonteId)!.capturadaEm?.toISOString()
            }
          : undefined
      }));
      return { itens, total, pagina, limite, fontes: fontesDisponiveis };
    });
  }

  private garantirPapelProfissional(usuario: UsuarioAutenticado): void {
    if (usuario.papel !== 'SuperAdmin' && usuario.papel !== 'Professional') {
      throw new ForbiddenException('Papel sem acesso aos planos alimentares.');
    }
  }

  private async garantirPacienteNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    bloquear = false
  ): Promise<PacienteOrm> {
    let profissionalId: string | undefined;
    if (usuario.papel === 'Professional') {
      profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    }
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(usuario.papel === 'Professional' ? { profissionalResponsavelId: profissionalId } : {})
      },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    if (!paciente.profissionalResponsavelId) {
      throw new BadRequestException('Paciente precisa ter profissional responsavel para receber um plano alimentar.');
    }
    return paciente;
  }

  private async obterPlanoNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    planoId: string,
    usuario: UsuarioAutenticado,
    bloquear = false
  ): Promise<PlanoAlimentarOrm> {
    await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, bloquear);
    const plano = await gerenciador.getRepository(PlanoAlimentarOrm).findOne({
      where: { id: planoId, tenantId, pacienteId, arquivadoEm: IsNull() },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');
    return plano;
  }

  private async obterRascunhoAtivo(gerenciador: EntityManager, tenantId: string, planoId: string) {
    const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
      where: { tenantId, planoId, publicadaEm: IsNull(), descartadaEm: IsNull() }
    });
    if (!rascunho) throw new NotFoundException('Rascunho do plano alimentar nao encontrado.');
    return rascunho;
  }

  private validarAvaliacaoAntropometrica(avaliacao?: AvaliacaoAntropometricaOrm | null) {
    if (!avaliacao) throw new BadRequestException('Avaliacao antropometrica valida nao encontrada.');
    const hoje = new Date().toISOString().slice(0, 10);
    if (avaliacao.avaliadaEm > hoje) {
      throw new BadRequestException('A avaliacao antropometrica nao pode ter data futura.');
    }
    const medidas = this.lerJsonCriptografado<MedidasAntropometricasPlano>(avaliacao.medidasCriptografadas);
    if (
      !Number.isFinite(medidas.pesoKg) ||
      !Number.isFinite(medidas.alturaCm) ||
      !avaliacao.sexo ||
      !Number.isInteger(avaliacao.idadeAnos)
    ) {
      throw new BadRequestException('A avaliacao precisa conter peso, altura, sexo e idade para o calculo nutricional.');
    }
    return {
      pesoKg: medidas.pesoKg!,
      alturaCm: medidas.alturaCm!,
      sexo: avaliacao.sexo as SexoCalculoEnergetico,
      idadeAnos: avaliacao.idadeAnos!
    };
  }

  private async resolverEstrutura(
    gerenciador: EntityManager,
    dados: AtualizarRascunhoPlanoAlimentarDto
  ): Promise<EstruturaPlanoAlimentar> {
    const refeicoes = [];
    for (const refeicao of dados.refeicoes) {
      const itens: ItemPlanoAlimentar[] = [];
      for (const itemEntrada of refeicao.itens) {
        const item = await this.resolverItem(gerenciador, itemEntrada);
        const substituicoes = [];
        for (const substituicaoEntrada of itemEntrada.substituicoes ?? []) {
          const substituicao = await this.resolverItem(gerenciador, substituicaoEntrada);
          substituicoes.push({ ...substituicao.dominio, snapshot: substituicao.snapshot });
        }
        itens.push({ ...item.dominio, substituicoes } as ItemPlanoAlimentar);
        Object.assign(itens[itens.length - 1], { snapshot: item.snapshot });
      }
      refeicoes.push({
        nome: refeicao.nome.trim(),
        horarioLocal: refeicao.horarioLocal,
        orientacoes: refeicao.orientacoes?.trim() || undefined,
        itens
      });
    }
    return { refeicoes };
  }

  private async resolverItem(
    gerenciador: EntityManager,
    entrada: SubstituicaoPlanoAlimentarDto
  ): Promise<ItemResolvido> {
    let descricao: string;
    let nutrientesPor100g: NutrientesPor100gPlano;
    let snapshotBase: Omit<SnapshotComposicao, 'nutrientesPor100g' | 'nutrientesPorcao'>;
    if (entrada.alimentoComposicaoId) {
      const alimento = await gerenciador.getRepository(AlimentoComposicaoOrm).findOne({
        where: { id: entrada.alimentoComposicaoId }
      });
      if (!alimento) throw new BadRequestException('Alimento do catalogo nao encontrado.');
      nutrientesPor100g = this.obterNutrientesCatalogo(alimento, true)!;
      const fonte = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).findOne({
        where: { id: alimento.fonteId, situacao: 'ativa' }
      });
      if (!fonte) throw new BadRequestException('Fonte do alimento nao esta ativa para uso clinico.');
      descricao = alimento.nome;
      snapshotBase = {
        origem: 'catalogo',
        alimentoComposicaoId: alimento.id,
        codigoOrigem: alimento.codigoOrigem,
        descricao,
        preparacao: alimento.preparacao,
        fonte: {
          codigo: fonte.codigo,
          nome: fonte.nome,
          versao: fonte.versao,
          baseCodigo: fonte.baseCodigo,
          hashConteudo: fonte.hashConteudo,
          checksumArquivo: fonte.checksumArquivo,
          esquemaVersao: fonte.esquemaVersao,
          publicadaEm: fonte.publicadaEm,
          capturadaEm: fonte.capturadaEm?.toISOString()
        }
      };
    } else {
      if (!entrada.descricao?.trim() || !entrada.nutrientesPor100g) {
        throw new BadRequestException('Item manual exige descricao e todos os nutrientes por 100 g.');
      }
      descricao = entrada.descricao.trim();
      nutrientesPor100g = this.validarNutrientesManuais(entrada.nutrientesPor100g);
      snapshotBase = { origem: 'manual', descricao };
    }
    let nutrientesPorcao: SubstituicaoPlanoAlimentar['nutrientes'];
    try {
      nutrientesPorcao = this.calcularNutrientesPorcao(nutrientesPor100g, entrada.porcaoGramas);
    } catch (erro) {
      throw new BadRequestException(erro instanceof Error ? erro.message : 'Porcao do alimento invalida.');
    }
    return {
      dominio: {
        alimentoComposicaoId: entrada.alimentoComposicaoId,
        descricao,
        quantidade: entrada.quantidade,
        unidade: entrada.unidade.trim(),
        porcaoGramas: entrada.porcaoGramas,
        nutrientes: nutrientesPorcao
      },
      snapshot: { ...snapshotBase, nutrientesPor100g, nutrientesPorcao }
    };
  }

  private validarNutrientesManuais(nutrientes: NutrientesPor100gDto): NutrientesPor100gPlano {
    const essenciais = [
      nutrientes.energiaKcal,
      nutrientes.proteinasG,
      nutrientes.carboidratosG,
      nutrientes.gordurasG
    ];
    const opcionais = [nutrientes.fibrasG, nutrientes.sodioMg].filter((valor) => valor !== undefined);
    if ([...essenciais, ...opcionais].some((valor) => !Number.isFinite(valor) || valor! < 0)) {
      throw new BadRequestException('Item manual exige energia e macronutrientes nao negativos por 100 g.');
    }
    return { ...nutrientes };
  }

  private composicaoEssencialCatalogoCompleta(alimento: AlimentoComposicaoOrm): boolean {
    return [
      alimento.energiaKcal,
      alimento.proteinasG,
      alimento.carboidratosG,
      alimento.lipidiosG
    ].every((valor) => valor !== undefined && valor !== null && Number.isFinite(Number(valor)) && Number(valor) >= 0);
  }

  private obterNutrientesCatalogo(alimento: AlimentoComposicaoOrm, obrigatorio: true): NutrientesPor100gPlano;
  private obterNutrientesCatalogo(alimento: AlimentoComposicaoOrm, obrigatorio: false): NutrientesPor100gPlano | undefined;
  private obterNutrientesCatalogo(alimento: AlimentoComposicaoOrm, obrigatorio: boolean) {
    if (!this.composicaoEssencialCatalogoCompleta(alimento)) {
      if (obrigatorio) {
        throw new BadRequestException('Alimento indisponivel para calculo porque energia ou macronutrientes estao ausentes.');
      }
      return undefined;
    }
    const baseGramas = Number(alimento.baseGramas);
    if (!Number.isFinite(baseGramas) || baseGramas <= 0) {
      if (obrigatorio) throw new BadRequestException('Alimento do catalogo possui base nutricional invalida.');
      return undefined;
    }
    const fator = 100 / baseGramas;
    const normalizar = (valor?: string) => Math.round(Number(valor) * fator * 10_000) / 10_000;
    const nutrientes: NutrientesPor100gPlano = {
      energiaKcal: normalizar(alimento.energiaKcal),
      proteinasG: normalizar(alimento.proteinasG),
      carboidratosG: normalizar(alimento.carboidratosG),
      gordurasG: normalizar(alimento.lipidiosG)
    };
    if (alimento.fibrasG !== undefined && alimento.fibrasG !== null) nutrientes.fibrasG = normalizar(alimento.fibrasG);
    if (alimento.sodioMg !== undefined && alimento.sodioMg !== null) nutrientes.sodioMg = normalizar(alimento.sodioMg);
    return nutrientes;
  }

  private calcularNutrientesPorcao(
    nutrientes: NutrientesPor100gPlano,
    quantidadeGramas: number
  ): SubstituicaoPlanoAlimentar['nutrientes'] {
    const calculados = calcularNutrientesDaPorcao(
      {
        ...nutrientes,
        fibrasG: nutrientes.fibrasG ?? 0,
        sodioMg: nutrientes.sodioMg ?? 0
      },
      quantidadeGramas
    );
    return {
      energiaKcal: calculados.energiaKcal,
      proteinasG: calculados.proteinasG,
      carboidratosG: calculados.carboidratosG,
      gordurasG: calculados.gordurasG,
      ...(nutrientes.fibrasG !== undefined ? { fibrasG: calculados.fibrasG } : {}),
      ...(nutrientes.sodioMg !== undefined ? { sodioMg: calculados.sodioMg } : {})
    };
  }

  private async substituirFilhos(
    gerenciador: EntityManager,
    tenantId: string,
    versaoId: string,
    estrutura: EstruturaPlanoAlimentar
  ): Promise<void> {
    const repositorioRefeicao = gerenciador.getRepository(PlanoAlimentarRefeicaoOrm);
    const repositorioItem = gerenciador.getRepository(PlanoAlimentarItemOrm);
    const repositorioSubstituicao = gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm);
    const refeicoesAnteriores = await repositorioRefeicao.find({ where: { tenantId, versaoId } });
    const idsRefeicoes = refeicoesAnteriores.map((refeicao) => refeicao.id);
    const itensAnteriores = idsRefeicoes.length
      ? await repositorioItem.find({ where: { tenantId, refeicaoId: In(idsRefeicoes) } })
      : [];
    const idsItens = itensAnteriores.map((item) => item.id);
    if (idsItens.length) await repositorioSubstituicao.delete({ tenantId, itemId: In(idsItens) });
    if (idsRefeicoes.length) await repositorioItem.delete({ tenantId, refeicaoId: In(idsRefeicoes) });
    await repositorioRefeicao.delete({ tenantId, versaoId });

    for (const [ordemRefeicao, refeicao] of estrutura.refeicoes.entries()) {
      const refeicaoSalva = await repositorioRefeicao.save(
        repositorioRefeicao.create({
          tenantId,
          versaoId,
          ordem: ordemRefeicao,
          nomeCriptografado: this.criptografia.criptografar(refeicao.nome),
          horarioLocal: refeicao.horarioLocal,
          orientacoesCriptografadas: refeicao.orientacoes
            ? this.criptografia.criptografar(refeicao.orientacoes)
            : undefined
        })
      );
      for (const [ordemItem, item] of refeicao.itens.entries()) {
        const snapshot = (item as ItemPlanoAlimentar & { snapshot: SnapshotComposicao }).snapshot;
        const itemSalvo = await repositorioItem.save(
          repositorioItem.create({
            tenantId,
            refeicaoId: refeicaoSalva.id,
            alimentoComposicaoId: item.alimentoComposicaoId,
            ordem: ordemItem,
            descricaoCriptografada: this.criptografia.criptografar(item.descricao),
            quantidade: item.quantidade.toFixed(3),
            unidade: item.unidade,
            porcaoGramas: item.porcaoGramas.toFixed(3),
            composicaoSnapshotCriptografada: this.criptografia.criptografar(JSON.stringify(snapshot)),
            motorCalculoVersao: MOTOR_CALCULO_VERSAO
          })
        );
        for (const [ordemSubstituicao, substituicao] of item.substituicoes.entries()) {
          const snapshotSubstituicao = (
            substituicao as SubstituicaoPlanoAlimentar & { snapshot: SnapshotComposicao }
          ).snapshot;
          await repositorioSubstituicao.save(
            repositorioSubstituicao.create({
              tenantId,
              itemId: itemSalvo.id,
              alimentoComposicaoId: substituicao.alimentoComposicaoId,
              ordem: ordemSubstituicao,
              descricaoCriptografada: this.criptografia.criptografar(substituicao.descricao),
              quantidade: substituicao.quantidade.toFixed(3),
              unidade: substituicao.unidade,
              porcaoGramas: substituicao.porcaoGramas.toFixed(3),
              composicaoSnapshotCriptografada: this.criptografia.criptografar(JSON.stringify(snapshotSubstituicao)),
              motorCalculoVersao: MOTOR_CALCULO_VERSAO
            })
          );
        }
      }
    }
  }

  private async clonarFilhos(
    gerenciador: EntityManager,
    tenantId: string,
    origemVersaoId: string,
    destinoVersaoId: string
  ): Promise<void> {
    const repositorioRefeicao = gerenciador.getRepository(PlanoAlimentarRefeicaoOrm);
    const repositorioItem = gerenciador.getRepository(PlanoAlimentarItemOrm);
    const repositorioSubstituicao = gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm);
    const refeicoes = await repositorioRefeicao.find({
      where: { tenantId, versaoId: origemVersaoId },
      order: { ordem: 'ASC' }
    });
    for (const refeicao of refeicoes) {
      const novaRefeicao = await repositorioRefeicao.save(
        repositorioRefeicao.create({
          tenantId,
          versaoId: destinoVersaoId,
          ordem: refeicao.ordem,
          nomeCriptografado: Buffer.from(refeicao.nomeCriptografado),
          horarioLocal: refeicao.horarioLocal,
          orientacoesCriptografadas: this.copiarBuffer(refeicao.orientacoesCriptografadas)
        })
      );
      const itens = await repositorioItem.find({
        where: { tenantId, refeicaoId: refeicao.id },
        order: { ordem: 'ASC' }
      });
      for (const item of itens) {
        const novoItem = await repositorioItem.save(
          repositorioItem.create({
            tenantId,
            refeicaoId: novaRefeicao.id,
            alimentoComposicaoId: item.alimentoComposicaoId,
            ordem: item.ordem,
            descricaoCriptografada: Buffer.from(item.descricaoCriptografada),
            quantidade: item.quantidade,
            unidade: item.unidade,
            porcaoGramas: item.porcaoGramas,
            composicaoSnapshotCriptografada: Buffer.from(item.composicaoSnapshotCriptografada),
            motorCalculoVersao: item.motorCalculoVersao
          })
        );
        const substituicoes = await repositorioSubstituicao.find({
          where: { tenantId, itemId: item.id },
          order: { ordem: 'ASC' }
        });
        for (const substituicao of substituicoes) {
          await repositorioSubstituicao.save(
            repositorioSubstituicao.create({
              tenantId,
              itemId: novoItem.id,
              alimentoComposicaoId: substituicao.alimentoComposicaoId,
              ordem: substituicao.ordem,
              descricaoCriptografada: Buffer.from(substituicao.descricaoCriptografada),
              quantidade: substituicao.quantidade,
              unidade: substituicao.unidade,
              porcaoGramas: substituicao.porcaoGramas,
              composicaoSnapshotCriptografada: Buffer.from(substituicao.composicaoSnapshotCriptografada),
              motorCalculoVersao: substituicao.motorCalculoVersao
            })
          );
        }
      }
    }
  }

  private garantirRascunhoCompleto(rascunho: PlanoAlimentarVersaoOrm): void {
    if (
      !rascunho.avaliacaoAntropometricaId ||
      !rascunho.formulaCodigo ||
      !rascunho.formulaVersao ||
      !rascunho.motorCalculoVersao ||
      !rascunho.objetivosCriptografados ||
      !rascunho.calculoSnapshotCriptografado ||
      !rascunho.totaisSnapshotCriptografado
    ) {
      throw new BadRequestException('Complete o calculo e o conteudo do rascunho antes de continuar.');
    }
    const calculo = this.lerJsonCriptografado<{
      possuiCondicaoEspecial?: boolean;
      aplicabilidadeFormulaConfirmada?: boolean;
      alertasDivergenciaClinica?: unknown;
      justificativaDivergenciaClinica?: unknown;
    }>(rascunho.calculoSnapshotCriptografado);
    if (calculo.possuiCondicaoEspecial) {
      throw new BadRequestException('Plano com condicao especial nao pode usar o fluxo automatico desta fase.');
    }
    if (calculo.aplicabilidadeFormulaConfirmada !== true) {
      throw new BadRequestException('A aplicabilidade da formula precisa estar explicitamente confirmada.');
    }
    const alertas = Array.isArray(calculo.alertasDivergenciaClinica)
      ? calculo.alertasDivergenciaClinica.filter((alerta): alerta is string => typeof alerta === 'string')
      : [];
    const justificativa =
      typeof calculo.justificativaDivergenciaClinica === 'string'
        ? calculo.justificativaDivergenciaClinica.trim()
        : '';
    if (alertas.length && justificativa.length < 10) {
      throw new BadRequestException(
        'Existem divergencias relevantes entre metas e refeicoes. Informe uma justificativa clinica para revisar ou publicar.'
      );
    }
  }

  private avaliarDivergenciasNutricionais(
    metaEnergeticaKcal: number,
    metas: ReturnType<typeof calcularMetasMacronutrientes>,
    totais: ReturnType<typeof calcularTotaisPlano>
  ): string[] {
    const alertas: string[] = [];
    const comparar = (rotulo: string, meta: number, total: number) => {
      if (meta <= 0 || total <= 0) {
        alertas.push(`${rotulo}: meta ou total das refeicoes esta zerado.`);
        return;
      }
      const divergencia = Math.abs(total - meta) / meta;
      if (divergencia > LIMIAR_DIVERGENCIA_NUTRICIONAL) {
        alertas.push(`${rotulo}: total das refeicoes diverge mais de 30% da meta.`);
      }
    };

    comparar('Energia', metaEnergeticaKcal, totais.energiaKcal);
    comparar('Carboidratos', metas.carboidratosG, totais.carboidratosG);
    comparar('Proteinas', metas.proteinasG, totais.proteinasG);
    comparar('Gorduras', metas.gordurasG, totais.gordurasG);
    return alertas;
  }

  private async montarPlano(gerenciador: EntityManager, plano: PlanoAlimentarOrm) {
    const versoes = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).find({
      where: { tenantId: plano.tenantId, planoId: plano.id },
      order: { numero: 'DESC' }
    });
    const rascunho = versoes.find((versao) => !versao.publicadaEm && !versao.descartadaEm);
    const publicadaAtual = versoes.find((versao) => versao.id === plano.versaoPublicadaAtualId);
    const versoesEmDetalhe = [publicadaAtual, rascunho].filter(
      (versao, indice, lista): versao is PlanoAlimentarVersaoOrm =>
        Boolean(versao) && lista.findIndex((item) => item?.id === versao?.id) === indice
    );
    const detalhes = await Promise.all(
      versoesEmDetalhe.map((versao) => this.montarVersao(gerenciador, versao))
    );
    return {
      id: plano.id,
      pacienteId: plano.pacienteId,
      profissionalId: plano.profissionalId,
      titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
      arquivadoEm: plano.arquivadoEm,
      criadoEm: plano.criadoEm,
      atualizadoEm: plano.atualizadoEm,
      current: detalhes.find((versao) => versao.id === plano.versaoPublicadaAtualId),
      draft: detalhes.find((versao) => versao.status === 'rascunho'),
      historico: versoes
        .filter((versao) => versao.publicadaEm || versao.descartadaEm)
        .map((versao) => this.montarResumoVersao(versao))
    };
  }

  private garantirPermissao(usuario: UsuarioAutenticado, permissao: PermissaoOctaClin): void {
    if (!usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Permissao insuficiente para operar planos alimentares.');
    }
  }

  private montarResumoPlano(plano: PlanoAlimentarOrm, versoes: PlanoAlimentarVersaoOrm[]) {
    const resumos = versoes.map((versao) => this.montarResumoVersao(versao));
    return {
      id: plano.id,
      pacienteId: plano.pacienteId,
      profissionalId: plano.profissionalId,
      titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
      criadoEm: plano.criadoEm,
      atualizadoEm: plano.atualizadoEm,
      current: resumos.find((versao) => versao.id === plano.versaoPublicadaAtualId),
      draft: resumos.find((versao) => versao.status === 'rascunho'),
      historicoQuantidade: resumos.filter((versao) => versao.status !== 'rascunho').length
    };
  }

  private montarResumoVersao(versao: PlanoAlimentarVersaoOrm) {
    return {
      id: versao.id,
      numero: versao.numero,
      status: versao.publicadaEm ? ('publicada' as const) : versao.descartadaEm ? ('descartada' as const) : ('rascunho' as const),
      revisadaEm: versao.revisadaEm,
      hashConteudo: versao.hashConteudo,
      publicadaEm: versao.publicadaEm,
      descartadaEm: versao.descartadaEm,
      criadoEm: versao.criadoEm,
      atualizadoEm: versao.atualizadoEm
    };
  }

  private async montarVersao(gerenciador: EntityManager, versao: PlanoAlimentarVersaoOrm) {
    const refeicoes = await gerenciador.getRepository(PlanoAlimentarRefeicaoOrm).find({
      where: { tenantId: versao.tenantId, versaoId: versao.id },
      order: { ordem: 'ASC' }
    });
    const itens = refeicoes.length
      ? await gerenciador.getRepository(PlanoAlimentarItemOrm).find({
          where: { tenantId: versao.tenantId, refeicaoId: In(refeicoes.map((refeicao) => refeicao.id)) },
          order: { ordem: 'ASC' }
        })
      : [];
    const substituicoes = itens.length
      ? await gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm).find({
          where: { tenantId: versao.tenantId, itemId: In(itens.map((item) => item.id)) },
          order: { ordem: 'ASC' }
        })
      : [];
    return {
      id: versao.id,
      numero: versao.numero,
      status: versao.publicadaEm ? ('publicada' as const) : versao.descartadaEm ? ('descartada' as const) : ('rascunho' as const),
      avaliacaoAntropometricaId: versao.avaliacaoAntropometricaId,
      formulaCodigo: versao.formulaCodigo,
      formulaVersao: versao.formulaVersao,
      motorCalculoVersao: versao.motorCalculoVersao,
      objetivos: this.descriptografarOpcional(versao.objetivosCriptografados),
      observacoes: this.descriptografarOpcional(versao.observacoesCriptografadas),
      calculo: this.lerJsonCriptografadoOpcional(versao.calculoSnapshotCriptografado),
      totais: this.lerJsonCriptografadoOpcional(versao.totaisSnapshotCriptografado),
      hashConteudo: versao.hashConteudo,
      revisadaEm: versao.revisadaEm,
      revisadaPorUsuarioId: versao.revisadaPorUsuarioId,
      publicadaEm: versao.publicadaEm,
      descartadaEm: versao.descartadaEm,
      criadoEm: versao.criadoEm,
      atualizadoEm: versao.atualizadoEm,
      refeicoes: refeicoes.map((refeicao) => ({
        id: refeicao.id,
        ordem: refeicao.ordem,
        nome: this.criptografia.descriptografar(refeicao.nomeCriptografado),
        horarioLocal: refeicao.horarioLocal,
        orientacoes: this.descriptografarOpcional(refeicao.orientacoesCriptografadas),
        itens: itens
          .filter((item) => item.refeicaoId === refeicao.id)
          .sort((a, b) => a.ordem - b.ordem)
          .map((item) => ({
            id: item.id,
            ordem: item.ordem,
            alimentoComposicaoId: item.alimentoComposicaoId,
            descricao: this.criptografia.descriptografar(item.descricaoCriptografada),
            quantidade: Number(item.quantidade),
            unidade: item.unidade,
            porcaoGramas: Number(item.porcaoGramas),
            composicaoSnapshot: this.lerJsonCriptografado<SnapshotComposicao>(item.composicaoSnapshotCriptografada),
            substituicoes: substituicoes
              .filter((substituicao) => substituicao.itemId === item.id)
              .sort((a, b) => a.ordem - b.ordem)
              .map((substituicao) => ({
                id: substituicao.id,
                ordem: substituicao.ordem,
                alimentoComposicaoId: substituicao.alimentoComposicaoId,
                descricao: this.criptografia.descriptografar(substituicao.descricaoCriptografada),
                quantidade: Number(substituicao.quantidade),
                unidade: substituicao.unidade,
                porcaoGramas: Number(substituicao.porcaoGramas),
                composicaoSnapshot: this.lerJsonCriptografado<SnapshotComposicao>(
                  substituicao.composicaoSnapshotCriptografada
                )
              }))
          }))
      }))
    };
  }

  private conteudoClinicoParaHash(plano: PlanoAlimentarOrm, versao: Awaited<ReturnType<ServicoPlanosAlimentares['montarVersao']>>) {
    return {
      planoId: plano.id,
      pacienteId: plano.pacienteId,
      titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
      numero: versao.numero,
      avaliacaoAntropometricaId: versao.avaliacaoAntropometricaId,
      formulaCodigo: versao.formulaCodigo,
      formulaVersao: versao.formulaVersao,
      motorCalculoVersao: versao.motorCalculoVersao,
      objetivos: versao.objetivos,
      observacoes: versao.observacoes,
      calculo: versao.calculo,
      totais: versao.totais,
      refeicoes: versao.refeicoes.map(({ id: _id, ...refeicao }) => ({
        ...refeicao,
        itens: refeicao.itens.map(({ id: _itemId, ...item }) => ({
          ...item,
          substituicoes: item.substituicoes.map(({ id: _substituicaoId, ...substituicao }) => substituicao)
        }))
      }))
    };
  }

  private serializarEstavel(valor: unknown): string {
    if (Array.isArray(valor)) return `[${valor.map((item) => this.serializarEstavel(item)).join(',')}]`;
    if (valor && typeof valor === 'object') {
      const objeto = valor as Record<string, unknown>;
      return `{${Object.keys(objeto)
        .filter((chave) => objeto[chave] !== undefined)
        .sort()
        .map((chave) => `${JSON.stringify(chave)}:${this.serializarEstavel(objeto[chave])}`)
        .join(',')}}`;
    }
    return JSON.stringify(valor);
  }

  private lerJsonCriptografado<T>(valor: Buffer): T {
    return JSON.parse(this.criptografia.descriptografar(valor)) as T;
  }

  private lerJsonCriptografadoOpcional(valor?: Buffer): unknown {
    return valor ? this.lerJsonCriptografado<unknown>(valor) : undefined;
  }

  private descriptografarOpcional(valor?: Buffer): string | undefined {
    return valor ? this.criptografia.descriptografar(valor) : undefined;
  }

  private copiarBuffer(valor?: Buffer): Buffer | undefined {
    return valor ? Buffer.from(valor) : undefined;
  }
}
