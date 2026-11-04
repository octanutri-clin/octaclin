import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { serializarCatalogoCanonico, sha256Catalogo } from '../dados/catalogo-composicao-fonte';
import { milesimosReceita, projetarConteudoReceitaPaciente } from '../dominio/conteudo-receita';
import { porcionarReceita } from '../dominio/porcionamento-receita';
import type { ItemModeloPlanoAlimentar } from '../dominio/modelos-plano-alimentar';
import type { BaseQuantidadesReceita } from '../dominio/metadados-receita';
import { CompartilharReceitasNutricionaisDto, PorcionamentoCompartilhamentoReceitaDto, VersaoReceitaEsperadaDto } from './dtos-compartilhamento-receita';

const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function invalido(): never { throw new Error('Snapshot de receita inválido.'); }
function objeto(v: unknown, campos?: readonly string[], classe?: Function): Record<string, any> {
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
    (![Object.prototype, null].includes(Object.getPrototypeOf(v)) && !(classe && v instanceof classe)) ||
    Object.getOwnPropertySymbols(v).length || Object.entries(Object.getOwnPropertyDescriptors(v)).some(([k, d]) =>
      (campos && !campos.includes(k)) || !d.enumerable || !Object.hasOwn(d, 'value'))) return invalido();
  return v as Record<string, any>;
}
export function normalizarInstrucoesReceita(v: unknown): string {
  if (typeof v !== 'string') return invalido();
  const texto = v.replace(/\r\n/g, '\n').normalize('NFC');
  if (Array.from(texto).length > 4000) return invalido();
  return texto;
}
/** Serviço também valida: os DTOs/TypeScript não são uma fronteira suficiente. */
export function validarPedidoCompartilhamento(v: unknown): CompartilharReceitasNutricionaisDto {
  try {
    const o = objeto(v, ['pacienteId', 'chaveIdempotencia', 'receitaIds', 'versoesEsperadas', 'canais', 'agendadoPara', 'confirmacaoRevisaoManual', 'porcionamentos'], CompartilharReceitasNutricionaisDto);
    if (!Array.isArray(o.versoesEsperadas)) return invalido();
    for (const item of o.versoesEsperadas) objeto(item, ['receitaId', 'versao'], VersaoReceitaEsperadaDto);
    if (o.porcionamentos !== undefined) {
      if (!Array.isArray(o.porcionamentos)) return invalido();
      for (const item of o.porcionamentos) objeto(item, ['receitaId', 'porcoesDesejadas', 'fingerprintPrevia', 'instrucoesPersonalizadas', 'confirmacaoConferenciaInstrucoes'], PorcionamentoCompartilhamentoReceitaDto);
    }
    const dados = plainToInstance(CompartilharReceitasNutricionaisDto, v);
    if (validateSync(dados, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) return invalido();
    if (new Set(dados.receitaIds).size !== dados.receitaIds.length || new Set(dados.canais).size !== dados.canais.length ||
      new Set(dados.versoesEsperadas.map(x => x.receitaId)).size !== dados.receitaIds.length || dados.versoesEsperadas.length !== dados.receitaIds.length ||
      dados.versoesEsperadas.some(x => !dados.receitaIds.includes(x.receitaId)) ||
      new Set((dados.porcionamentos ?? []).map(x => x.receitaId)).size !== (dados.porcionamentos?.length ?? 0) ||
      dados.porcionamentos?.some(x => !dados.receitaIds.includes(x.receitaId))) return invalido();
    for (const p of dados.porcionamentos ?? []) if (p.instrucoesPersonalizadas !== undefined) p.instrucoesPersonalizadas = normalizarInstrucoesReceita(p.instrucoesPersonalizadas);
    return dados;
  } catch { throw new BadRequestException('Solicitação de compartilhamento inválida.'); }
}
/** Hash interno; relógio de agora e ordenação incidental não mudam a intenção. */
export function hashPedidoCompartilhamento(d: CompartilharReceitasNutricionaisDto, originais: ReadonlyMap<string, string>, autorUsuarioId: string): string {
  return sha256Catalogo(serializarCatalogoCanonico({
    protocolo: 'food07-compartilhamento-v1', autorUsuarioId, pacienteId: d.pacienteId,
    canais: [...new Set(['portal', ...d.canais])].sort(), agendadoPara: d.agendadoPara ? new Date(d.agendadoPara).toISOString() : null,
    confirmacaoRevisaoManual: d.confirmacaoRevisaoManual === true,
    receitas: [...d.versoesEsperadas].sort((a, b) => a.receitaId.localeCompare(b.receitaId)).map(v => {
      const p = d.porcionamentos?.find(x => x.receitaId === v.receitaId);
      return { ...v, modo: p ? 'porcionado' : 'quantidades_cadastradas', ...(p ? { porcoesDesejadas: p.porcoesDesejadas,
        fingerprintPrevia: p.fingerprintPrevia, confirmacaoConferenciaInstrucoes: true,
        instrucoes: p.instrucoesPersonalizadas ?? originais.get(v.receitaId) ?? '' } : {}) };
    })
  }));
}

export interface QuantidadesOriginaisReceita { quantidade: number; porcaoGramas: number; substituicoes?: QuantidadesOriginaisReceita[] }
export interface ContextoPorcionamentoReceita {
  algoritmo: 'porcionamento-receita-v1'; baseQuantidades: BaseQuantidadesReceita; rendimentoOriginalPorcoes?: number;
  porcoesDesejadas: number; fatorExato: { numerador: string; denominador: string }; fingerprint: string;
  originais: QuantidadesOriginaisReceita[]; fontes: Record<string, unknown>[];
}
export interface ContextoCompartilhamentoReceita {
  schemaVersao: 1; hashPedidoCompartilhamento: string; instrucaoOriginal?: string; porcionamento?: ContextoPorcionamentoReceita;
}
export interface SnapshotCompartilhamentoReceita {
  nome: string; versao: number; conteudo: ReturnType<typeof projetarConteudoReceitaPaciente>; contextoCompartilhamento?: ContextoCompartilhamentoReceita;
}
export function quantidadesOriginaisReceita(itens: readonly ItemModeloPlanoAlimentar[]): QuantidadesOriginaisReceita[] {
  return itens.map(i => ({ quantidade: i.quantidade, porcaoGramas: i.porcaoGramas,
    ...(i.substituicoes === undefined ? {} : { substituicoes: quantidadesOriginaisReceita(i.substituicoes) }) }));
}
function lerQuantidades(v: unknown, itens: readonly ItemModeloPlanoAlimentar[], alternativa = false): QuantidadesOriginaisReceita[] {
  if (!Array.isArray(v) || v.length !== itens.length) return invalido();
  return v.map((x, indice) => {
    const q = objeto(x, alternativa ? ['quantidade', 'porcaoGramas'] : ['quantidade', 'porcaoGramas', 'substituicoes']);
    milesimosReceita(q.quantidade); milesimosReceita(q.porcaoGramas);
    const subs = itens[indice].substituicoes;
    if (q.substituicoes !== undefined || subs?.length) lerQuantidades(q.substituicoes, subs ?? [], true);
    return q as QuantidadesOriginaisReceita;
  });
}
function lerFontes(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > 2100) return invalido();
  return v.map(x => {
    const o = objeto(x, ['alimentoComposicaoId', 'descricao', 'preparacao', 'baseGramas', 'hashRegistro', 'nutrientesOrigem', 'nutrientesPor100g', 'fonte']);
    if (typeof o.alimentoComposicaoId !== 'string' || !UUID.test(o.alimentoComposicaoId) || typeof o.descricao !== 'string' || Array.from(o.descricao).length > 240 ||
      (o.preparacao !== null && (typeof o.preparacao !== 'string' || Array.from(o.preparacao).length > 180)) ||
      !Number.isFinite(o.baseGramas) || o.baseGramas <= 0 || (o.hashRegistro !== null && !HASH.test(o.hashRegistro))) return invalido();
    const f = objeto(o.fonte, ['codigo', 'versao', 'hashConteudo']);
    if (!['codigo', 'versao'].every(k => typeof f[k] === 'string' && f[k].length > 0 && f[k].length <= 80) || !HASH.test(f.hashConteudo)) return invalido();
    for (const k of ['nutrientesOrigem', 'nutrientesPor100g']) {
      const ns = objeto(o[k], ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg']);
      if (Object.values(ns).some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return invalido();
    }
    return o;
  });
}
export function lerSnapshotCompartilhamentoReceita(v: unknown): SnapshotCompartilhamentoReceita {
  const o = objeto(v); // Extras antigos são descartados pela allowlist; nunca retornados.
  if (typeof o.nome !== 'string' || !o.nome.trim() || Array.from(o.nome).length > 180 || !Number.isInteger(o.versao) || o.versao < 1 || o.versao > 2147483647) return invalido();
  const conteudo = projetarConteudoReceitaPaciente(o.conteudo);
  if (!Object.hasOwn(o, 'contextoCompartilhamento')) return { nome: o.nome, versao: o.versao, conteudo };
  const c = objeto(o.contextoCompartilhamento, ['schemaVersao', 'hashPedidoCompartilhamento', 'instrucaoOriginal', 'porcionamento']);
  if (c.schemaVersao !== 1 || typeof c.hashPedidoCompartilhamento !== 'string' || !HASH.test(c.hashPedidoCompartilhamento)) return invalido();
  if (c.instrucaoOriginal !== undefined) normalizarInstrucoesReceita(c.instrucaoOriginal);
  if (c.porcionamento !== undefined) {
    const p = objeto(c.porcionamento, ['algoritmo', 'baseQuantidades', 'rendimentoOriginalPorcoes', 'porcoesDesejadas', 'fatorExato', 'fingerprint', 'originais', 'fontes']);
    if (p.algoritmo !== 'porcionamento-receita-v1' || typeof p.fingerprint !== 'string' || !HASH.test(p.fingerprint) || c.instrucaoOriginal === undefined) return invalido();
    const fator = objeto(p.fatorExato, ['numerador', 'denominador']);
    if (!['numerador', 'denominador'].every(k => typeof fator[k] === 'string' && /^[1-9]\d{0,12}$/.test(fator[k]))) return invalido();
    const qs = lerQuantidades(p.originais, conteudo.itens);
    const reconstituir = (itens: readonly ItemModeloPlanoAlimentar[], quantidades: QuantidadesOriginaisReceita[]): ItemModeloPlanoAlimentar[] => itens.map((i, j) => ({ ...i,
      quantidade: quantidades[j].quantidade, porcaoGramas: quantidades[j].porcaoGramas,
      ...(i.substituicoes === undefined ? {} : { substituicoes: reconstituir(i.substituicoes, quantidades[j].substituicoes ?? []) }) }));
    const base = { itens: reconstituir(conteudo.itens, qs), metadados: { baseQuantidades: p.baseQuantidades,
      ...(p.rendimentoOriginalPorcoes === undefined ? {} : { rendimentoPorcoes: p.rendimentoOriginalPorcoes }) } };
    const calculo = porcionarReceita(base, p.porcoesDesejadas);
    if (calculo.estado !== 'calculavel' || serializarCatalogoCanonico(calculo.fatorExato) !== serializarCatalogoCanonico(fator) ||
      serializarCatalogoCanonico(quantidadesOriginaisReceita(calculo.itens)) !== serializarCatalogoCanonico(quantidadesOriginaisReceita(conteudo.itens))) return invalido();
    lerFontes(p.fontes);
  } else if (c.instrucaoOriginal !== undefined) return invalido();
  return { nome: o.nome, versao: o.versao, conteudo, contextoCompartilhamento: c as ContextoCompartilhamentoReceita };
}
export function projetarSnapshotCompartilhamentoPaciente(snapshot: SnapshotCompartilhamentoReceita) {
  const { nome, versao, conteudo } = snapshot, p = snapshot.contextoCompartilhamento?.porcionamento;
  return { nome, versao, conteudo, ...(p ? { porcionamento: { porcoesDesejadas: p.porcoesDesejadas,
    ...(p.rendimentoOriginalPorcoes === undefined ? {} : { rendimentoOriginalPorcoes: p.rendimentoOriginalPorcoes }), ingredientesAjustados: true as const } } : {}) };
}
