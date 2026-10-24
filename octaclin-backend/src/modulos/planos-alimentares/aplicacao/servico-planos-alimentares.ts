import { ServicoEquivalenciasPlano } from './servico-equivalencias-plano';
import { clonarContextoEquivalenciaParaCopia, resolverEquivalenciasDocumento, assinaturaDependenciasEquivalencia, ContextoEquivalencia, ContextosEquivalencias, validarContextosEquivalencias, ConflitoEquivalenciaEdicao } from './resolver-equivalencias-edicao';
import { projetarEquivalenciasProfissional } from './projecao-equivalencias-profissional';
import { resolverFatosEquivalencia, FatosPreservadosEquivalencia, identidadeFatoEquivalencia } from './fatos-equivalencia-plano';
import { FatosComposicaoEquivalencia } from '../dominio/equivalencia-nutriente';
import { calcularNutrientesDaPorcaoDecimal, normalizarComposicaoDecimal, POLITICA_NUTRICAO_DECIMAL } from '../dominio/calculo-nutricional';
import { lerOrigensMaterializadas, possuiGruposMaterializados } from './origens-grupos-materializadas';
import { ContextosCatalogoGrupo, lerSnapshotEdicaoGrupos, mesmaOrigemGrupo, serializarSnapshotEdicaoGrupos } from './snapshot-edicao-grupos';
import { resolverGruposDocumento, ConflitoAplicacaoGrupo, DocumentoGrupoInvalido } from '../dominio/aplicacao-grupos-substituicoes';
import { ServicoGruposSubstituicoes } from './servico-grupos-substituicoes';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import type { OrigemGrupoSnapshot } from '../dominio/grupos-substituicoes';
import { projetarComposicao } from './projecao-composicao';
import { ServicoAlimentosPersonalizados } from './servico-alimentos-personalizados';
import { ComposicaoPersonalizada } from '../dominio/alimentos-personalizados';
import { capturarFatosCustom, ContextosAlimentosPersonalizados, ReferenciaCustomConflitanteError, resolverAlimentosPersonalizados, validarContextosCustom } from '../dominio/aplicacao-alimentos-personalizados';
import { ServicoMedidasCaseiras } from './servico-medidas-caseiras';
import { ContextosMedidas, resolverMedidasDocumento } from '../dominio/medidas-caseiras';
import { CalculoCombinadoDto, validarSelecoesCalculo } from './dtos-calculo-combinado';
import { calcularNutrientesCombinados, EntradaPlanoCombinado } from '../dominio/calculo-combinado';
import { criarSnapshotMicronutrientes, LimitePrecisaoNutricionalError, SnapshotMicronutrientesV1, validarMicronutrientesManuais, ValoresMicronutrientesOrigem } from '../dominio/micronutrientes';
import { extrairMicronutrientesFonte } from '../dados/micronutrientes-fonte';
import { lerEstadosRefeicoes } from '../infraestrutura/estados-refeicoes';
import { createHash, randomUUID } from 'crypto';
import { validateSync } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ServiceUnavailableException
} from '@nestjs/common';
import { And, EntityManager, In, IsNull, LessThan, MoreThan, MoreThanOrEqual } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAvisoPlanoPublicado } from '../../comunicacoes/aplicacao/registrar-aviso-plano-publicado';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { AvaliacaoAntropometricaOrm } from '../../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import {
  calcularEnergiaDasMetas,
  calcularEstimativaEnergetica,
  calcularMetasMacronutrientes,
  calcularMetasMacronutrientesPorPeso,
  calcularNutrientesDaPorcao,
  MetodoMacrosManual,
  NutrientesPor100g,
  OrigemMetaPlano,
  SexoCalculoEnergetico
} from '../dominio/calculo-nutricional';
import {
  calcularTotaisPlano,
  EstruturaPlanoAlimentar,
  ItemPlanoAlimentar,
  AlternativaPlanoAlimentar,
  SubstituicaoPlanoAlimentar,
  validarEstruturaPlano
} from '../dominio/plano-alimentar';
import { lerApresentacaoVersao, validarPreferenciasApresentacao, projetarRefeicoesPaciente, projetarMetasPaciente } from '../dominio/apresentacao-plano';
import { projetarResumoNutricionalPlano, ResumoNutricionalPlano, resumirNutrientesItensEfetivos } from '../dominio/resumo-nutricional-plano';
import { AliasIdentidadeRefeicao, lerIdentidadesRefeicoes, prepararIdentidadesRefeicoes } from '../dominio/identidades-refeicoes';
import { DocumentoEdicaoPlano, validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { converterEdicaoParaRascunho, PrecondicaoEdicaoPlanoDto, ReferenciaCopiaEquivalenciaDto, SalvarEdicaoPlanoDto } from './dtos-edicao-plano';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FavoritoAlimentoOrm } from '../infraestrutura/favorito-alimento.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarEscolhaPacienteOrm } from '../infraestrutura/plano-alimentar-escolha-paciente.orm';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import {
  AtualizarRascunhoPlanoAlimentarDto,
  BuscarAlimentosDto,
  CriarPlanoAlimentarDto,
  ListarAcompanhamentoVersaoPlanoDto,
  ListarEscolhasPlanoAlimentarDto,
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
  equivalencia?: ContextoEquivalencia;
  origemGrupo?: OrigemGrupoSnapshot;
  origem: 'catalogo' | 'manual' | 'custom';
  composicaoInformada?: { baseGramas: number; nutrientes: ComposicaoPersonalizada['composicaoOrigem']['nutrientes']; micronutrientes: ComposicaoPersonalizada['composicaoOrigem']['micronutrientes']; normalizacaoVersao: string; referencia?: string };
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
  micronutrientes?: SnapshotMicronutrientesV1;
  nutrientesPorcao: SubstituicaoPlanoAlimentar['nutrientes'];
}

export interface EscolhaPlanoAlimentarProfissional {
  id: string;
  versaoId: string;
  versaoNumero: number;
  itemId: string;
  refeicaoNome: string;
  itemDescricao: string;
  substituicaoId?: string;
  substituicaoDescricao?: string;
  retornouAoPrincipal: boolean;
  escolhidoPorUsuarioId: string;
  criadoEm: Date;
}

interface ItemResolvido {
  dominio: SubstituicaoPlanoAlimentar;
  snapshot: SnapshotComposicao;
}

@Injectable()
export class ServicoPlanosAlimentares {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly medidasCaseiras: ServicoMedidasCaseiras = new ServicoMedidasCaseiras(executorTenant, criptografia),
    private readonly alimentosPersonalizados: ServicoAlimentosPersonalizados = new ServicoAlimentosPersonalizados(executorTenant, criptografia),
    private readonly gruposSubstituicoes: ServicoGruposSubstituicoes = new ServicoGruposSubstituicoes(executorTenant, criptografia, new FontesGruposSubstituicoes(criptografia)),
    private readonly equivalencias: ServicoEquivalenciasPlano = new ServicoEquivalenciasPlano(executorTenant,criptografia,new FontesGruposSubstituicoes(criptografia),gruposSubstituicoes,medidasCaseiras)
  ) {}

  async obterSelecaoCalculo(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, 'pessimistic_read');
      const cabecalho = { planoId: plano.id, ativoParaPaciente: plano.ativoParaPaciente === true, ativacaoRevisao: plano.ativacaoRevisao ?? 0 };
      if (!plano.versaoPublicadaAtualId) return { ...cabecalho, versao: null, refeicoes: [] };
      const versao = await this.obterPublicacaoCalculo(gerenciador, plano);
      const { refeicoes, estados } = await this.obterRefeicoesCalculo(gerenciador, plano, versao.id);
      return { ...cabecalho, versao: { id:versao.id, numero:versao.numero, publicadaEm:versao.publicadaEm },
        refeicoes:refeicoes.map(r => ({ identidadeId:estados.get(r.id)!.identidade_id, nome:this.criptografia.descriptografar(r.nomeCriptografado), ordem:r.ordem, ativa:estados.get(r.id)!.ativa })) };
    });
  }

  async calcularCombinado(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado, dados: CalculoCombinadoDto) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    let entrada: CalculoCombinadoDto;
    try { entrada = validarSelecoesCalculo(dados); }
    catch { throw new BadRequestException('Seleção do cálculo combinado inválida.'); }
    return this.executorTenant.executar(tenantId, async gerenciador => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, 'pessimistic_read');
      const planos: Array<{ plano:PlanoAlimentarOrm; selecao:CalculoCombinadoDto['selecoes'][number] }> = [];
      // Toda autorização precede decifragem. Locks seguem a mesma ordem dos writers.
      for (const selecao of [...entrada.selecoes].sort((a,b) => a.planoId.localeCompare(b.planoId))) {
        const plano = await this.obterPlanoNoEscopo(gerenciador,tenantId,pacienteId,selecao.planoId,usuario,'pessimistic_read');
        planos.push({plano,selecao});
      }
      const efetivos: EntradaPlanoCombinado[] = [];
      let quantidadeItens = 0;
      for (const {plano,selecao} of planos) {
        if (plano.versaoPublicadaAtualId !== selecao.versaoIdEsperada || (plano.ativacaoRevisao ?? 0) !== selecao.ativacaoRevisaoEsperada) {
          throw new ConflictException('A publicação ou ativação mudou. Atualize a seleção antes de calcular.');
        }
        const versao = await this.obterPublicacaoCalculo(gerenciador,plano);
        const {refeicoes,estados} = await this.obterRefeicoesCalculo(gerenciador,plano,versao.id);
        const identidadesAtuais = new Set(Array.from(estados.values()).map(e=>e.identidade_id));
        if (selecao.identidadesRefeicoes.some(id=>!identidadesAtuais.has(id))) throw new ConflictException('As refeições mudaram. Atualize a seleção antes de calcular.');
        const selecionadas = new Set(selecao.identidadesRefeicoes);
        const entradaPlano: EntradaPlanoCombinado = {planoId:plano.id,ativo:plano.ativoParaPaciente === true,selecionado:true,refeicoes:[]};
        for (const r of refeicoes) {
          const estado = estados.get(r.id)!;
          const selecionada = selecionadas.has(estado.identidade_id);
          const itens: unknown[] = [];
          if (entradaPlano.ativo && selecionada && estado.ativa) {
            const registros = await gerenciador.getRepository(PlanoAlimentarItemOrm).find({
              where:{tenantId,refeicaoId:r.id},select:{id:true,composicaoSnapshotCriptografada:true},take:10001
            });
            quantidadeItens += registros.length;
            if (quantidadeItens > 10000) throw new UnprocessableEntityException('Limite de itens do cálculo combinado excedido.');
            for (const item of registros) {
              try { itens.push(this.lerJsonCriptografado<unknown>(item.composicaoSnapshotCriptografada)); }
              catch { itens.push(null); }
            }
          }
          entradaPlano.refeicoes.push({identidadeId:estado.identidade_id,ativa:estado.ativa,selecionada,itens});
        }
        efetivos.push(entradaPlano);
      }
      try { return { ...calcularNutrientesCombinados(efetivos), calculadoEm: new Date().toISOString(),
        publicacoes:planos.map(({plano,selecao})=>({planoId:plano.id,versaoId:selecao.versaoIdEsperada,ativacaoRevisao:selecao.ativacaoRevisaoEsperada})) }; }
      catch { throw new UnprocessableEntityException('Limite técnico de precisão nutricional excedido.'); }
    });
  }

  private async obterPublicacaoCalculo(gerenciador: EntityManager, plano: PlanoAlimentarOrm) {
    const versao = plano.versaoPublicadaAtualId ? await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
      where:{tenantId:plano.tenantId,planoId:plano.id,id:plano.versaoPublicadaAtualId},
      select:{id:true,numero:true,publicadaEm:true,descartadaEm:true},lock:{mode:'pessimistic_read'}
    }) : null;
    if (!versao?.publicadaEm || versao.descartadaEm) throw new ConflictException('Publicação atual indisponível. Atualize a seleção.');
    return versao;
  }

  private async obterRefeicoesCalculo(gerenciador: EntityManager, plano: PlanoAlimentarOrm, versaoId: string) {
    const refeicoes = await gerenciador.getRepository(PlanoAlimentarRefeicaoOrm).find({
      where:{tenantId:plano.tenantId,versaoId},select:{id:true,nomeCriptografado:true,ordem:true},order:{ordem:'ASC'},take:51
    });
    if (refeicoes.length > 50) throw new UnprocessableEntityException('Limite de refeições do cálculo combinado excedido.');
    const linhas = await lerEstadosRefeicoes(gerenciador,plano.tenantId,plano.id,versaoId);
    const estados = new Map(linhas.map(e=>[e.refeicao_id,e]));
    if (linhas.length !== refeicoes.length || estados.size !== refeicoes.length ||
        new Set(linhas.map(e=>e.identidade_id)).size !== linhas.length ||
        refeicoes.some(r=>!estados.has(r.id)) || linhas.some(e=>typeof e.ativa !== 'boolean')) {
      throw new ConflictException('Estado das refeições indisponível. Atualize a seleção.');
    }
    return {refeicoes,estados};
  }

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
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, 'pessimistic_read');
      const [planos, total] = await gerenciador.getRepository(PlanoAlimentarOrm).findAndCount({
        where: {
          tenantId,
          pacienteId,
          arquivadoEm: IsNull()
        },
        select: {
          id: true,
          pacienteId: true,
          profissionalId: true,
          tituloCriptografado: true,
          versaoPublicadaAtualId: true,
          ativoParaPaciente: true,
          ativacaoRevisao: true,
          criadoEm: true,
          atualizadoEm: true
        },
        // `id` desempata: criado_em usa default now() e empata entre linhas da
        // mesma transacao, o que faria OFFSET repetir ou pular um plano.
        order: { criadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      if (!planos.length) return { itens: [], total, pagina, limite };

      const repositorioVersoes = gerenciador.getRepository(PlanoAlimentarVersaoOrm);
      const idsPublicadosAtuais = planos
        .map((plano) => plano.versaoPublicadaAtualId)
        .filter((id): id is string => Boolean(id));
      const condicoesVersoes = [
        ...(idsPublicadosAtuais.length ? [{ tenantId, id: In(idsPublicadosAtuais) }] : []),
        {
          tenantId,
          planoId: In(planos.map((plano) => plano.id)),
          publicadaEm: IsNull(),
          descartadaEm: IsNull()
        }
      ];
      const versoes = await repositorioVersoes.find({
        where: condicoesVersoes,
        select: {
          id: true, tenantId: true, planoId: true, numero: true, hashConteudo: true,
          revisadaEm: true, publicadaEm: true, descartadaEm: true, criadoEm: true, atualizadoEm: true,
          rascunhoRevisao: true, edicaoProtegida: true, edicaoMaterializadaRevisao: true
        }
      });
      const contagensHistorico = await gerenciador.query(
        `SELECT plano_id AS "planoId", COUNT(*)::text AS quantidade
         FROM plano_alimentar_versoes
         WHERE tenant_id = $1 AND plano_id = ANY($2::uuid[])
           AND (publicada_em IS NOT NULL OR descartada_em IS NOT NULL)
         GROUP BY plano_id`,
        [tenantId, planos.map((plano) => plano.id)]
      ) as Array<{ planoId: string; quantidade: string }>;
      const historicoPorPlano = new Map(contagensHistorico.map((linha) => [linha.planoId, Number(linha.quantidade)]));
      const versoesPorPlano = new Map<string, PlanoAlimentarVersaoOrm[]>();
      for (const versao of versoes) {
        const listaPlano = versoesPorPlano.get(versao.planoId) ?? [];
        listaPlano.push(versao);
        versoesPorPlano.set(versao.planoId, listaPlano);
      }
      const versoesRelevantes: PlanoAlimentarVersaoOrm[] = [];
      for (const plano of planos) {
        const doPlano = versoesPorPlano.get(plano.id) ?? [];
        const atual = doPlano.find((versao) => versao.id === plano.versaoPublicadaAtualId);
        const rascunho = doPlano.find((versao) => !versao.publicadaEm && !versao.descartadaEm);
        if (atual) versoesRelevantes.push(atual);
        if (rascunho && rascunho.id !== atual?.id) versoesRelevantes.push(rascunho);
      }
      const idsResumo = [...new Set(versoesRelevantes.map((versao) => versao.id))];
      const snapshots = idsResumo.length
        ? await repositorioVersoes.find({
            where: { tenantId, id: In(idsResumo) },
            select: { id: true, totaisSnapshotCriptografado: true }
          })
        : [];
      const resumoPorVersao = new Map<string, ResumoNutricionalPlano>();
      for (const snapshot of snapshots) {
        const versao = versoesRelevantes.find(v => v.id === snapshot.id);
        if (versao?.edicaoProtegida && versao.edicaoMaterializadaRevisao !== versao.rascunhoRevisao) {
          resumoPorVersao.set(snapshot.id, projetarResumoNutricionalPlano(undefined, true));
          continue;
        }
        try {
          resumoPorVersao.set(snapshot.id, projetarResumoNutricionalPlano(
            snapshot.totaisSnapshotCriptografado
              ? this.lerJsonCriptografado<unknown>(snapshot.totaisSnapshotCriptografado)
              : undefined
          ));
        } catch {
          resumoPorVersao.set(snapshot.id, projetarResumoNutricionalPlano(undefined, true));
        }
      }
      return {
        itens: planos.map((plano) =>
          this.montarResumoPlano(plano, versoesPorPlano.get(plano.id) ?? [], resumoPorVersao, historicoPorPlano.get(plano.id) ?? 0)
        ),
        total,
        pagina,
        limite
      };
    });
  }

  /**
   * Expõe ao profissional a trilha já registrada pelo portal. A versão
   * publicada nunca é alterada: a escolha atual continua sendo a última linha,
   * enquanto esta leitura preserva cada retorno ao alimento principal.
   */
  async obterApresentacaoPaciente(tenantId: string, pacienteId: string, planoId: string, numero: number, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    if (!Number.isInteger(numero) || numero < 1) throw new BadRequestException('Número de versão inválido.');
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, 'pessimistic_read');
      const versao = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({ where: { tenantId, planoId: plano.id, numero, descartadaEm: IsNull() }, lock: { mode: 'pessimistic_read' } });
      if (!versao) throw new NotFoundException('Versão do plano alimentar não encontrada.');
      this.garantirApresentacaoDisponivel(versao);
      if (!versao.publicadaEm) {
        const estado = this.lerEdicao(versao).edicaoEstado;
        if (estado === 'pendente' || estado === 'indisponivel') {
          throw new ConflictException('A edição precisa estar completa antes de abrir a prévia do paciente.');
        }
      }
      if (versao.publicadaEm && (plano.ativoParaPaciente !== true || plano.versaoPublicadaAtualId !== versao.id)) {
        throw new ConflictException('A entrega vigente deste plano não está disponível. Consulte a versão preservada no histórico profissional.');
      }
      const detalhe = await this.montarVersao(gerenciador, versao);
      if (detalhe.refeicoes.some(r => !detalhe.ativacaoRefeicoes.some(e => e.refeicaoId === r.id))) {
        throw new ConflictException('Estado operacional das refeições indisponível.');
      }
      const refeicoesAtivas = new Set(detalhe.ativacaoRefeicoes.filter(e => e.ativa).map(e => e.refeicaoId));
      return {
        id: plano.id,
        titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
        resumoNutricionalVigente: detalhe.resumoRefeicoesAtivas,
        numeroVersao: versao.numero,
        status: detalhe.status,
        ...(versao.publicadaEm ? { publicadoEm: versao.publicadaEm } : {}),
        ...(detalhe.objetivos ? { objetivo: detalhe.objetivos } : {}),
        ...(detalhe.observacoes ? { orientacoes: detalhe.observacoes } : {}),
        ...projetarMetasPaciente(detalhe.calculo),
        apresentacaoEstado: detalhe.apresentacaoEstado,
        ...(detalhe.preferenciasApresentacao ? { preferenciasApresentacao: detalhe.preferenciasApresentacao.paciente } : {}),
        refeicoes: projetarRefeicoesPaciente(detalhe.refeicoes.filter(r => refeicoesAtivas.has(r.id)).map(refeicao => ({
          id: refeicao.id, nome: refeicao.nome, horarioLocal: refeicao.horarioLocal, orientacoes: refeicao.orientacoes,
          itens: refeicao.itens.map(item => ({
            id: item.id, descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, porcaoGramas: item.porcaoGramas,
            nutrientes: item.composicaoSnapshot?.nutrientesPorcao ?? {},
            substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente,
            substituicoes: item.substituicoes.map(alternativa => ({
              id: alternativa.id, descricao: alternativa.descricao, quantidade: alternativa.quantidade, unidade: alternativa.unidade,
              porcaoGramas: alternativa.porcaoGramas, nutrientes: alternativa.composicaoSnapshot?.nutrientesPorcao ?? {},
              liberadaParaPaciente: alternativa.liberadaParaPaciente, preferida: alternativa.preferida
            }))
          }))
        })))
      };
    });
  }

  async listarEscolhasPaciente(
    tenantId: string,
    pacienteId: string,
    planoId: string,
    usuario: UsuarioAutenticado,
    consulta: ListarEscolhasPlanoAlimentarDto = new ListarEscolhasPlanoAlimentarDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const pagina = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.pagina ?? 1)));
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario);
      const versoes = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).find({
        where: { tenantId, planoId: plano.id }
      });
      if (!versoes.length) return { itens: [], total: 0, pagina, limite };

      const versaoPorId = new Map(versoes.map((versao) => [versao.id, versao]));
      const repositorioEscolhas = gerenciador.getRepository(PlanoAlimentarEscolhaPacienteOrm);
      const [escolhas, total] = await repositorioEscolhas.findAndCount({
        where: { tenantId, versaoId: In(versoes.map((versao) => versao.id)) },
        // `id` desempata eventos gravados no mesmo instante, para a paginação
        // não repetir ou omitir uma escolha da trilha.
        order: { criadoEm: 'DESC', id: 'DESC' },
        skip: (pagina - 1) * limite,
        take: limite
      });
      if (!escolhas.length) return { itens: [], total, pagina, limite };

      const itemIds = [...new Set(escolhas.map((escolha) => escolha.itemId))];
      const itens = await gerenciador.getRepository(PlanoAlimentarItemOrm).find({
        where: { tenantId, id: In(itemIds) }
      });
      const itemPorId = new Map(itens.map((item) => [item.id, item]));
      const refeicaoIds = [...new Set(itens.map((item) => item.refeicaoId))];
      const refeicoes = refeicaoIds.length
        ? await gerenciador.getRepository(PlanoAlimentarRefeicaoOrm).find({ where: { tenantId, id: In(refeicaoIds) } })
        : [];
      const refeicaoPorId = new Map(refeicoes.map((refeicao) => [refeicao.id, refeicao]));
      const substituicaoIds = [...new Set(escolhas.flatMap((escolha) => escolha.substituicaoId ? [escolha.substituicaoId] : []))];
      const substituicoes = substituicaoIds.length
        ? await gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm).find({
            where: { tenantId, id: In(substituicaoIds) }
          })
        : [];
      const substituicaoPorId = new Map(substituicoes.map((substituicao) => [substituicao.id, substituicao]));

      const itensResposta: EscolhaPlanoAlimentarProfissional[] = escolhas.map((escolha) => {
        const item = itemPorId.get(escolha.itemId);
        const refeicao = item ? refeicaoPorId.get(item.refeicaoId) : undefined;
        const substituicao = escolha.substituicaoId ? substituicaoPorId.get(escolha.substituicaoId) : undefined;
        const versao = versaoPorId.get(escolha.versaoId)!;
        return {
          id: escolha.id,
          versaoId: escolha.versaoId,
          versaoNumero: versao.numero,
          itemId: escolha.itemId,
          refeicaoNome: refeicao ? this.criptografia.descriptografar(refeicao.nomeCriptografado) : 'Refeicao indisponivel',
          itemDescricao: item ? this.criptografia.descriptografar(item.descricaoCriptografada) : 'Item indisponivel',
          ...(escolha.substituicaoId ? { substituicaoId: escolha.substituicaoId } : {}),
          ...(substituicao ? { substituicaoDescricao: this.criptografia.descriptografar(substituicao.descricaoCriptografada) } : {}),
          retornouAoPrincipal: !escolha.substituicaoId,
          escolhidoPorUsuarioId: escolha.escolhidoPorUsuarioId,
          criadoEm: escolha.criadoEm
        };
      });
      return { itens: itensResposta, total, pagina, limite };
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
      await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, 'pessimistic_read');
      const versao = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId, numero }
      });
      if (!versao) throw new NotFoundException('Versao do plano alimentar nao encontrada.');
      return this.montarVersao(gerenciador, versao, true);
    });
  }

  async obterAcompanhamentoVersao(
    tenantId: string,
    pacienteId: string,
    planoId: string,
    numero: number,
    usuario: UsuarioAutenticado,
    consulta: ListarAcompanhamentoVersaoPlanoDto = new ListarAcompanhamentoVersaoPlanoDto()
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    const limite = Math.min(100, Math.max(1, Math.trunc(consulta.limite ?? 25)));
    const paginaCheckins = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.paginaCheckins ?? 1)));
    const paginaQuestionarios = Math.min(
      PAGINA_MAXIMA,
      Math.max(1, Math.trunc(consulta.paginaQuestionarios ?? 1))
    );
    const paginaEscolhas = Math.min(PAGINA_MAXIMA, Math.max(1, Math.trunc(consulta.paginaEscolhas ?? 1)));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario);
      const repositorioVersoes = gerenciador.getRepository(PlanoAlimentarVersaoOrm);
      const versao = await repositorioVersoes.findOne({ where: { tenantId, planoId, numero } });
      if (!versao) throw new NotFoundException('Versao do plano alimentar nao encontrada.');
      if (!versao.publicadaEm) {
        throw new BadRequestException('Acompanhamento disponivel somente para versao publicada.');
      }

      const proximaVersaoPublicada = await repositorioVersoes.findOne({
        select: { publicadaEm: true },
        where: { tenantId, planoId, publicadaEm: MoreThan(versao.publicadaEm) },
        order: { publicadaEm: 'ASC' }
      });
      const proximaPublicacao = proximaVersaoPublicada?.publicadaEm;
      const intervalo = proximaPublicacao
        ? And(MoreThanOrEqual(versao.publicadaEm), LessThan(proximaPublicacao))
        : MoreThanOrEqual(versao.publicadaEm);

      const [checkins, totalCheckins] = await gerenciador.getRepository(LogDiarioRapidoOrm).findAndCount({
        where: { tenantId, pacienteId, tipo: 'humor', registradoEm: intervalo },
        order: { registradoEm: 'DESC', id: 'DESC' },
        skip: (paginaCheckins - 1) * limite,
        take: limite
      });
      const estadosSemResposta: EnvioQuestionarioOrm['status'][] = ['pendente', 'enviado', 'expirado'];
      const repositorioEnvios = gerenciador.getRepository(EnvioQuestionarioOrm);
      const [envios, totalEnvios] = await repositorioEnvios.findAndCount({
        where: { tenantId, pacienteId, status: In(estadosSemResposta), enviadoEm: intervalo },
        order: { enviadoEm: 'DESC', id: 'DESC' },
        skip: (paginaQuestionarios - 1) * limite,
        take: limite
      });
      const semReferenciaTemporal = await repositorioEnvios.count({
        where: { tenantId, pacienteId, status: In(estadosSemResposta), enviadoEm: IsNull() }
      });

      const repositorioEscolhas = gerenciador.getRepository(PlanoAlimentarEscolhaPacienteOrm);
      const [escolhas, totalEscolhas] = await repositorioEscolhas.findAndCount({
        where: { tenantId, versaoId: versao.id },
        order: { criadoEm: 'DESC', id: 'DESC' },
        skip: (paginaEscolhas - 1) * limite,
        take: limite
      });
      const itemIds = [...new Set(escolhas.map((escolha) => escolha.itemId))];
      const itens = itemIds.length
        ? await gerenciador.getRepository(PlanoAlimentarItemOrm).find({ where: { tenantId, id: In(itemIds) } })
        : [];
      const refeicaoIds = [...new Set(itens.map((item) => item.refeicaoId))];
      const refeicoes = refeicaoIds.length
        ? await gerenciador.getRepository(PlanoAlimentarRefeicaoOrm).find({
            where: { tenantId, versaoId: versao.id, id: In(refeicaoIds) }
          })
        : [];
      const refeicaoPorId = new Map(refeicoes.map((refeicao) => [refeicao.id, refeicao]));
      const itensDaVersao = itens.filter((item) => refeicaoPorId.has(item.refeicaoId));
      const itemPorId = new Map(itensDaVersao.map((item) => [item.id, item]));
      const itemIdsDaVersao = itensDaVersao.map((item) => item.id);
      const substituicaoIds = [...new Set(escolhas.flatMap((escolha) => escolha.substituicaoId ? [escolha.substituicaoId] : []))];
      const substituicoes = substituicaoIds.length && itemIdsDaVersao.length
        ? await gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm).find({
            where: { tenantId, itemId: In(itemIdsDaVersao), id: In(substituicaoIds) }
          })
        : [];
      const substituicaoPorId = new Map(substituicoes.map((substituicao) => [substituicao.id, substituicao]));

      return {
        versao: { id: versao.id, numero: versao.numero },
        periodo: { inicioEm: versao.publicadaEm, ...(proximaPublicacao ? { fimExclusivoEm: proximaPublicacao } : {}) },
        checkins: {
          itens: checkins.map((diario) => {
            const { valor, dadoIndisponivel } = this.lerValorDiario(diario);
            return {
              id: diario.id,
              adesaoPlano: typeof valor.adesaoPlano === 'number' ? valor.adesaoPlano : undefined,
              ...(dadoIndisponivel ? { dadoIndisponivel: true } : {}),
              registradoEm: diario.registradoEm,
              fonte: 'declaracao_paciente' as const
            };
          }),
          total: totalCheckins,
          pagina: paginaCheckins,
          limite
        },
        questionariosSemResposta: {
          itens: envios.map((envio) => ({
            id: envio.id,
            status: envio.status,
            titulo: envio.snapshotEstrutura?.titulo,
            enviadoEm: envio.enviadoEm,
            expiraEm: envio.expiraEm
          })),
          total: totalEnvios,
          semReferenciaTemporal,
          pagina: paginaQuestionarios,
          limite
        },
        escolhas: {
          itens: escolhas.map((escolha) => {
            const item = itemPorId.get(escolha.itemId);
            const refeicao = item ? refeicaoPorId.get(item.refeicaoId) : undefined;
            const substituicao = escolha.substituicaoId
              ? substituicaoPorId.get(escolha.substituicaoId)
              : undefined;
            return {
              id: escolha.id,
              versaoId: escolha.versaoId,
              versaoNumero: versao.numero,
              itemId: escolha.itemId,
              refeicaoNome: refeicao
                ? this.criptografia.descriptografar(refeicao.nomeCriptografado)
                : 'Refeicao indisponivel',
              itemDescricao: item
                ? this.criptografia.descriptografar(item.descricaoCriptografada)
                : 'Item indisponivel',
              ...(escolha.substituicaoId ? { substituicaoId: escolha.substituicaoId } : {}),
              ...(substituicao ? {
                substituicaoDescricao: this.criptografia.descriptografar(substituicao.descricaoCriptografada)
              } : {}),
              retornouAoPrincipal: !escolha.substituicaoId,
              criadoEm: escolha.criadoEm
            };
          }),
          total: totalEscolhas,
          pagina: paginaEscolhas,
          limite
        }
      };
    });
  }

  async obter(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, 'pessimistic_read');
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
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, 'pessimistic_read');
      const rascunho = await this.obterRascunhoAtivo(gerenciador, tenantId, plano.id);
      return this.montarVersao(gerenciador, rascunho, true);
    });
  }

  async atualizarRascunho(
    tenantId: string, pacienteId: string, planoId: string,
    usuario: UsuarioAutenticado, dados: AtualizarRascunhoPlanoAlimentarDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    this.validarDadosClinicosRascunho(dados);
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      if ((plano.ativacaoRevisao ?? 0) > 0) {
        throw new ConflictException('O plano e seus vínculos foram alterados. Use o editor atualizado com identidades de refeições.');
      }
      const rascunho = await this.obterRascunhoAtivo(gerenciador, tenantId, plano.id, true);
      this.conferirRevisaoEdicao(rascunho, dados);
      if (rascunho.alimentosPersonalizadosSnapshotCriptografado) throw new ConflictException('Use o editor atualizado para preservar a referência do alimento personalizado.');
      const edicaoAnterior = this.lerEdicao(rascunho).documentoEdicao;
      if(Object.keys(this.lerContextosEquivalencias(rascunho)).length)throw new ConflictException('Use o editor atualizado para preservar a equivalência.');
      if (edicaoAnterior?.refeicoes.some(r => r.itens.some(i => i.substituicoes?.some(a => a.origemGrupo))) ||
          await possuiGruposMaterializados(gerenciador, tenantId, rascunho.id, this.criptografia)) {
        throw new ConflictException('Use o editor atualizado para preservar a origem das substituições.');
      }
      await this.aplicarRascunhoClinico(gerenciador, tenantId, pacienteId, rascunho, dados);
      rascunho.edicaoSnapshotCriptografado = null;
      rascunho.medidasCaseirasSnapshotCriptografado = null;
      rascunho.edicaoProtegida = rascunho.edicaoProtegida || dados.rascunhoRevisaoEsperada !== undefined;
      this.avancarRevisaoEdicao(rascunho);
      rascunho.edicaoMaterializadaRevisao = rascunho.rascunhoRevisao;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      return this.montarVersao(gerenciador, rascunho, true);
    });
  }

  async salvarEdicaoRascunho(
    tenantId: string, pacienteId: string, planoId: string,
    usuario: UsuarioAutenticado, dados: SalvarEdicaoPlanoDto
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    let documento: DocumentoEdicaoPlano;
    try { documento = validarDocumentoEdicaoPlano(dados.documento); }
    catch { throw new BadRequestException('Documento de edição do plano inválido.'); }
    if (dados.rascunhoRevisaoEsperada === undefined) throw new BadRequestException('Informe a revisão do rascunho.');
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const rascunho = await this.obterRascunhoAtivo(gerenciador, tenantId, plano.id, true);
      this.conferirRevisaoEdicao(rascunho, dados);
      const estadoAnterior = this.lerEdicao(rascunho);
      if (estadoAnterior.edicaoEstado === 'indisponivel') throw new ConflictException('Snapshot de edição indisponível. Reconfira o rascunho.');
      const anteriorEdicao=estadoAnterior.documentoEdicao??null;
      // Confirmar uma nova aplicação nunca disponibiliza automaticamente uma
      // alternativa ao paciente. Decisões já salvas no mesmo item são legítimas.
      for(const r of documento.refeicoes)for(const i of r.itens)for(const a of i.substituicoes??[]){
        if(a.equivalencia&&'acao'in a.equivalencia&&a.equivalencia.acao==='calcular'&&(a.liberadaParaPaciente===true||a.preferida===true)){
          const anterior=anteriorEdicao?.refeicoes.flatMap(ref=>ref.itens).find(item=>item.chaveCliente===i.chaveCliente)?.substituicoes?.find(alt=>alt.chaveCliente===a.chaveCliente);
          if(!anterior)throw new BadRequestException('Novas alternativas de equivalência começam sem liberação ou preferência. Configure após confirmar.');
        }
      }
      const equivalenciasAnteriores=await this.resolverCopiasEquivalencia(gerenciador,tenantId,pacienteId,plano,rascunho,usuario,documento,dados.copiasEquivalencia);
      const catalogosAnteriores = rascunho.edicaoSnapshotCriptografado
        ? lerSnapshotEdicaoGrupos(this.lerJsonCriptografado(rascunho.edicaoSnapshotCriptografado)).catalogos : {};
      const materializadas=anteriorEdicao?{anteriores:{},custom:{},catalogo:{}}:await lerOrigensMaterializadas(gerenciador,tenantId,rascunho.id,documento,this.criptografia);
      let origensGrupo: Record<string,OrigemGrupoSnapshot>;
      try {
        origensGrupo=await resolverGruposDocumento(documento,anteriorEdicao,
          ref=>this.gruposSubstituicoes.resolverAplicacao(gerenciador,tenantId,usuario,ref),materializadas.anteriores);
      }catch(erro){
        if(erro instanceof ConflitoAplicacaoGrupo)throw new ConflictException(erro.message);
        if(erro instanceof DocumentoGrupoInvalido)throw new BadRequestException(erro.message);
        throw erro;
      }
      const contextosCustomAnteriores={...this.lerContextosCustom(rascunho)};
      for(const r of documento.refeicoes)for(const i of r.itens)for(const a of i.substituicoes??[]){
        const herdado=materializadas.custom[a.chaveCliente];
        if(herdado&&a.origemGrupo&&!a.alimentoPersonalizado){
          a.alimentoPersonalizado={id:herdado.id,revisao:herdado.revisao,aplicacaoId:herdado.aplicacaoId};
          contextosCustomAnteriores[a.chaveCliente]=herdado;
        }
      }
      let contextosCustom: ContextosAlimentosPersonalizados;
      try {
        contextosCustom = await resolverAlimentosPersonalizados(documento, contextosCustomAnteriores,
          ref => this.alimentosPersonalizados.resolverAplicacao(gerenciador, tenantId, usuario, ref));
      } catch (erro) {
        if (erro instanceof ReferenciaCustomConflitanteError) throw new ConflictException(erro.message);
        throw erro;
      }
      const contextosAnteriores = this.lerContextosMedidas(rascunho);
      const contextosMedidas = await resolverMedidasDocumento(documento, contextosAnteriores,
        (alimentoId, referencia, quantidade, origem) => this.medidasCaseiras.resolverAplicacao(gerenciador, tenantId, usuario, alimentoId, referencia, quantidade, origem));
      capturarFatosCustom(documento, contextosCustom);
      const clinico = converterEdicaoParaRascunho(documento, rascunho);
      const composicoesCustom = new Map<object, ComposicaoPersonalizada>();
      const provenienciasGrupo = new Map<object,OrigemGrupoSnapshot>();
      const composicoesCatalogoGrupo = new Map<object, SnapshotComposicao>();
      const catalogosGrupos: ContextosCatalogoGrupo = Object.create(null);
      documento.refeicoes.forEach((r, ri) => r.itens.forEach((i, ii) => {
        const dto = clinico.refeicoes[ri].itens[ii];
        if (Object.hasOwn(contextosCustom, i.chaveCliente)) composicoesCustom.set(dto, contextosCustom[i.chaveCliente].composicao);
        (i.substituicoes ?? []).forEach((a, ai) => {
          if (Object.hasOwn(contextosCustom, a.chaveCliente)) composicoesCustom.set(dto.substituicoes![ai], contextosCustom[a.chaveCliente].composicao);
          if (Object.hasOwn(origensGrupo,a.chaveCliente)) {
            const origem=origensGrupo[a.chaveCliente],custom=contextosCustom[a.chaveCliente];
            if(custom){origem.referenciaAlimento={origem:'custom',alimentoId:custom.id,revisao:custom.revisao};origem.tipoBaseCustom=custom.composicao.baseOrigem.tipo;}
            else if(a.alimentoComposicaoId)origem.referenciaAlimento={origem:'catalogo',alimentoId:a.alimentoComposicaoId};
            provenienciasGrupo.set(dto.substituicoes![ai],origem);
          }
        });
      }));
      for (let ri = 0; ri < documento.refeicoes.length; ri++) for (let ii = 0; ii < documento.refeicoes[ri].itens.length; ii++) {
        const item = documento.refeicoes[ri].itens[ii];
        for (let ai = 0; ai < (item.substituicoes ?? []).length; ai++) {
          const a = item.substituicoes![ai];
          if (!a.origemGrupo || !a.alimentoComposicaoId) continue;
          const dto = clinico.refeicoes[ri].itens[ii].substituicoes![ai];
          const anterior = catalogosAnteriores[a.chaveCliente] ?? materializadas.catalogo[a.chaveCliente];
          const preservado = anterior && anterior.itemChave === item.chaveCliente &&
            anterior.snapshot.alimentoComposicaoId === a.alimentoComposicaoId && mesmaOrigemGrupo(anterior.origemGrupo, a.origemGrupo);
          if (!preservado) {
            const paiAnterior = anteriorEdicao?.refeicoes.flatMap(r => r.itens).find(i => i.chaveCliente === item.chaveCliente);
            const altAnterior = paiAnterior?.substituicoes?.find(s => s.chaveCliente === a.chaveCliente);
            if (altAnterior?.origemGrupo && altAnterior.alimentoComposicaoId === a.alimentoComposicaoId && mesmaOrigemGrupo(altAnterior.origemGrupo, a.origemGrupo)) {
              throw new ServiceUnavailableException('Snapshot de catálogo aplicado indisponível.');
            }
          }
          if (a.micronutrientesPor100g !== undefined) throw new BadRequestException('Micronutrientes de catálogo não aceitam alteração manual.');
          const snapshot = preservado ? anterior.snapshot : (await this.resolverItem(gerenciador, dto)).snapshot;
          catalogosGrupos[a.chaveCliente] = { itemChave: item.chaveCliente, origemGrupo: a.origemGrupo, snapshot };
          a.descricao = snapshot.descricao; a.nutrientesPor100g = { ...snapshot.nutrientesPor100g };
          composicoesCatalogoGrupo.set(dto, snapshot);
        }
      }
      const contextosEquivalencias:ContextosEquivalencias=Object.create(null);
      const materiaisEquivalencia=new Map<object,{contexto:ContextoEquivalencia;fatos:FatosComposicaoEquivalencia}>();
      const temEquivalencia=Object.keys(equivalenciasAnteriores).length||documento.refeicoes.some(r=>r.itens.some(i=>i.substituicoes?.some(a=>a.equivalencia)));
      if(temEquivalencia){
        const fontes=new FontesGruposSubstituicoes(this.criptografia);
        const profissionalId=await resolverProfissionalIdDoUsuario(gerenciador,tenantId,usuario);
        const atorEquivalencia=usuario.papel==='Professional'&&profissionalId?{usuarioId:usuario.usuarioId,profissionalId}:undefined;
        const temComandos=documento.refeicoes.some(r=>r.itens.some(i=>i.substituicoes?.some(a=>a.equivalencia&&'acao'in a.equivalencia)));
        if(temComandos&&!atorEquivalencia)throw new ForbiddenException('Equivalência requer profissional responsável.');
        const preservados:FatosPreservadosEquivalencia={custom:contextosCustom,catalogos:catalogosGrupos,equivalencias:Object.create(null)};
        for(const [chave,original]of Object.entries(equivalenciasAnteriores)){
          const c={...original,...original.aplicados};
          preservados.equivalencias![chave]={identidade:c.alternativa.identidade,fatos:c.alternativa};
          if(!c.principal.identidade.startsWith('manual:'))preservados.equivalencias![c.itemChave]={identidade:c.principal.identidade,fatos:c.principal};
        }
        const fatos=(a:any,pai?:string)=>resolverFatosEquivalencia(gerenciador,tenantId,profissionalId,a,fontes,preservados,pai);
        const localizar=(chave:string)=>{for(let ri=0;ri<documento.refeicoes.length;ri++)for(let ii=0;ii<documento.refeicoes[ri].itens.length;ii++)if(documento.refeicoes[ri].itens[ii].chaveCliente===chave)return clinico.refeicoes[ri].itens[ii];throw new ConflitoEquivalenciaEdicao();};
        let resolvidos:ContextosEquivalencias;
        try{resolvidos=await resolverEquivalenciasDocumento(documento,equivalenciasAnteriores,{
          ator:atorEquivalencia,
          dependencias:async(i,a,c)=>assinaturaDependenciasEquivalencia(i,a,await fatos(i),await fatos(a,i.chaveCliente),c.nutriente,c.politica),
          prever:async(d,i,a,c)=>{
            const previa=await this.equivalencias.preverNaTransacao(gerenciador,tenantId,pacienteId,planoId,usuario,{versaoId:rascunho.id,rascunhoRevisaoEsperada:rascunho.rascunhoRevisao??0,documentoEdicao:d,itemChave:i.chaveCliente,nutriente:c.nutriente!,politica:c.politica!,alternativas:[a]});
            const linha=previa.alternativas[0];if(!linha.alimento||!linha.fingerprint)throw new ConflitoEquivalenciaEdicao();
            const pi=localizar(i.chaveCliente),ai=(i.substituicoes??[]).findIndex(x=>x.chaveCliente===a.chaveCliente),pa=pi.substituicoes![ai];
            const snapshotPrincipal=(await this.resolverItem(gerenciador,pi,composicoesCustom.get(pi),composicoesCatalogoGrupo.get(pi))).snapshot;
            const snapshotAlternativa=(await this.resolverItem(gerenciador,pa,composicoesCustom.get(pa),composicoesCatalogoGrupo.get(pa))).snapshot;
            return {fingerprint:linha.fingerprint,principal:previa.principal,alternativa:linha.alimento,resultado:linha.resultado,snapshotPrincipal,snapshotAlternativa};
          }
        });}catch(erro){if(erro instanceof ConflitoEquivalenciaEdicao)throw new ConflictException(erro.message);throw erro;}
        Object.assign(contextosEquivalencias,resolvidos);
        for(const r of documento.refeicoes)for(const i of r.itens){const pi=localizar(i.chaveCliente);for(let ai=0;ai<(i.substituicoes??[]).length;ai++){
          const a=i.substituicoes![ai],c=resolvidos[a.chaveCliente];if(!c)continue;const pa=pi.substituicoes![ai],f=await fatos(a,i.chaveCliente);
          const atual=c.aplicados??c;
          if(atual.snapshotPrincipal?.origem==='catalogo'&&i.alimentoComposicaoId===atual.snapshotPrincipal.alimentoComposicaoId)composicoesCatalogoGrupo.set(pi,atual.snapshotPrincipal);
          if(atual.snapshotAlternativa?.origem==='catalogo'&&a.alimentoComposicaoId===atual.snapshotAlternativa.alimentoComposicaoId)composicoesCatalogoGrupo.set(pa,atual.snapshotAlternativa);
          const principalAtual=await fatos(i);
          if(c.aplicados||principalAtual.identidade!==c.principal.identidade||f.identidade!==c.alternativa.identidade){
            // Registra os fatos da edição atual sem reescrever o cálculo original.
            // A pendência só se resolve por recálculo ou desvinculação explícitos.
            c.aplicados={principal:principalAtual,alternativa:f,
              snapshotPrincipal:(await this.resolverItem(gerenciador,pi,composicoesCustom.get(pi),composicoesCatalogoGrupo.get(pi))).snapshot,
              snapshotAlternativa:(await this.resolverItem(gerenciador,pa,composicoesCustom.get(pa),composicoesCatalogoGrupo.get(pa))).snapshot};
          }
          materiaisEquivalencia.set(pa,{contexto:c,fatos:f});
        }}
      }
      await this.validarReferenciasEdicao(gerenciador, tenantId, pacienteId, documento, catalogosGrupos, contextosEquivalencias);
      const identidades = await this.prepararIdentidadesEdicao(gerenciador, plano, rascunho, documento);
      let materializada = false;
      if (!validateSync(clinico, { whitelist: true, forbidNonWhitelisted: true }).length && this.lerApresentacao(rascunho).apresentacaoEstado !== 'indisponivel') {
        try {
          await this.aplicarRascunhoClinico(gerenciador, tenantId, pacienteId, rascunho, clinico, identidades, composicoesCustom, provenienciasGrupo, composicoesCatalogoGrupo, materiaisEquivalencia);
          materializada = true;
        } catch (erro) {
          // Incompletude/inaplicabilidade clínica não apaga o documento editorial.
          // Erros de infraestrutura/concorrência NÃO são convertidos em sucesso.
          if (!(erro instanceof BadRequestException)) throw erro;
        }
      }
      rascunho.edicaoSnapshotCriptografado = this.criptografia.criptografar(serializarSnapshotEdicaoGrupos(documento, catalogosGrupos, contextosEquivalencias));
      rascunho.alimentosPersonalizadosSnapshotCriptografado = Object.keys(contextosCustom).length ? this.criptografia.criptografar(JSON.stringify({ schemaVersao: 1, contextos: contextosCustom })) : null;
      rascunho.medidasCaseirasSnapshotCriptografado = Object.keys(contextosMedidas).length ? this.criptografia.criptografar(JSON.stringify({schemaVersao:1,contextos:contextosMedidas})) : null;
      rascunho.edicaoProtegida = true;
      this.avancarRevisaoEdicao(rascunho);
      rascunho.edicaoMaterializadaRevisao = materializada ? rascunho.rascunhoRevisao : null;
      rascunho.revisadaEm = null;
      rascunho.revisadaPorUsuarioId = null;
      rascunho.hashConteudo = null;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      if(dados.copiasEquivalencia?.length)await registrarAuditoriaNaTransacao(gerenciador,{
        tenantId,usuarioId:usuario.usuarioId,acao:'planos_alimentares.equivalencia_copiar',
        recursoTipo:'plano_alimentar_versao',recursoId:rascunho.id,
        metadados:{quantidadeEquivalencias:dados.copiasEquivalencia.length,versaoDestino:rascunho.numero}
      });
      return this.montarVersao(gerenciador, rascunho, true);
    });
  }

  private lerContextosEquivalencias(versao:PlanoAlimentarVersaoOrm):ContextosEquivalencias {
    if(!versao.edicaoSnapshotCriptografado)return {};
    try{return lerSnapshotEdicaoGrupos(this.lerJsonCriptografado(versao.edicaoSnapshotCriptografado)).equivalencias??{};}catch{throw new ConflictException('Contexto de equivalência indisponível.');}
  }

  private async lerContextosEquivalenciasMaterializadas(gerenciador:EntityManager,versao:PlanoAlimentarVersaoOrm):Promise<ContextosEquivalencias>{
    const refeicoes=await gerenciador.getRepository(PlanoAlimentarRefeicaoOrm).find({where:{tenantId:versao.tenantId,versaoId:versao.id}});
    if(!refeicoes.length)return Object.create(null);
    const itens=await gerenciador.getRepository(PlanoAlimentarItemOrm).find({where:{tenantId:versao.tenantId,refeicaoId:In(refeicoes.map(r=>r.id))}});
    if(!itens.length)return Object.create(null);
    const linhas=await gerenciador.getRepository(PlanoAlimentarSubstituicaoOrm).find({where:{tenantId:versao.tenantId,itemId:In(itens.map(i=>i.id))}});
    const contextos:ContextosEquivalencias=Object.create(null);
    for(const linha of linhas){
      const contexto=this.lerJsonCriptografado<SnapshotComposicao>(linha.composicaoSnapshotCriptografada).equivalencia;
      if(!contexto)continue;
      if(Object.hasOwn(contextos,contexto.alternativaChave))throw new ConflictException('A versão de origem contém referências FOOD05 duplicadas.');
      contextos[contexto.alternativaChave]=contexto;
    }
    return validarContextosEquivalencias(contextos);
  }

  private async resolverCopiasEquivalencia(
    gerenciador:EntityManager,tenantId:string,pacienteDestinoId:string,planoDestino:PlanoAlimentarOrm,
    versaoDestino:PlanoAlimentarVersaoOrm,usuario:UsuarioAutenticado,documento:DocumentoEdicaoPlano,
    referencias:ReferenciaCopiaEquivalenciaDto[]|undefined
  ):Promise<ContextosEquivalencias>{
    const atuais=this.lerContextosEquivalencias(versaoDestino);
    if(!referencias?.length)return atuais;
    const profissionalId=await resolverProfissionalIdDoUsuario(gerenciador,tenantId,usuario);
    if(usuario.papel!=='Professional'||!profissionalId)throw new ForbiddenException('Cópia de equivalência exige profissional vinculado.');
    const copiadaPor={usuarioId:usuario.usuarioId,profissionalId},usos=new Set<string>(),versoes=new Map<string,{versao:PlanoAlimentarVersaoOrm;documento?:DocumentoEdicaoPlano;contextos:ContextosEquivalencias}>();
    const porChaveDestino=new Map<string,{item:DocumentoEdicaoPlano['refeicoes'][number]['itens'][number];alternativa:NonNullable<DocumentoEdicaoPlano['refeicoes'][number]['itens'][number]['substituicoes']>[number]}>();
    for(const refeicao of documento.refeicoes)for(const item of refeicao.itens)for(const alternativa of item.substituicoes??[])porChaveDestino.set(alternativa.chaveCliente,{item,alternativa});
    const resultado:ContextosEquivalencias=Object.assign(Object.create(null),atuais);
    for(const referencia of referencias){
      const chave=referencia.alternativaChaveDestino,alvo=porChaveDestino.get(chave);
      if(!alvo||alvo.item.chaveCliente!==referencia.itemChaveDestino||atuais[chave]||alvo.alternativa.equivalencia||Object.hasOwn(resultado,chave)||usos.has(chave))throw new ConflictException('A cópia não corresponde ao rascunho atual. Recarregue e tente novamente.');
      usos.add(chave);
      const cache=`${referencia.pacienteOrigemId}:${referencia.planoOrigemId}:${referencia.numeroVersaoOrigem}`;
      let fonte=versoes.get(cache);
      if(!fonte){
        await this.obterPlanoNoEscopo(gerenciador,tenantId,referencia.pacienteOrigemId,referencia.planoOrigemId,usuario,'pessimistic_read');
        const versao=await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({where:{tenantId,planoId:referencia.planoOrigemId,numero:referencia.numeroVersaoOrigem},lock:{mode:'pessimistic_read'}});
        if(!versao||versao.descartadaEm)throw new ConflictException('A versão de origem não está disponível para cópia.');
        if(versao.publicadaEm){
          fonte={versao,contextos:await this.lerContextosEquivalenciasMaterializadas(gerenciador,versao)};
        }else{
          const leitura=this.lerEdicao(versao);
          if(!leitura.documentoEdicao||leitura.edicaoEstado==='indisponivel')throw new ConflictException('A proveniência de equivalência da origem não está disponível.');
          fonte={versao,documento:leitura.documentoEdicao,contextos:this.lerContextosEquivalencias(versao)};
        }
        versoes.set(cache,fonte);
      }
      const contexto=fonte.contextos[referencia.alternativaChaveOrigem];
      const alternativaOrigem=fonte.documento?.refeicoes.flatMap(r=>r.itens).find(i=>i.chaveCliente===referencia.itemChaveOrigem)?.substituicoes?.find(a=>a.chaveCliente===referencia.alternativaChaveOrigem);
      if(!contexto||contexto.itemChave!==referencia.itemChaveOrigem||contexto.alternativaChave!==referencia.alternativaChaveOrigem
        ||(!fonte.versao.publicadaEm&&(!alternativaOrigem?.equivalencia||'acao'in alternativaOrigem.equivalencia||alternativaOrigem.equivalencia.aplicacaoId!==contexto.aplicacaoId)))throw new ConflictException('A equivalência da origem mudou ou não está vinculada a essa alternativa. Carregue a origem novamente.');
      let copiado:ContextoEquivalencia;
      try{copiado=clonarContextoEquivalenciaParaCopia(contexto,
        {pacienteId:referencia.pacienteOrigemId,planoId:referencia.planoOrigemId,versaoId:fonte.versao.id},
        {pacienteId:pacienteDestinoId,planoId:planoDestino.id,versaoId:versaoDestino.id,itemChave:referencia.itemChaveDestino,alternativaChave:referencia.alternativaChaveDestino},
        copiadaPor,new Date().toISOString());}
      catch(erro){if(erro instanceof ConflitoEquivalenciaEdicao)throw new ConflictException(erro.message);throw erro;}
      resultado[chave]=copiado;
    }
    return validarContextosEquivalencias(resultado);
  }
  private garantirEquivalenciasRevisadas(versao:PlanoAlimentarVersaoOrm):void {
    if(Object.values(this.lerContextosEquivalencias(versao)).some(c=>c.estado==='revisao_pendente'))throw new BadRequestException('Equivalência com revisão pendente: recalcular ou manter como manual antes de publicar.');
  }
  private lerContextosCustom(versao: PlanoAlimentarVersaoOrm): ContextosAlimentosPersonalizados {
    if (!versao.alimentosPersonalizadosSnapshotCriptografado) return {};
    try { return validarContextosCustom(JSON.parse(this.criptografia.descriptografar(versao.alimentosPersonalizadosSnapshotCriptografado))); }
    catch { throw new ServiceUnavailableException('Referência de alimento personalizado indisponível.'); }
  }

  private lerContextosMedidas(versao: PlanoAlimentarVersaoOrm): ContextosMedidas {
    if (!versao.medidasCaseirasSnapshotCriptografado) return {};
    try {
      const snapshot = JSON.parse(this.criptografia.descriptografar(versao.medidasCaseirasSnapshotCriptografado));
      if (snapshot?.schemaVersao !== 1 || !snapshot.contextos || typeof snapshot.contextos !== 'object' || Array.isArray(snapshot.contextos)) throw new Error();
      return snapshot.contextos;
    } catch { throw new ServiceUnavailableException('Referência de medida indisponível.'); }
  }

  private async validarReferenciasEdicao(gerenciador: EntityManager, tenantId: string, pacienteId: string, documento: DocumentoEdicaoPlano, catalogosGrupos: ContextosCatalogoGrupo = {}, equivalencias: ContextosEquivalencias = {}) {
    if (documento.avaliacaoAntropometricaId) {
      const avaliacao = await gerenciador.getRepository(AvaliacaoAntropometricaOrm).findOne({
        where: { id: documento.avaliacaoAntropometricaId, tenantId, pacienteId, excluidaEm: IsNull() },
        lock: { mode: 'pessimistic_read' }
      });
      if (!avaliacao) throw new BadRequestException('Avaliação de referência indisponível para este paciente.');
    }
    const protegido=(a:{chaveCliente:string;alimentoComposicaoId?:string|null},pai:string)=>Object.hasOwn(catalogosGrupos,a.chaveCliente)||Object.values(equivalencias).some(original=>{const c={...original,...original.aplicados};return c.itemChave===pai&&((c.alternativaChave===a.chaveCliente&&c.snapshotAlternativa?.origem==='catalogo'&&c.snapshotAlternativa.alimentoComposicaoId===a.alimentoComposicaoId)||(c.itemChave===a.chaveCliente&&c.snapshotPrincipal?.origem==='catalogo'&&c.snapshotPrincipal.alimentoComposicaoId===a.alimentoComposicaoId));});
    const ids = new Set(documento.refeicoes.flatMap(r => r.itens.flatMap(i => [i, ...(i.substituicoes ?? [])].filter(a=>!protegido(a,i.chaveCliente)))).map(i => i.alimentoComposicaoId).filter((id): id is string => Boolean(id)));
    for (const id of ids) {
      const alimento = await gerenciador.getRepository(AlimentoComposicaoOrm).findOne({ where: { id }, lock: { mode: 'pessimistic_read' } });
      if (!alimento) throw new BadRequestException('Alimento de referência indisponível.');
      const fonte = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).findOne({ where: { id: alimento.fonteId, situacao: 'ativa' }, lock: { mode: 'pessimistic_read' } });
      if (!fonte) throw new BadRequestException('Fonte do alimento indisponível.');
    }
  }

  private validarDadosClinicosRascunho(dados: AtualizarRascunhoPlanoAlimentarDto): void {
    const metaManual = dados.origemMeta === 'manual';
    // A trava clinica continua: condicao especial nunca usa formula preditiva.
    // O que mudou e existir uma saida -- a meta manual -- em vez de recusa seca.
    if (dados.possuiCondicaoEspecial && !metaManual) {
      throw new BadRequestException(
        'Condicao especial informada: o calculo automatico nao e seguro. Informe a meta manualmente.'
      );
    }
    if (metaManual && !dados.possuiCondicaoEspecial) {
      throw new BadRequestException(
        'A meta manual existe para paciente com condicao especial declarada; nao e atalho para pular a formula.'
      );
    }
    if (metaManual) {
      if (!dados.justificativaCondicaoEspecial?.trim()) {
        throw new BadRequestException('Descreva a justificativa clinica da condicao especial.');
      }
    } else if (!dados.aplicabilidadeFormulaConfirmada) {
      throw new BadRequestException('Confirme explicitamente a aplicabilidade da formula antes de calcular o plano.');
    }

  }

  private async aplicarRascunhoClinico(
    gerenciador: EntityManager, tenantId: string, pacienteId: string,
    rascunho: PlanoAlimentarVersaoOrm, dados: AtualizarRascunhoPlanoAlimentarDto, identidades?: string[], composicoesCustom?: ReadonlyMap<object, ComposicaoPersonalizada>, provenienciasGrupo?: ReadonlyMap<object,OrigemGrupoSnapshot>, composicoesCatalogoGrupo?: ReadonlyMap<object, SnapshotComposicao>, materiaisEquivalencia?: ReadonlyMap<object,{contexto:ContextoEquivalencia;fatos:FatosComposicaoEquivalencia}>
  ): Promise<void> {
    this.validarDadosClinicosRascunho(dados);
    const metaManual = dados.origemMeta === 'manual';
    let preferencias;
    if (dados.preferenciasApresentacao !== undefined) {
      try { preferencias = validarPreferenciasApresentacao(dados.preferenciasApresentacao); }
      catch { throw new BadRequestException('Preferências de apresentação inválidas.'); }
      if (!Number.isSafeInteger(dados.apresentacaoRevisaoEsperada) || dados.apresentacaoRevisaoEsperada! < 0 || dados.apresentacaoRevisaoEsperada! >= 2147483647 || !dados.rascunhoIdEsperado) {
        throw new BadRequestException('Informe a identidade e a revisão das preferências do rascunho.');
      }
      if (dados.rascunhoIdEsperado !== rascunho.id || dados.apresentacaoRevisaoEsperada !== (rascunho.apresentacaoRevisao ?? 0)) {
        throw new ConflictException('O rascunho ou suas preferências foram alterados. Recarregue e confira antes de salvar.');
      }
    }

    const avaliacao = await gerenciador.getRepository(AvaliacaoAntropometricaOrm).findOne({
      where: {
        id: dados.avaliacaoAntropometricaId,
        tenantId,
        pacienteId,
        excluidaEm: IsNull()
      }
    });
    const entradaCalculo = this.validarAvaliacaoAntropometrica(avaliacao);
    let estimativa: ReturnType<typeof calcularEstimativaEnergetica> | undefined;
    let metasMacronutrientes: ReturnType<typeof calcularMetasMacronutrientes>;
    let metaEnergeticaKcal: number;
    try {
      if (metaManual && dados.metodoMacrosManual === 'gramas_por_kg') {
        // Em g/kg os macros sao a prescricao; a energia e consequencia deles.
        metasMacronutrientes = calcularMetasMacronutrientesPorPeso(
          entradaCalculo.pesoKg,
          dados.macrosGramasPorKg!
        );
        metaEnergeticaKcal = calcularEnergiaDasMetas(metasMacronutrientes);
      } else if (metaManual) {
        metaEnergeticaKcal = dados.metaEnergeticaManualKcal!;
        metasMacronutrientes = calcularMetasMacronutrientes(metaEnergeticaKcal, dados.distribuicaoMacros);
      } else {
        estimativa = calcularEstimativaEnergetica({
          formula: dados.formula,
          sexo: entradaCalculo.sexo,
          idadeAnos: entradaCalculo.idadeAnos,
          pesoKg: entradaCalculo.pesoKg,
          alturaCm: entradaCalculo.alturaCm,
          fatorAtividade: dados.fatorAtividade
        });
        metaEnergeticaKcal = estimativa.gastoEnergeticoTotalKcal + (dados.ajusteEnergeticoKcal ?? 0);
        metasMacronutrientes = calcularMetasMacronutrientes(metaEnergeticaKcal, dados.distribuicaoMacros);
      }
    } catch (erro) {
      throw new BadRequestException(erro instanceof Error ? erro.message : 'Dados invalidos para o calculo nutricional.');
    }

    const estrutura = await this.resolverEstrutura(gerenciador, dados, composicoesCustom, provenienciasGrupo, composicoesCatalogoGrupo, materiaisEquivalencia);
    let totais: ReturnType<typeof calcularTotaisPlano>;
    try {
      validarEstruturaPlano(estrutura);
      totais = calcularTotaisPlano(estrutura);
    } catch (erro) {
      throw new BadRequestException(erro instanceof Error ? erro.message : 'Estrutura do plano alimentar invalida.');
    }

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
      origemMeta: dados.origemMeta,
      metodoMacrosManual: metaManual ? dados.metodoMacrosManual : undefined,
      macrosGramasPorKg:
        metaManual && dados.metodoMacrosManual === 'gramas_por_kg' ? dados.macrosGramasPorKg : undefined,
      possuiCondicaoEspecial: dados.possuiCondicaoEspecial,
      justificativaCondicaoEspecial: dados.justificativaCondicaoEspecial?.trim(),
      aplicabilidadeFormulaConfirmada: metaManual ? false : dados.aplicabilidadeFormulaConfirmada,
      fatorAtividade: metaManual ? undefined : dados.fatorAtividade,
      estimativa,
      ajusteEnergeticoKcal: metaManual ? 0 : (dados.ajusteEnergeticoKcal ?? 0),
      metaEnergeticaKcal,
      distribuicaoMacros:
        metaManual && dados.metodoMacrosManual === 'gramas_por_kg' ? undefined : dados.distribuicaoMacros,
      metasMacronutrientes,
      alertasDivergenciaClinica,
      justificativaDivergenciaClinica: dados.justificativaDivergenciaClinica?.trim()
    };

    if (preferencias) {
      rascunho.apresentacaoSnapshotCriptografado = this.criptografia.criptografar(JSON.stringify(preferencias));
      rascunho.apresentacaoRevisao = (rascunho.apresentacaoRevisao ?? 0) + 1;
    }
    await this.substituirFilhos(gerenciador, tenantId, rascunho.id, estrutura, identidades);
    rascunho.avaliacaoAntropometricaId = avaliacao!.id;
    // `null` e proposital: se o rascunho ja tinha formula e virou manual, so
    // `null` limpa a coluna -- `undefined` deixaria a formula antiga no banco.
    rascunho.formulaCodigo = estimativa?.formulaCodigo ?? null;
    rascunho.formulaVersao = estimativa?.formulaVersao ?? null;
    rascunho.motorCalculoVersao = MOTOR_CALCULO_VERSAO;
    rascunho.objetivosCriptografados = this.criptografia.criptografar(dados.objetivos.trim());
    rascunho.observacoesCriptografadas = dados.observacoes?.trim()
      ? this.criptografia.criptografar(dados.observacoes.trim())
      : null;
    rascunho.calculoSnapshotCriptografado = this.criptografia.criptografar(JSON.stringify(calculoSnapshot));
    rascunho.totaisSnapshotCriptografado = this.criptografia.criptografar(JSON.stringify(totais));
    // Editar invalida a revisao: quem revisou aprovou outro conteudo. Precisa
    // ser `null` -- com `undefined` o TypeORM nao escreve a coluna e o plano
    // continuaria "revisado" no banco, publicavel sem passar pela revisao.
    rascunho.revisadaEm = null;
    rascunho.revisadaPorUsuarioId = null;
    rascunho.hashConteudo = null;
  }

  async revisar(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado, dados: PrecondicaoEdicaoPlanoDto = {}) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
        where: { tenantId, planoId: plano.id, publicadaEm: IsNull(), descartadaEm: IsNull() },
        lock: { mode: 'pessimistic_write' }
      });
      if (!rascunho) throw new NotFoundException('Rascunho do plano alimentar nao encontrado.');
      this.conferirRevisaoEdicao(rascunho, dados);
      this.garantirApresentacaoDisponivel(rascunho);
      this.garantirRascunhoCompleto(rascunho);
      this.garantirEquivalenciasRevisadas(rascunho);
      const conteudo = await this.montarVersao(gerenciador, rascunho);
      if (!conteudo.refeicoes.length || conteudo.refeicoes.some((refeicao) => !refeicao.itens.length)) {
        throw new BadRequestException('Preencha todas as refeicoes antes da revisao.');
      }
      rascunho.revisadaEm = new Date();
      rascunho.revisadaPorUsuarioId = usuario.usuarioId;
      rascunho.edicaoProtegida = rascunho.edicaoProtegida || dados.rascunhoRevisaoEsperada !== undefined;
      this.avancarRevisaoEdicao(rascunho);
      rascunho.edicaoMaterializadaRevisao = rascunho.rascunhoRevisao;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      return this.montarVersao(gerenciador, rascunho, true);
    });
  }

  /** Estado operacional, independente da edição clínica e do hash publicado. */
  async alterarAtivacao(
    tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado,
    dados: { ativo: boolean; ativacaoRevisaoEsperada: number }, identidadeRefeicaoId?: string
  ) {
    this.garantirPapelProfissional(usuario);
    this.garantirPermissao(usuario, 'planos_alimentares.gerenciar');
    if (typeof dados.ativo !== 'boolean' || !Number.isInteger(dados.ativacaoRevisaoEsperada) ||
        dados.ativacaoRevisaoEsperada < 0 || dados.ativacaoRevisaoEsperada >= 2147483647) {
      throw new BadRequestException('Informe estado e revisão de ativação válidos.');
    }
    return this.executorTenant.executar(tenantId, async gerenciador => {
      const plano = await this.obterPlanoNoEscopo(gerenciador, tenantId, pacienteId, planoId, usuario, true);
      if (dados.ativacaoRevisaoEsperada !== (plano.ativacaoRevisao ?? 0)) {
        throw new ConflictException('A ativação mudou. Recarregue antes de confirmar.');
      }
      let estadoAtual = plano.ativoParaPaciente === true;
      if (identidadeRefeicaoId) {
        // A identidade precisa estar em uma versão atual: IDs de versões antigas
        // não autorizam alterar refeições que já não pertencem ao plano vigente.
        const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
          where:{tenantId,planoId,publicadaEm:IsNull(),descartadaEm:IsNull()},lock:{mode:'pessimistic_read'}
        });
        const pertenceEdicao = rascunho ? this.identidadesAtuaisEdicao(rascunho).some(r => r.identidadeId === identidadeRefeicaoId) : false;
        const estados: Array<{ ativa: boolean }> = await gerenciador.query(`
          select e.ativa from plano_alimentar_refeicao_estados e
          where e.tenant_id=$1 and e.plano_id=$2 and e.id=$3 and ($5::boolean or exists (
            select 1 from plano_alimentar_refeicao_vinculos l
            join plano_alimentar_versoes v on v.tenant_id=l.tenant_id and v.id=l.versao_id
            where l.tenant_id=e.tenant_id and l.plano_id=e.plano_id and l.identidade_id=e.id
              and v.plano_id=e.plano_id and v.descartada_em is null
              and (v.id=$4 or (v.publicada_em is null and v.edicao_snapshot_criptografado is null)))) for update of e`,
        [tenantId, planoId, identidadeRefeicaoId, plano.versaoPublicadaAtualId ?? null, pertenceEdicao]);
        if (estados.length !== 1) throw new NotFoundException('Refeição vigente não encontrada.');
        estadoAtual = estados[0].ativa === true;
      } else if (dados.ativo) {
        const publicada = plano.versaoPublicadaAtualId ? await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
          where: { tenantId, planoId, id: plano.versaoPublicadaAtualId, descartadaEm: IsNull() },
          lock: { mode: 'pessimistic_read' }
        }) : null;
        if (!publicada?.publicadaEm) throw new ConflictException('Publique uma versão salva antes de ativar o plano.');
      }
      if (estadoAtual === dados.ativo && (identidadeRefeicaoId || plano.ativacaoDefinida)) {
        return { planoId, ativoParaPaciente: plano.ativoParaPaciente === true,
          ativacaoRevisao: plano.ativacaoRevisao ?? 0,
          ...(identidadeRefeicaoId ? { identidadeRefeicaoId, ativa: estadoAtual } : {}) };
      }
      if (identidadeRefeicaoId) {
        await gerenciador.query('update plano_alimentar_refeicao_estados set ativa=$4 where tenant_id=$1 and plano_id=$2 and id=$3',
          [tenantId, planoId, identidadeRefeicaoId, dados.ativo]);
      } else {
        plano.ativoParaPaciente = dados.ativo;
        plano.ativacaoDefinida = true;
      }
      plano.ativacaoRevisao = (plano.ativacaoRevisao ?? 0) + 1;
      await gerenciador.getRepository(PlanoAlimentarOrm).save(plano);
      await gerenciador.query(`insert into plano_alimentar_ativacao_eventos
        (tenant_id,plano_id,revisao,usuario_id,refeicao_identidade_id,ativo) values($1,$2,$3,$4,$5,$6)`,
      [tenantId, planoId, plano.ativacaoRevisao, usuario.usuarioId, identidadeRefeicaoId ?? null, dados.ativo]);
      return { planoId, ativoParaPaciente: plano.ativoParaPaciente === true, ativacaoRevisao: plano.ativacaoRevisao,
        ...(identidadeRefeicaoId ? { identidadeRefeicaoId, ativa: dados.ativo } : {}) };
    });
  }

  async publicar(tenantId: string, pacienteId: string, planoId: string, usuario: UsuarioAutenticado, dados: PrecondicaoEdicaoPlanoDto = {}) {
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
      this.conferirRevisaoEdicao(rascunho, dados);
      if (!rascunho.revisadaEm || !rascunho.revisadaPorUsuarioId) {
        throw new ConflictException('Revise o plano alimentar antes de publica-lo.');
      }
      this.garantirApresentacaoDisponivel(rascunho);
      this.garantirRascunhoCompleto(rascunho);
      this.garantirEquivalenciasRevisadas(rascunho);
      const conteudo = await this.montarVersao(gerenciador, rascunho);
      if (!conteudo.refeicoes.length || conteudo.refeicoes.some((refeicao) => !refeicao.itens.length)) {
        throw new BadRequestException('Plano alimentar precisa de refeicoes preenchidas para publicacao.');
      }

      rascunho.hashConteudo = createHash('sha256')
        .update(this.serializarEstavel(this.conteudoClinicoParaHash(plano, conteudo)))
        .digest('hex');
      rascunho.publicadaEm = new Date();
      rascunho.edicaoProtegida = rascunho.edicaoProtegida || dados.rascunhoRevisaoEsperada !== undefined;
      this.avancarRevisaoEdicao(rascunho);
      rascunho.edicaoMaterializadaRevisao = rascunho.rascunhoRevisao;
      await gerenciador.getRepository(PlanoAlimentarVersaoOrm).save(rascunho);
      // Primeira publicação conserva o fluxo legado. Uma decisão OFF explícita
      // (inclusive anterior à publicação) nunca é sobrescrita por esta transição.
      const ativacaoInicial = !plano.ativacaoDefinida;
      if (ativacaoInicial) {
        if ((plano.ativacaoRevisao ?? 0) >= 2147483647) throw new ConflictException('Limite de revisão operacional atingido.');
        plano.ativoParaPaciente = true;
        plano.ativacaoDefinida = true;
        plano.ativacaoRevisao = (plano.ativacaoRevisao ?? 0) + 1;
      }
      plano.versaoPublicadaAtualId = rascunho.id;
      await repositorioPlano.save(plano);
      if (ativacaoInicial) await gerenciador.query(`insert into plano_alimentar_ativacao_eventos
        (tenant_id,plano_id,revisao,usuario_id,refeicao_identidade_id,ativo) values($1,$2,$3,$4,$5,$6)`,
        [tenantId,planoId,plano.ativacaoRevisao,usuario.usuarioId,null,true]);

      // Escrita direta, e nao `ServicoAuditoria.registrar`: estamos dentro do
      // `executorTenant.executar` que segura `pessimistic_write` sobre o plano
      // e sobre a versao. Ver `registrarAuditoriaNaTransacao`.
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'planos_alimentares.publicar',
        recursoTipo: 'plano_alimentar',
        recursoId: plano.id,
        metadados: {
          pacienteId,
          versaoId: rascunho.id,
          numeroVersao: rascunho.numero,
          // `hashConteudo` e sha256 do conteudo clinico da versao. Ele nao
          // acrescenta evidencia -- `versaoId` ao lado ja identifica o
          // artefato --, e acrescenta um oraculo de confirmacao: quem le a
          // trilha e suspeita de uma dieta especifica pode testar a hipotese
          // sem ter acesso ao plano. Fica de fora; o redator o cobriria de
          // qualquer forma, e gravar para ser redigido e so ruido.
          possuiHashConteudo: Boolean(rascunho.hashConteudo)
        }
      });
      await registrarAvisoPlanoPublicado(gerenciador, this.criptografia, {
        tenantId,
        pacienteId,
        planoId: plano.id,
        versaoId: rascunho.id
      });
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
      this.garantirApresentacaoDisponivel(publicada);
      // FOOD05 conserva as chaves editoriais que vinculam os snapshots; filhos
      // físicos continuam recebendo novos IDs. Sem isso, um PATCH legado apagaria
      // a proveniência herdada. Não alterar a reconstrução dos planos legados.
      const historicoEquivalencias = await this.montarVersao(gerenciador, publicada, true);
      const herdaEquivalencias = Object.keys(historicoEquivalencias.equivalenciasAplicadas ?? {}).length > 0;
      if (herdaEquivalencias) {
        const contextos = this.lerContextosEquivalencias(publicada);
        if (!Object.keys(contextos).length || !publicada.edicaoSnapshotCriptografado) {
          throw new ConflictException('Contexto editorial da equivalência indisponível para nova versão.');
        }
      }
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
          apresentacaoSnapshotCriptografado: this.copiarBuffer(publicada.apresentacaoSnapshotCriptografado ?? undefined),
          // Zero identifica exclusivamente ausência legada, nunca snapshot já herdado.
          apresentacaoRevisao: publicada.apresentacaoSnapshotCriptografado ? 1 : 0,
          identidadesRefeicoesCriptografadas: this.copiarBuffer(publicada.identidadesRefeicoesCriptografadas ?? undefined),
          ...(herdaEquivalencias ? {
            edicaoSnapshotCriptografado: this.copiarBuffer(publicada.edicaoSnapshotCriptografado!),
            alimentosPersonalizadosSnapshotCriptografado: this.copiarBuffer(publicada.alimentosPersonalizadosSnapshotCriptografado ?? undefined),
            medidasCaseirasSnapshotCriptografado: this.copiarBuffer(publicada.medidasCaseirasSnapshotCriptografado ?? undefined),
            rascunhoRevisao: 0, edicaoMaterializadaRevisao: 0, edicaoProtegida: true
          } : {}),
          totaisSnapshotCriptografado: this.copiarBuffer(publicada.totaisSnapshotCriptografado)
        })
      );
      await this.clonarFilhos(gerenciador, tenantId, publicada.id, nova.id);
      return this.montarVersao(gerenciador, nova, true);
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
      // Mesma transacao em curso do arquivamento; ver `registrarAuditoriaNaTransacao`.
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'planos_alimentares.arquivar',
        recursoTipo: 'plano_alimentar',
        recursoId: plano.id,
        metadados: { pacienteId }
      });
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
      const profissionalId = usuario.papel === 'Professional'
        ? await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
        : undefined;
      const repoAlimentos = gerenciador.getRepository(AlimentoComposicaoOrm);
      const consultaAlimentos = repoAlimentos.createQueryBuilder('alimento')
        .where("lower(alimento.nome) like lower(:busca) escape '\\'", { busca: `%${escaparCuringaLike(termo)}%` })
        .andWhere('alimento.fonte_id in (:...fonteIds)', { fonteIds: [...fontePorId.keys()] });
      const podeOrdenarFavoritos = Boolean(profissionalId && typeof consultaAlimentos.leftJoin === 'function');
      if (podeOrdenarFavoritos) {
        consultaAlimentos.leftJoin(FavoritoAlimentoOrm, 'favorito',
          'favorito.alimento_composicao_id=alimento.id AND favorito.tenant_id=:tenantId AND favorito.profissional_id=:profissionalId',
          { tenantId, profissionalId })
          .addSelect('CASE WHEN favorito.id IS NULL THEN 1 ELSE 0 END', 'ordem_favorito')
          .orderBy('ordem_favorito', 'ASC');
      }
      const consultaOrdenada = podeOrdenarFavoritos
        ? consultaAlimentos.addOrderBy('alimento.nome', 'ASC')
        : consultaAlimentos.orderBy('alimento.nome', 'ASC');
      const [alimentos, total] = await consultaOrdenada
        // `nome` nao e unico: sem desempate o OFFSET repete ou pula alimento.
        .addOrderBy('alimento.id', 'ASC')
        .skip((pagina - 1) * limite)
        .take(limite)
        .getManyAndCount();
      const favoritoRepo = gerenciador.getRepository(FavoritoAlimentoOrm);
      const favoritos = podeOrdenarFavoritos && profissionalId && alimentos.length && typeof favoritoRepo.find === 'function'
        ? new Set((await favoritoRepo.find({
            where: { tenantId, profissionalId, alimentoComposicaoId: In(alimentos.map((alimento) => alimento.id)) }
          })).map((favorito) => favorito.alimentoComposicaoId))
        : new Set<string>();
      const itens = alimentos.filter((alimento) => fontePorId.has(alimento.fonteId)).map((alimento) => ({
        id: alimento.id,
        codigoOrigem: alimento.codigoOrigem,
        nome: alimento.nome,
        preparacao: alimento.preparacao,
        metadadosOrigem: alimento.micronutrientes?.metadadosOrigem ?? {},
        nutrientesPor100g: this.obterNutrientesCatalogo(alimento, false),
        disponivelParaCalculo: this.composicaoEssencialCatalogoCompleta(alimento),
        ...(podeOrdenarFavoritos ? { favorito: favoritos.has(alimento.id) } : {}),
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
    bloquear: boolean | 'pessimistic_read' = false
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
      ...(bloquear ? { lock: { mode: bloquear === 'pessimistic_read' ? 'pessimistic_read' as const : 'pessimistic_write' as const } } : {})
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
    bloquear: boolean | 'pessimistic_read' = false
  ): Promise<PlanoAlimentarOrm> {
    await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario, bloquear);
    const plano = await gerenciador.getRepository(PlanoAlimentarOrm).findOne({
      where: { id: planoId, tenantId, pacienteId, arquivadoEm: IsNull() },
      ...(bloquear ? { lock: { mode: bloquear === 'pessimistic_read' ? 'pessimistic_read' as const : 'pessimistic_write' as const } } : {})
    });
    if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');
    return plano;
  }

  private async obterRascunhoAtivo(gerenciador: EntityManager, tenantId: string, planoId: string, bloquear = false) {
    const rascunho = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
      where: { tenantId, planoId, publicadaEm: IsNull(), descartadaEm: IsNull() },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
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
    dados: AtualizarRascunhoPlanoAlimentarDto,
    composicoesCustom?: ReadonlyMap<object, ComposicaoPersonalizada>, provenienciasGrupo?: ReadonlyMap<object,OrigemGrupoSnapshot>, composicoesCatalogoGrupo?: ReadonlyMap<object, SnapshotComposicao>, materiaisEquivalencia?: ReadonlyMap<object,{contexto:ContextoEquivalencia;fatos:FatosComposicaoEquivalencia}>
  ): Promise<EstruturaPlanoAlimentar> {
    const refeicoes = [];
    for (const refeicao of dados.refeicoes) {
      const itens: ItemPlanoAlimentar[] = [];
      for (const itemEntrada of refeicao.itens) {
        const item = await this.resolverItem(gerenciador, itemEntrada, composicoesCustom?.get(itemEntrada), composicoesCatalogoGrupo?.get(itemEntrada));
        const substituicoes = [];
        for (const substituicaoEntrada of itemEntrada.substituicoes ?? []) {
          const substituicao = await this.resolverItem(gerenciador, substituicaoEntrada, composicoesCustom?.get(substituicaoEntrada), composicoesCatalogoGrupo?.get(substituicaoEntrada), materiaisEquivalencia?.get(substituicaoEntrada));
          const origemGrupo=provenienciasGrupo?.get(substituicaoEntrada);
          if(origemGrupo)substituicao.snapshot.origemGrupo=origemGrupo;
          substituicoes.push({
            ...substituicao.dominio,
            snapshot: substituicao.snapshot,
            // Exposicao ao paciente e decisao explicita: a ausencia nunca vira um sim.
            liberadaParaPaciente: substituicaoEntrada.liberadaParaPaciente === true,
            preferida: substituicaoEntrada.preferida === true
          });
        }
        itens.push({
          ...item.dominio,
          substituicoes,
          substituicoesVisiveisInicialmente: itemEntrada.substituicoesVisiveisInicialmente
        } as ItemPlanoAlimentar);
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
    entrada: SubstituicaoPlanoAlimentarDto,
    custom?: ComposicaoPersonalizada,
    catalogoGrupo?: SnapshotComposicao, equivalencia?: {contexto:ContextoEquivalencia;fatos:FatosComposicaoEquivalencia}
  ): Promise<ItemResolvido> {
    let descricao: string;
    let micros: ValoresMicronutrientesOrigem = {};
    let baseMicros = 100;
    let nutrientesPor100g: NutrientesPor100gPlano;
    let snapshotBase: Omit<SnapshotComposicao, 'nutrientesPor100g' | 'nutrientesPorcao'>;
    if (catalogoGrupo) {
      if (custom || catalogoGrupo.origem !== 'catalogo' || entrada.alimentoComposicaoId !== catalogoGrupo.alimentoComposicaoId || !catalogoGrupo.fonte) throw new BadRequestException('Snapshot de catálogo incompatível.');
      descricao = catalogoGrupo.descricao;
      nutrientesPor100g = this.validarNutrientesManuais(catalogoGrupo.nutrientesPor100g);
      if (catalogoGrupo.micronutrientes) {
        baseMicros = catalogoGrupo.micronutrientes.baseGramasOrigem;
        micros = Object.fromEntries(Object.entries(catalogoGrupo.micronutrientes.nutrientes).map(([k,v]) => [k,{estado:v.estado,...(v.valorOrigem !== undefined ? {valor:v.valorOrigem} : {})}]));
      }
      snapshotBase = { origem: 'catalogo', alimentoComposicaoId: catalogoGrupo.alimentoComposicaoId, codigoOrigem: catalogoGrupo.codigoOrigem,
        descricao, preparacao: catalogoGrupo.preparacao, fonte: catalogoGrupo.fonte };
    } else if (custom) {
      if (entrada.alimentoComposicaoId) throw new BadRequestException('Origem do alimento ambígua.');
      descricao = custom.nome;
      nutrientesPor100g = this.validarNutrientesManuais(custom.nutrientesPor100g as NutrientesPor100gDto);
      micros = Object.fromEntries(Object.entries(custom.composicaoOrigem.micronutrientes).map(([k, valor]) => [k, { estado: 'conhecido', valor }]));
      baseMicros = custom.baseOrigem.pesoGramas;
      snapshotBase = { origem: 'custom', descricao, preparacao: custom.preparacao,
        composicaoInformada: { baseGramas: custom.baseOrigem.pesoGramas, nutrientes: custom.composicaoOrigem.nutrientes, micronutrientes: custom.composicaoOrigem.micronutrientes, normalizacaoVersao: custom.normalizacaoVersao, referencia: custom.referenciaComposicao } };
    } else if (entrada.alimentoComposicaoId) {
      const alimento = await gerenciador.getRepository(AlimentoComposicaoOrm).findOne({
        where: { id: entrada.alimentoComposicaoId }
      });
      if (!alimento) throw new BadRequestException('Alimento do catalogo nao encontrado.');
      if (entrada.micronutrientesPor100g !== undefined) throw new BadRequestException('Micronutrientes de catálogo não aceitam alteração manual.');
      nutrientesPor100g = this.obterNutrientesCatalogo(alimento, true)!;
      const fonte = await gerenciador.getRepository(FonteComposicaoAlimentoOrm).findOne({
        where: { id: alimento.fonteId, situacao: 'ativa' }
      });
      if (!fonte) throw new BadRequestException('Fonte do alimento nao esta ativa para uso clinico.');
      descricao = alimento.nome;
      micros = extrairMicronutrientesFonte(fonte.codigo, fonte.esquemaVersao ?? '', alimento.micronutrientes);
      baseMicros = Number(alimento.baseGramas);
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
      if (entrada.micronutrientesPor100g !== undefined) {
        try { micros = Object.fromEntries(Object.entries(validarMicronutrientesManuais(entrada.micronutrientesPor100g)).map(([codigo, valor]) => [codigo, { estado: 'conhecido', valor }])); }
        catch { throw new BadRequestException('Micronutrientes manuais inválidos.'); }
      }
      snapshotBase = { origem: 'manual', descricao };
    }
    let nutrientesPorcao: SubstituicaoPlanoAlimentar['nutrientes'];
    let micronutrientes: SnapshotMicronutrientesV1 | undefined;
    try {
      if(equivalencia){
        const f=equivalencia.fatos;
        const canonico=normalizarComposicaoDecimal({nutrientes:f.nutrientes,baseGramas:f.baseGramas});
        nutrientesPor100g={...nutrientesPor100g,...Object.fromEntries(Object.entries(canonico).map(([k,v])=>[k,Number(v)]))};
        nutrientesPorcao={...this.calcularNutrientesPorcao(nutrientesPor100g,entrada.porcaoGramas),...Object.fromEntries(Object.entries(calcularNutrientesDaPorcaoDecimal(f.nutrientes,f.baseGramas,String(entrada.porcaoGramas))).map(([k,v])=>[k,Number(v)]))};
      }else nutrientesPorcao = this.calcularNutrientesPorcao(nutrientesPor100g, entrada.porcaoGramas);
      if (Object.keys(micros).length) micronutrientes = criarSnapshotMicronutrientes(micros, baseMicros, entrada.porcaoGramas);
    } catch (erro) {
      if (erro instanceof LimitePrecisaoNutricionalError) throw new UnprocessableEntityException('Limite técnico de precisão nutricional excedido.');
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
      snapshot: { ...snapshotBase, nutrientesPor100g, nutrientesPorcao, ...(micronutrientes ? { micronutrientes } : {}), ...(equivalencia?{equivalencia:equivalencia.contexto}:{}) }
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

  private identidadesAtuaisEdicao(versao: PlanoAlimentarVersaoOrm): Array<{chaveCliente:string;identidadeId:string}> {
    if (versao.publicadaEm || versao.descartadaEm || !versao.edicaoSnapshotCriptografado || !versao.identidadesRefeicoesCriptografadas ||
        versao.identidadesRefeicoesCriptografadas.length > 1024*1024+64) return [];
    try {
      const documento = this.lerEdicao(versao).documentoEdicao;
      if (!documento) return [];
      const aliases = new Map(lerIdentidadesRefeicoes(this.criptografia.descriptografar(versao.identidadesRefeicoesCriptografadas)));
      return documento.refeicoes.flatMap(r => {
        const identidadeId=aliases.get(r.chaveCliente);
        return identidadeId ? [{chaveCliente:r.chaveCliente,identidadeId}] : [];
      });
    } catch { return []; }
  }

  private async prepararIdentidadesEdicao(
    gerenciador: EntityManager, plano: PlanoAlimentarOrm, versao: PlanoAlimentarVersaoOrm, documento: DocumentoEdicaoPlano
  ): Promise<string[]> {
    const linhas: Array<{ refeicao_id: string; identidade_id: string }> = await gerenciador.query(`
      select l.refeicao_id,l.identidade_id from plano_alimentar_refeicao_vinculos l
      join plano_alimentar_refeicoes r on r.tenant_id=l.tenant_id and r.id=l.refeicao_id and r.versao_id=l.versao_id
      where l.tenant_id=$1 and l.plano_id=$2 and l.versao_id=$3 order by r.ordem`,
    [plano.tenantId, plano.id, versao.id]);
    let identidadesPreparadas: string[];
    try {
      if (versao.identidadesRefeicoesCriptografadas && versao.identidadesRefeicoesCriptografadas.length > 1024 * 1024 + 64) throw new Error('Limite de identidades.');
      let aliases: AliasIdentidadeRefeicao[] = versao.identidadesRefeicoesCriptografadas
        ? lerIdentidadesRefeicoes(this.criptografia.descriptografar(versao.identidadesRefeicoesCriptografadas)) : [];
      if (!versao.identidadesRefeicoesCriptografadas && versao.edicaoSnapshotCriptografado) {
        // Vínculo posicional SOMENTE entre o documento e sua própria materialização
        // da mesma revisão. Nunca associa versões diferentes por ordem ou nome.
        const anterior = this.lerEdicao(versao);
        if (anterior.edicaoEstado === 'materializada' && anterior.documentoEdicao?.refeicoes.length === linhas.length) {
          aliases = linhas.map((l,i) => [anterior.documentoEdicao!.refeicoes[i].chaveCliente,l.identidade_id]);
        } else if ((plano.ativacaoRevisao ?? 0) > 0) {
          throw new Error('Legado ambíguo após decisão operacional.');
        }
      }
      const mapa = new Map(aliases);
      // Formulário legado e clone usam o UUID físico como chave editorial.
      if (!versao.edicaoSnapshotCriptografado) {
        for (const l of linhas) if (!mapa.has(l.refeicao_id)) mapa.set(l.refeicao_id,l.identidade_id);
      }
      const preparados = prepararIdentidadesRefeicoes(documento.refeicoes.map(r => r.chaveCliente), Array.from(mapa), randomUUID);
      versao.identidadesRefeicoesCriptografadas = this.criptografia.criptografar(JSON.stringify({schemaVersao: 1, aliases: preparados.aliases}));
      identidadesPreparadas = preparados.identidades;
    } catch {
      throw new ConflictException('Identidades das refeições precisam de reconferência. Recarregue o plano.');
    }
    if (identidadesPreparadas.length) await gerenciador.query(`insert into plano_alimentar_refeicao_estados(id,tenant_id,plano_id)
      select identidade,$1::uuid,$2::uuid from unnest($3::uuid[]) as novas(identidade)
      on conflict(tenant_id,plano_id,id) do nothing`, [plano.tenantId,plano.id,identidadesPreparadas]);
    return identidadesPreparadas;
  }

  private async comIdentidadeRefeicao<T>(gerenciador: EntityManager, identidade: string | undefined, operacao: () => Promise<T>): Promise<T> {
    const anterior: Array<{ identidade: string | null }> = await gerenciador.query(
      "select current_setting('app.refeicao_identidade_id',true) as identidade");
    await gerenciador.query("select set_config('app.refeicao_identidade_id',$1,true)", [identidade ?? '']);
    const restaurar = () => gerenciador.query("select set_config('app.refeicao_identidade_id',$1,true)", [anterior[0]?.identidade ?? '']);
    let resultado: T;
    try { resultado = await operacao(); }
    catch (erro) {
      // PostgreSQL abortado rejeita restauração; rollback limpa o GUC local.
      await restaurar().catch(() => undefined);
      throw erro;
    }
    await restaurar();
    return resultado;
  }

  private async substituirFilhos(
    gerenciador: EntityManager,
    tenantId: string,
    versaoId: string,
    estrutura: EstruturaPlanoAlimentar,
    identidades?: string[]
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
      const refeicaoSalva = await this.comIdentidadeRefeicao(gerenciador, identidades?.[ordemRefeicao], () => repositorioRefeicao.save(
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
      ));
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
            motorCalculoVersao: MOTOR_CALCULO_VERSAO,
            substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente
          })
        );
        for (const [ordemSubstituicao, substituicao] of item.substituicoes.entries()) {
          const snapshotSubstituicao = (
            substituicao as AlternativaPlanoAlimentar & { snapshot: SnapshotComposicao }
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
              motorCalculoVersao: snapshotSubstituicao.equivalencia ? POLITICA_NUTRICAO_DECIMAL : MOTOR_CALCULO_VERSAO,
              // Exposicao ao paciente e decisao explicita: a ausencia nunca vira um sim.
              liberadaParaPaciente: substituicao.liberadaParaPaciente === true,
              preferida: substituicao.preferida === true
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
      const vinculos: Array<{ identidade_id: string }> = await gerenciador.query(
        'select identidade_id from plano_alimentar_refeicao_vinculos where tenant_id=$1 and versao_id=$2 and refeicao_id=$3',
        [tenantId, origemVersaoId, refeicao.id]);
      if (vinculos.length !== 1) throw new ConflictException('Identidade da refeição de origem indisponível.');
      const novaRefeicao = await this.comIdentidadeRefeicao(gerenciador, vinculos[0].identidade_id, () => repositorioRefeicao.save(
        repositorioRefeicao.create({
          tenantId,
          versaoId: destinoVersaoId,
          ordem: refeicao.ordem,
          nomeCriptografado: Buffer.from(refeicao.nomeCriptografado),
          horarioLocal: refeicao.horarioLocal,
          orientacoesCriptografadas: this.copiarBuffer(refeicao.orientacoesCriptografadas)
        })
      ));
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
            motorCalculoVersao: item.motorCalculoVersao,
            substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente
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
              motorCalculoVersao: substituicao.motorCalculoVersao,
              liberadaParaPaciente: substituicao.liberadaParaPaciente,
              preferida: substituicao.preferida
            })
          );
        }
      }
    }
  }

  private conferirRevisaoEdicao(
    rascunho: PlanoAlimentarVersaoOrm,
    dados: { rascunhoIdEsperado?: string; rascunhoRevisaoEsperada?: number }
  ): void {
    const revisao = dados.rascunhoRevisaoEsperada;
    if (rascunho.edicaoProtegida && revisao === undefined) {
      throw new ConflictException('Este rascunho exige a revisão atual de edição. Atualize o editor antes de continuar.');
    }
    if (revisao !== undefined) {
      if (!Number.isSafeInteger(revisao) || revisao < 0 || revisao >= 2147483647 || !dados.rascunhoIdEsperado) {
        throw new BadRequestException('Informe a identidade e a revisão do rascunho.');
      }
      if (dados.rascunhoIdEsperado !== rascunho.id || revisao !== (rascunho.rascunhoRevisao ?? 0)) {
        throw new ConflictException('O rascunho foi alterado. Confira a versão salva antes de continuar.');
      }
    }
    if ((rascunho.rascunhoRevisao ?? 0) >= 2147483647) {
      throw new ConflictException('O rascunho atingiu o limite de revisões de edição.');
    }
  }

  private avancarRevisaoEdicao(rascunho: PlanoAlimentarVersaoOrm): void {
    const anterior = rascunho.rascunhoRevisao ?? 0;
    rascunho.rascunhoRevisao = anterior + 1;
    if (rascunho.edicaoMaterializadaRevisao === anterior) rascunho.edicaoMaterializadaRevisao = rascunho.rascunhoRevisao;
  }

  private garantirRascunhoCompleto(rascunho: PlanoAlimentarVersaoOrm): void {
    const estado = this.lerEdicao(rascunho).edicaoEstado;
    if (estado === 'pendente' || estado === 'indisponivel') {
      throw new ConflictException('A edição mais recente está pendente ou indisponível. Complete e salve antes de revisar ou publicar.');
    }
    if (
      !rascunho.avaliacaoAntropometricaId ||
      !rascunho.motorCalculoVersao ||
      !rascunho.objetivosCriptografados ||
      !rascunho.calculoSnapshotCriptografado ||
      !rascunho.totaisSnapshotCriptografado
    ) {
      throw new BadRequestException('Complete o calculo e o conteudo do rascunho antes de continuar.');
    }
    const calculo = this.lerJsonCriptografado<{
      origemMeta?: OrigemMetaPlano;
      metodoMacrosManual?: MetodoMacrosManual;
      possuiCondicaoEspecial?: boolean;
      justificativaCondicaoEspecial?: unknown;
      aplicabilidadeFormulaConfirmada?: boolean;
      alertasDivergenciaClinica?: unknown;
      justificativaDivergenciaClinica?: unknown;
    }>(rascunho.calculoSnapshotCriptografado);
    const metaManual = calculo.origemMeta === 'manual';
    // A trava continua valendo para o caminho automatico; o manual e a saida.
    if (calculo.possuiCondicaoEspecial !== metaManual) {
      throw new BadRequestException(
        'Plano com condicao especial exige meta manual; meta manual exige condicao especial declarada.'
      );
    }
    if (metaManual) {
      const justificativa =
        typeof calculo.justificativaCondicaoEspecial === 'string'
          ? calculo.justificativaCondicaoEspecial.trim()
          : '';
      if (!justificativa) {
        throw new BadRequestException('A condicao especial precisa de justificativa clinica registrada.');
      }
      if (!calculo.metodoMacrosManual) {
        throw new BadRequestException('Registre como os macronutrientes manuais foram definidos.');
      }
    } else {
      if (!rascunho.formulaCodigo || !rascunho.formulaVersao) {
        throw new BadRequestException('Complete o calculo e o conteudo do rascunho antes de continuar.');
      }
      if (calculo.aplicabilidadeFormulaConfirmada !== true) {
        throw new BadRequestException('A aplicabilidade da formula precisa estar explicitamente confirmada.');
      }
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
      versoesEmDetalhe.map((versao) => this.montarVersao(gerenciador, versao, true))
    );
    return {
      ativoParaPaciente: plano.ativoParaPaciente === true,
      ativacaoRevisao: plano.ativacaoRevisao ?? 0,
      id: plano.id,
      pacienteId: plano.pacienteId,
      profissionalId: plano.profissionalId,
      titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
      arquivadoEm: plano.arquivadoEm,
      criadoEm: plano.criadoEm,
      atualizadoEm: plano.atualizadoEm,
      resumoNutricionalVigente: plano.ativoParaPaciente === true
        ? detalhes.find(v => v.id === plano.versaoPublicadaAtualId)?.resumoRefeicoesAtivas ?? {estado: 'indisponivel' as const}
        : resumirNutrientesItensEfetivos([]),
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

  private montarResumoPlano(
    plano: PlanoAlimentarOrm,
    versoes: PlanoAlimentarVersaoOrm[],
    resumoPorVersao: Map<string, ResumoNutricionalPlano>,
    historicoQuantidade: number
  ) {
    const resumos = versoes.map((versao) => ({
      ...this.montarResumoVersao(versao),
      resumoNutricional: resumoPorVersao.get(versao.id) ?? projetarResumoNutricionalPlano(undefined)
    }));
    return {
      ativoParaPaciente: plano.ativoParaPaciente === true,
      ativacaoRevisao: plano.ativacaoRevisao ?? 0,
      id: plano.id,
      pacienteId: plano.pacienteId,
      profissionalId: plano.profissionalId,
      titulo: this.criptografia.descriptografar(plano.tituloCriptografado),
      criadoEm: plano.criadoEm,
      atualizadoEm: plano.atualizadoEm,
      current: resumos.find((versao) => versao.id === plano.versaoPublicadaAtualId),
      draft: resumos.find((versao) => versao.status === 'rascunho'),
      historicoQuantidade
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

  private lerValorDiario(diario: LogDiarioRapidoOrm): {
    valor: Record<string, unknown>;
    dadoIndisponivel: boolean;
  } {
    if (!diario.valorCriptografado) return { valor: diario.valor ?? {}, dadoIndisponivel: false };
    try {
      return {
        valor: JSON.parse(this.criptografia.descriptografar(diario.valorCriptografado)) as Record<string, unknown>,
        dadoIndisponivel: false
      };
    } catch {
      return { valor: {}, dadoIndisponivel: true };
    }
  }

  private async montarVersao(gerenciador: EntityManager, versao: PlanoAlimentarVersaoOrm, incluirEquivalencias=false) {
    // Todos os callers já mantêm o lock de escopo. A revisão acompanha o ACK
    // editorial para o cliente não aplicar flags anteriores a um toggle posterior.
    const planoOperacional = await gerenciador.getRepository(PlanoAlimentarOrm).findOne({
      where:{tenantId:versao.tenantId,id:versao.planoId}
    });
    if (!planoOperacional) throw new NotFoundException('Plano alimentar nao encontrado.');
    // Resultado publicado/descartado usa exclusivamente sua materialização imutável.
    const edicao = versao.publicadaEm || versao.descartadaEm ? { edicaoEstado: 'legado' as const } : this.lerEdicao(versao);
    const calculoAtual = edicao.edicaoEstado !== 'pendente' && edicao.edicaoEstado !== 'indisponivel';
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
    const identidadesEdicao = this.identidadesAtuaisEdicao(versao);
    const estadosEdicao: Array<{id:string;ativa:boolean}> = identidadesEdicao.length ? await gerenciador.query(
      'select id,ativa from plano_alimentar_refeicao_estados where tenant_id=$1 and plano_id=$2 and id=any($3::uuid[])',
      [versao.tenantId,versao.planoId,identidadesEdicao.map(r=>r.identidadeId)]) : [];
    const estados = await lerEstadosRefeicoes(gerenciador,versao.tenantId,versao.planoId,versao.id);
    const ativas = new Set(estados.filter(e => e.ativa === true).map(e => e.refeicao_id));
    let resumoRefeicoesAtivas: ResumoNutricionalPlano = {estado: 'indisponivel'};
    if (calculoAtual && refeicoes.every(r => estados.some(e => e.refeicao_id === r.id))) {
      resumoRefeicoesAtivas = resumirNutrientesItensEfetivos(itens.filter(i => ativas.has(i.refeicaoId)).map(i => {
        try { return this.lerJsonCriptografado<SnapshotComposicao>(i.composicaoSnapshotCriptografada).nutrientesPorcao; }
        catch { return undefined; }
      }));
    }
    let equivalenciasProfissionais:ReturnType<typeof projetarEquivalenciasProfissional>|undefined;
    let equivalenciasEstado:'disponivel'|'indisponivel'='disponivel';
    if(incluirEquivalencias){
      try{
        let contextos:ContextosEquivalencias;
        if(versao.publicadaEm||versao.descartadaEm){
          contextos=Object.create(null);
          for(const linha of substituicoes){const snapshot=this.lerJsonCriptografado<SnapshotComposicao>(linha.composicaoSnapshotCriptografada);const c=snapshot.equivalencia;if(c){if(Object.hasOwn(contextos,c.alternativaChave))throw new ConflictException('Referência duplicada.');contextos[c.alternativaChave]=c;}}
          contextos=validarContextosEquivalencias(contextos);
        }else{if(edicao.edicaoEstado==='indisponivel')throw new ConflictException('Edição indisponível.');contextos=this.lerContextosEquivalencias(versao);}
        equivalenciasProfissionais=projetarEquivalenciasProfissional(contextos);
      }catch{equivalenciasEstado='indisponivel';}
    }
    return {
      ativoParaPaciente: planoOperacional.ativoParaPaciente === true,
      ativacaoRevisao: planoOperacional.ativacaoRevisao ?? 0,
      ...(!versao.publicadaEm && !versao.descartadaEm ? {ativacaoEdicao:identidadesEdicao.flatMap(r=>{
        const estado=estadosEdicao.find(e=>e.id===r.identidadeId);
        return estado ? [{...r,ativa:estado.ativa === true}] : [];
      })} : {}),
      // Projeção operacional atual, separada de totais/hash históricos.
      ativacaoRefeicoes: estados.map(e => ({refeicaoId:e.refeicao_id,identidadeId:e.identidade_id,ativa:e.ativa === true})),
      resumoRefeicoesAtivas,
      id: versao.id,
      numero: versao.numero,
      status: versao.publicadaEm ? ('publicada' as const) : versao.descartadaEm ? ('descartada' as const) : ('rascunho' as const),
      avaliacaoAntropometricaId: calculoAtual ? versao.avaliacaoAntropometricaId : undefined,
      formulaCodigo: calculoAtual ? versao.formulaCodigo : undefined,
      formulaVersao: calculoAtual ? versao.formulaVersao : undefined,
      motorCalculoVersao: calculoAtual ? versao.motorCalculoVersao : undefined,
      objetivos: calculoAtual ? this.descriptografarOpcional(versao.objetivosCriptografados) : undefined,
      observacoes: calculoAtual ? this.descriptografarOpcional(versao.observacoesCriptografadas) : undefined,
      calculo: calculoAtual ? this.lerJsonCriptografadoOpcional(versao.calculoSnapshotCriptografado) : undefined,
      totais: calculoAtual ? this.lerJsonCriptografadoOpcional(versao.totaisSnapshotCriptografado) : undefined,
      ...this.lerApresentacao(versao),
      rascunhoRevisao: versao.rascunhoRevisao ?? 0,
      ...(!versao.publicadaEm && !versao.descartadaEm ? edicao : {}),
      ...(!versao.publicadaEm && !versao.descartadaEm && versao.medidasCaseirasSnapshotCriptografado ? {
        medidasCaseirasAplicadas: Object.fromEntries(Object.entries(this.lerContextosMedidas(versao)).map(([chave, contexto]) => [chave, {
          nome: contexto.referencia.nome,
          quantidadeReferencia: contexto.referencia.quantidadeReferencia,
          pesoReferenciaGramas: contexto.referencia.pesoReferenciaGramas
        }]))
      } : {}),
      ...(!versao.publicadaEm && !versao.descartadaEm && versao.alimentosPersonalizadosSnapshotCriptografado ? {
        alimentosPersonalizadosAplicados: Object.fromEntries(Object.entries(this.lerContextosCustom(versao)).map(([chave, contexto]) => {
          const c = contexto.composicao;
          return [chave, { nome: c.nome, preparacao: c.preparacao, referenciaComposicao: c.referenciaComposicao, baseOrigem: c.baseOrigem,
            composicaoOrigem: c.composicaoOrigem, nutrientesPor100g: c.nutrientesPor100g, micronutrientesPor100g: c.micronutrientesPor100g, normalizacaoVersao: c.normalizacaoVersao }];
        }))
      } : {}),
      ...(incluirEquivalencias?{equivalenciasAplicadas:equivalenciasProfissionais,equivalenciasEstado}:{}),
      hashConteudo: versao.hashConteudo,
      revisadaEm: versao.revisadaEm,
      revisadaPorUsuarioId: versao.revisadaPorUsuarioId,
      publicadaEm: versao.publicadaEm,
      descartadaEm: versao.descartadaEm,
      criadoEm: versao.criadoEm,
      atualizadoEm: versao.atualizadoEm,
      refeicoes: (calculoAtual ? refeicoes : []).map((refeicao) => ({
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
            composicaoSnapshot: projetarComposicao(this.lerJsonCriptografado<SnapshotComposicao>(item.composicaoSnapshotCriptografada)),
            substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente,
            substituicoes: substituicoes
              .filter((substituicao) => substituicao.itemId === item.id)
              .sort((a, b) => a.ordem - b.ordem)
              .map((substituicao) => {
                const snapshot = this.lerJsonCriptografado<SnapshotComposicao>(
                  substituicao.composicaoSnapshotCriptografada
                );
                const equivalenciaAtiva = snapshot.equivalencia?.estado !== undefined
                  && snapshot.equivalencia.estado !== 'desvinculada_manualmente';
                return {
                  id: substituicao.id,
                  ordem: substituicao.ordem,
                  alimentoComposicaoId: substituicao.alimentoComposicaoId,
                  descricao: this.criptografia.descriptografar(substituicao.descricaoCriptografada),
                  quantidade: Number(substituicao.quantidade),
                  unidade: substituicao.unidade,
                  porcaoGramas: Number(substituicao.porcaoGramas),
                  composicaoSnapshot: projetarComposicao(snapshot),
                  ...(incluirEquivalencias && equivalenciaAtiva ? {
                    equivalenciaAplicada: true,
                    ...(snapshot.equivalencia ? { referenciaEquivalencia: {
                      itemChave: snapshot.equivalencia.itemChave,
                      alternativaChave: snapshot.equivalencia.alternativaChave
                    } } : {})
                  } : {}),
                  liberadaParaPaciente: substituicao.liberadaParaPaciente,
                  preferida: substituicao.preferida
                };
              })
          }))
      }))
    };
  }

  private lerEdicao(versao: PlanoAlimentarVersaoOrm): {
    edicaoEstado: 'legado' | 'pendente' | 'materializada' | 'indisponivel';
    documentoEdicao?: DocumentoEdicaoPlano;
  } {
    if (!versao.edicaoSnapshotCriptografado) return {
      edicaoEstado: versao.edicaoProtegida && versao.edicaoMaterializadaRevisao !== versao.rascunhoRevisao ? 'indisponivel' : 'legado'
    };
    try {
      const documentoEdicao = lerSnapshotEdicaoGrupos(this.lerJsonCriptografado(versao.edicaoSnapshotCriptografado)).documento;
      return { documentoEdicao, edicaoEstado: versao.edicaoMaterializadaRevisao === versao.rascunhoRevisao ? 'materializada' : 'pendente' };
    } catch { return { edicaoEstado: 'indisponivel' }; }
  }

  private lerApresentacao(versao: PlanoAlimentarVersaoOrm) {
    return lerApresentacaoVersao(versao.apresentacaoSnapshotCriptografado, versao.apresentacaoRevisao, valor => this.criptografia.descriptografar(valor));
  }

  private garantirApresentacaoDisponivel(versao: PlanoAlimentarVersaoOrm): void {
    if (this.lerApresentacao(versao).apresentacaoEstado === 'indisponivel') {
      throw new ConflictException('Preferências de apresentação indisponíveis. Confira e salve uma configuração válida antes de continuar.');
    }
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
      ...(versao.preferenciasApresentacao ? { preferenciasApresentacao: versao.preferenciasApresentacao } : {}),
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

  private descriptografarOpcional(valor?: Buffer | null): string | undefined {
    return valor ? this.criptografia.descriptografar(valor) : undefined;
  }

  private copiarBuffer(valor?: Buffer | null): Buffer | undefined {
    return valor ? Buffer.from(valor) : undefined;
  }
}
