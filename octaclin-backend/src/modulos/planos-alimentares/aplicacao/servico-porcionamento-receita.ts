import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { serializarCatalogoCanonico, sha256Catalogo } from '../dados/catalogo-composicao-fonte';
import { decimalParaEscala8 } from '../dominio/micronutrientes';
import { calcularNutrientesParciaisDaPorcao, normalizarNutrienteCatalogoPor100g } from '../dominio/calculo-nutricional';
import { somarNutrientesParciais } from '../dominio/plano-alimentar';
import type { ItemModeloPlanoAlimentar } from '../dominio/modelos-plano-alimentar';
import { porcionarReceita } from '../dominio/porcionamento-receita';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { PreverPorcionamentoReceitaDto } from './dtos-receitas-metadados';
import { ServicoReceitasNutricionais } from './servico-receitas-nutricionais';

const CAMPOS = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;
type Nutriente = typeof CAMPOS[number];
type ValorTotal = { estado: 'conhecido' | 'ausente'; unidade: 'kcal' | 'g'; valor?: number };

/** Mesmas fontes e primitiva decimal já usadas no catálogo/plano. Nenhuma escrita ou inferência de população. */
@Injectable()
export class ServicoPorcionamentoReceita {
  constructor(private readonly executor: ExecutorTenant, private readonly receitas: ServicoReceitasNutricionais) {}

  async prever(tenantId: string, receitaId: string, usuario: UsuarioAutenticado, entrada: unknown) {
    const dados = this.validar(entrada);
    return this.executor.executar(tenantId, g => this.preverNaTransacao(g, tenantId, receitaId, usuario, dados));
  }

  /** Interno: compartilha o EntityManager tenant-aware do chamador; nunca abre outra transação. */
  async preverNaTransacao(g: EntityManager, tenantId: string, receitaId: string, usuario: UsuarioAutenticado, entrada: unknown) {
    const dados = this.validar(entrada);
    const receita = await this.receitas.obterParaPorcionamento(g, tenantId, receitaId, usuario);
    if (receita.versao !== dados.versaoEsperada) throw new ConflictException('A receita foi alterada. Confira uma nova prévia.');
    const resultado = porcionarReceita(receita.conteudo, dados.porcoesDesejadas);
    const identidade = { receitaId: receita.id, versao: receita.versao };
    if (resultado.estado === 'indisponivel') return { ...identidade, ...resultado, fingerprint: sha256Catalogo(serializarCatalogoCanonico({ ...identidade, dados, resultado })) };

    const cache = new Map<string, { item: Partial<ItemModeloPlanoAlimentar>; fonte: Record<string, unknown> }>();
    const originais = receita.conteudo.itens;
    const ids = new Set(originais.flatMap(i => [i, ...(i.substituicoes ?? [])]).flatMap(i => i.alimentoComposicaoId ? [i.alimentoComposicaoId] : []));
    if (ids.size) {
      // Um statement lê alimento+fonte na mesma visão do banco. FOR SHARE
      // exigiria UPDATE no catálogo global, que o runtime corretamente não tem.
      const alimentos = await g.getRepository(AlimentoComposicaoOrm).createQueryBuilder('a')
        .innerJoinAndMapOne('a.fonteResolvida', FonteComposicaoAlimentoOrm, 'f', 'f.id = a.fonte_id')
        .select(['a.id', 'a.fonteId', 'a.nome', 'a.preparacao', 'a.baseGramas', 'a.energiaKcal', 'a.proteinasG',
          'a.carboidratosG', 'a.lipidiosG', 'a.fibrasG', 'a.sodioMg', 'a.hashRegistro',
          'f.id', 'f.codigo', 'f.versao', 'f.hashConteudo', 'f.situacao', 'f.direitoUsoStatus'])
        .where('a.id IN (:...ids)', { ids: [...ids].sort() }).orderBy('a.id', 'ASC').getMany();
      if (alimentos.length !== ids.size) throw new ConflictException('Um alimento ou sua fonte não está disponível. Confira a receita.');
      for (const alimento of alimentos as (AlimentoComposicaoOrm & { fonteResolvida?: FonteComposicaoAlimentoOrm })[]) {
        cache.set(alimento.id, this.resolverCatalogo(alimento, alimento.fonteResolvida));
      }
    }
    const itens = resultado.itens.map(item => ({ ...this.atualizarItem(item, cache),
      ...(item.substituicoes === undefined ? {} : { substituicoes: item.substituicoes.map(s => this.atualizarItem(s, cache)) }) }));
    const totais = {} as Record<Nutriente, ValorTotal>;
    try {
      // Exatamente a política do plano aplicado: normalização/porção/soma a4
      // casas. A fonte bruta permanece intacta e registrada no fingerprint.
      const somados = somarNutrientesParciais(itens.map(item => calcularNutrientesParciaisDaPorcao(item.nutrientesPor100g ?? {}, item.porcaoGramas)));
      for (const campo of CAMPOS) {
        const unidade = campo === 'energiaKcal' ? 'kcal' : 'g', valor = somados[campo];
        if (valor !== undefined) decimalParaEscala8(valor);
        totais[campo] = valor === undefined ? { estado: 'ausente', unidade } : { estado: 'conhecido', unidade, valor };
      }
    } catch { throw new UnprocessableEntityException('Limite técnico de precisão nutricional excedido.'); }
    const fontes = [...cache.values()].map(c => c.fonte);
    const previa = { ...identidade, ...resultado, itens, totais, fontes,
      denominador: { porcoes: resultado.porcoesDesejadas, descricao: 'Total para as porções solicitadas' } };
    // Fatos canônicos, sem ciphertext, tenant/paciente, chave secreta ou autorização transportada.
    const fingerprint = sha256Catalogo(serializarCatalogoCanonico({ protocolo: 'food07-porcionamento-v1', ...previa }));
    return { ...previa, fingerprint };
  }

  private validar(v: unknown): PreverPorcionamentoReceitaDto {
    if (!v || typeof v !== 'object' || Array.isArray(v) ||
      (![Object.prototype, null].includes(Object.getPrototypeOf(v)) && !(v instanceof PreverPorcionamentoReceitaDto)) ||
      Object.getOwnPropertySymbols(v).length || Object.entries(Object.getOwnPropertyDescriptors(v)).some(([k, d]) =>
        !['versaoEsperada', 'porcoesDesejadas'].includes(k) || !d.enumerable || !Object.hasOwn(d, 'value'))) {
      throw new BadRequestException('Solicitação de prévia inválida.');
    }
    const dto = plainToInstance(PreverPorcionamentoReceitaDto, v);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) throw new BadRequestException('Solicitação de prévia inválida.');
    return dto;
  }

  private atualizarItem(item: ItemModeloPlanoAlimentar, cache: Map<string, { item: Partial<ItemModeloPlanoAlimentar> }>): ItemModeloPlanoAlimentar {
    if (!item.alimentoComposicaoId) return { ...item };
    // O writer de planos resolve micros do catálogo; não aceita override manual.
    // A receita cadastrada e seus snapshots não são alterados pela projeção.
    const { micronutrientesPor100g: _naoAutorizado, ...catalogo } = item;
    return { ...catalogo, ...cache.get(item.alimentoComposicaoId)!.item };
  }

  private resolverCatalogo(a: AlimentoComposicaoOrm, f: FonteComposicaoAlimentoOrm | undefined) {
    if (!f || f.situacao !== 'ativa' || f.direitoUsoStatus !== 'aprovado') throw new ConflictException('Um alimento ou sua fonte não está disponível. Confira a receita.');
    const baseGramas = Number(a.baseGramas);
    const nutrientes: Partial<Record<Nutriente, number>> = {}, nutrientesPor100g: Record<string, number> = {};
    try {
      if (!Number.isFinite(baseGramas) || baseGramas <= 0 || !decimalParaEscala8(baseGramas)) throw new Error('Base inválida.');
      for (const [campo, coluna] of Object.entries({ energiaKcal: 'energiaKcal', proteinasG: 'proteinasG', carboidratosG: 'carboidratosG', gordurasG: 'lipidiosG', fibrasG: 'fibrasG', sodioMg: 'sodioMg' })) {
        const bruto = a[coluna as keyof AlimentoComposicaoOrm];
        if (bruto === undefined || bruto === null) continue;
        if (typeof bruto !== 'string' && typeof bruto !== 'number') throw new Error('Composição inválida.');
        if (typeof bruto === 'string' && !/^\d+(?:\.\d+)?$/.test(bruto)) throw new Error('Composição inválida.');
        const valor = Number(bruto); decimalParaEscala8(valor);
        if (CAMPOS.includes(campo as Nutriente)) nutrientes[campo as Nutriente] = valor;
        nutrientesPor100g[campo] = normalizarNutrienteCatalogoPor100g(valor, baseGramas);
      }
    } catch { throw new ConflictException('Composição nutricional indisponível. Confira a receita.'); }
    return {
      item: { descricao: a.nome, nutrientesPor100g },
      fonte: { alimentoComposicaoId: a.id, descricao: a.nome, preparacao: a.preparacao ?? null, baseGramas,
        hashRegistro: a.hashRegistro ?? null, nutrientesOrigem: nutrientes, nutrientesPor100g,
        fonte: { codigo: f.codigo, versao: f.versao, hashConteudo: f.hashConteudo } }
    };
  }
}
