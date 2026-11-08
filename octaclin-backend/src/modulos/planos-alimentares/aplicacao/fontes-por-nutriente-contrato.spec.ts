/**
 * FOOD06 M01-C1/C2/C3 — prova de contrato entre superfícies.
 *
 * O cenário é sintético e usa o código real (construtor do registro, cobertura, fontes,
 * projeção e relatório). As respostas geradas são gravadas em um fixture versionado que a
 * Web lê com os leitores reais (`octaclin-web/scripts/food06-m01-contrato.spec.ts`). Este
 * teste falha se o fixture divergir do que o backend produz hoje, de modo que as duas
 * metades não podem divergir em silêncio.
 *
 * Para regenerar de propósito: ATUALIZAR_FIXTURE_FOOD06_M01=true pnpm exec jest <este arquivo>.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { construirAnaliseFactual } from './construtor-analise-factual';
import { projetarRegistroFactual, projetarResumoHistoricoFactual } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import { resumirFontesRegistro } from './fontes-relatorio-factual';
import { ServicoPlanosAlimentares } from './servico-planos-alimentares';
import { analisarCoberturaDietetica } from '../dominio/cobertura-dietetica';
import { analisarFontesPorNutriente } from '../dominio/fontes-por-nutriente';
import { calcularNutrientesCombinados, type EntradaPlanoCombinado } from '../dominio/calculo-combinado';
import { criarSnapshotMicronutrientes, CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';

const FIXTURE = resolve(__dirname, '../../../../../octaclin-web/scripts/fixtures/food06-m01-contrato.json');
const PLANO = '10000000-0000-4000-8000-000000000001', VERSAO = '10000000-0000-4000-8000-000000000002';
const REFEICAO = '10000000-0000-4000-8000-000000000003', REGISTRO = '10000000-0000-4000-8000-000000000004';
const TENANT = '10000000-0000-4000-8000-000000000005', PACIENTE = '10000000-0000-4000-8000-000000000006';
const HASH = 'b'.repeat(64);
const macros = { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 10 };
const catalogo = (codigo: string, versao: string, baseCodigo: string, micros: Parameters<typeof criarSnapshotMicronutrientes>[0]) => ({
  origem: 'catalogo', codigoOrigem: 'ALIMENTO-SINTETICO', fonte: { codigo, versao, baseCodigo, hashConteudo: HASH, esquemaVersao: 'octaclin-composicao-v2-micros1' },
  nutrientesPor100g: macros, nutrientesPorcao: macros, micronutrientes: criarSnapshotMicronutrientes(micros, 100, 100)
});
// A: TACO 4.1. B: USDA Foundation 2025.4. C: composição manual.
const itens = () => [
  catalogo('taco_nepa_unicamp', '4.1', 'cmvcol_taco3', { calcioMg: { estado: 'conhecido', valor: 10 }, ferroMg: { estado: 'conhecido', valor: 0 }, zincoMg: { estado: 'conhecido', valor: 1 }, manganesMg: { estado: 'unidade_incompativel' } }),
  catalogo('usda_fdc_foundation', '2025.4', 'foundation-foods', { calcioMg: { estado: 'conhecido', valor: 5 }, zincoMg: { estado: 'conhecido', valor: 2 }, manganesMg: { estado: 'conhecido', valor: 4 } }),
  { origem: 'manual', nutrientesPor100g: macros, nutrientesPorcao: macros, micronutrientes: criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor: 3 }, zincoMg: { estado: 'conhecido', valor: 1 }, manganesMg: { estado: 'conhecido', valor: 2 } }, 100, 100) }
];
// Cenário de C1: o único valor conhecido de ferro é ZERO (continua conhecido); cálcio está ausente (não é zero).
const itensSoZero = () => [catalogo('taco_nepa_unicamp', '4.1', 'cmvcol_taco3', { ferroMg: { estado: 'conhecido', valor: 0 } })];
const plano = (it: unknown[]): EntradaPlanoCombinado => ({ planoId: PLANO, ativo: true, selecionado: true, refeicoes: [{ identidadeId: REFEICAO, ativa: true, selecionada: true, itens: it }] });
const registroDe = (it: unknown[]) => construirAnaliseFactual({
  escopo: { tenantId: TENANT, pacienteId: PACIENTE },
  origem: { planoId: PLANO, versaoId: VERSAO, numero: 1, status: 'publicada', registradaEm: '2026-11-01T12:00:00.000Z' },
  ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: REFEICAO, ativa: true, selecionada: true, itens: it.map(snapshot => ({ porcaoGramas: 100, snapshot })) }]
});
const registro = () => registroDe(itens());
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/**
 * Resposta do cálculo ao vivo produzida pelo MÉTODO REAL `analisarMicronutrientes`. Só o wrapper privado
 * `executarCalculoCombinado` (autorização, locks e decifragem) é simulado, e ele apenas acrescenta
 * `calculadoEm` e `publicacoes` ao que a projeção devolve. Se alguém remover `fontes` do serviço,
 * este contrato falha.
 */
async function aoVivo(planos: EntradaPlanoCombinado[]) {
  const servico = Object.create(ServicoPlanosAlimentares.prototype) as unknown as {
    executarCalculoCombinado: (...a: unknown[]) => Promise<unknown>;
    analisarMicronutrientes: (...a: unknown[]) => Promise<unknown>;
  };
  servico.executarCalculoCombinado = async (_t, _p, _u, _d, projetar) => ({
    ...(projetar as (p: EntradaPlanoCombinado[], d: Map<string, never>) => object)(planos, new Map<string, never>()),
    calculadoEm: '2026-11-07T12:00:00.000Z', publicacoes: [{ planoId: PLANO, versaoId: VERSAO, ativacaoRevisao: 1 }]
  });
  return json(await servico.analisarMicronutrientes('tenant', 'paciente', {}, {})) as Record<string, any>;
}
async function gerar() {
  const r = registro(), meta = { id: REGISTRO, criadoEm: new Date('2026-11-07T11:00:00.000Z') };
  const projecao = projetarRegistroFactual(meta, r);
  const comFontes = { ...projecao, fontesComposicao: resumirFontesRegistro(r) };
  const comFontesECodigo = { ...projecao, fontesComposicao: resumirFontesRegistro(r, true) };
  const agora = new Date('2026-11-07T13:00:00.000Z');
  const rz = registroDe(itensSoZero()), pz = projetarRegistroFactual(meta, rz);
  const zero = {
    aoVivo: null as unknown, historico: json(projetarResumoHistoricoFactual(meta, rz, undefined, false, true)),
    relatorioV2: json(prepararRelatorioFactual({ ...pz, fontesComposicao: resumirFontesRegistro(rz, true) }, agora, 2, true))
  };
  return {
    zero: { historico: zero.historico, relatorioV2: zero.relatorioV2 },
    descricao: 'Fixture gerado por fontes-por-nutriente-contrato.spec.ts. Dados 100% sintéticos. Não editar à mão.',
    entrada: { selecoes: [{ planoId: PLANO, versaoIdEsperada: VERSAO, ativacaoRevisaoEsperada: 1, identidadesRefeicoes: [REFEICAO] }] },
    registroId: REGISTRO,
    aoVivo: await aoVivo([plano(itens())]),
    aoVivoSemComponentes: await aoVivo([plano([])]),
    aoVivoZero: await aoVivo([plano(itensSoZero())]),
    registro: json(projecao),
    historico: json(projetarResumoHistoricoFactual(meta, r, undefined, false, true)),
    historicoSemOrigem: json(projetarResumoHistoricoFactual(meta, r)),
    relatorioV1: json(prepararRelatorioFactual(comFontes, agora, 1)),
    relatorioV2: json(prepararRelatorioFactual(comFontesECodigo, agora, 2, true)),
    relatorioV2SemOrigem: json(prepararRelatorioFactual(comFontes, agora, 2))
  };
}
const CHAVES_COBERTURA = ['codigo', 'unidade', 'estado', 'contagens', 'causas', 'total', 'quantidadeConhecida'];
type Nut = { estado: string; contagens: Record<string, number>; causas: { codigo: string; quantidade: number }[]; total?: number; quantidadeConhecida?: number };
type Fon = { contribuintes: number; fontes: { tipo: string; codigo?: string; versao?: string; quantidade: number }[]; semOrigemDocumentada: number; fontesNaoDetalhadas: number };
const cob = (o: any, c: string): Nut => o.cobertura.nutrientes[c];
const fon = (o: any, c: string): Fon => o.fontes.nutrientes[c];

describe('FOOD06 M01-C1/C2/C3: contrato entre API ao vivo, registro, detalhes e relatório', () => {
  let g: Awaited<ReturnType<typeof gerar>>;
  let registroComoSuperficie: any, relatorioComoSuperficie: any, historicoComoSuperficie: any, superficies: Record<string, any>;
  const NOMES_SUPERFICIES = ['aoVivo', 'registro', 'relatorioV2', 'historico'];
  beforeAll(async () => {
    g = await gerar();
    registroComoSuperficie = { cobertura: g.registro.analise.cobertura, fontes: g.registro.fontesPorNutriente };
    relatorioComoSuperficie = { cobertura: g.relatorioV2.analise.cobertura, fontes: (g.relatorioV2 as any).fontesPorNutriente };
    historicoComoSuperficie = { cobertura: { nutrientes: g.historico.nutrientes }, fontes: g.historico.fontesPorNutriente };
    superficies = { aoVivo: g.aoVivo, registro: registroComoSuperficie, relatorioV2: relatorioComoSuperficie, historico: historicoComoSuperficie };
  });

  it('o fixture compartilhado com a Web é exatamente o que o backend produz hoje', () => {
    if (process.env.ATUALIZAR_FIXTURE_FOOD06_M01 === 'true') writeFileSync(FIXTURE, JSON.stringify(g, null, 1) + '\n');
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(g);
  });

  describe('M01-C1 zero conhecido é diferente de ausência; cobertura por nutriente, não por alimento', () => {
    it.each(NOMES_SUPERFICIES)('%s: ferro com zero conhecido contribui; magnésio ausente não tem valor nem origem', nome => {
      const s = superficies[nome];
      expect(cob(s, 'ferroMg')).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 3, contagens: { incluidos: 3, conhecidos: 2, semComposicao: 1 } });
      expect(fon(s, 'ferroMg').fontes).toEqual([{ tipo: 'manual', quantidade: 1 }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }]);
      expect(cob(s, 'magnesioMg')).toMatchObject({ estado: 'DESCONHECIDO', contagens: { incluidos: 3, conhecidos: 0, semComposicao: 3 } });
      expect(cob(s, 'magnesioMg')).not.toHaveProperty('quantidadeConhecida');
      expect(cob(s, 'magnesioMg')).not.toHaveProperty('total');
      expect(fon(s, 'magnesioMg')).toEqual({ contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
    });
    it('os mesmos três alimentos geram contagens diferentes por nutriente', () => {
      const conhecidos = ['calcioMg', 'ferroMg', 'zincoMg', 'magnesioMg'].map(c => cob(g.aoVivo, c).contagens.conhecidos);
      expect(conhecidos).toEqual([2, 2, 3, 0]);
      expect(new Set(['calcioMg', 'ferroMg', 'zincoMg', 'magnesioMg'].map(c => cob(g.aoVivo, c).contagens.incluidos))).toEqual(new Set([3]));
    });
  });

  describe('M01-C1 (zero conhecido) em todas as superfícies, com o valor 0 visível', () => {
    it('ferro com zero conhecido é COMPLETO com total 0 e origem; cálcio ausente é DESCONHECIDO sem valor nem origem', () => {
      const zeroSup = {
        aoVivo: g.aoVivoZero,
        historico: { cobertura: { nutrientes: g.zero.historico.nutrientes }, fontes: g.zero.historico.fontesPorNutriente },
        relatorioV2: { cobertura: g.zero.relatorioV2.analise.cobertura, fontes: (g.zero.relatorioV2 as any).fontesPorNutriente }
      } as Record<string, any>;
      for (const [nome, s] of Object.entries(zeroSup)) {
        expect(cob(s, 'ferroMg')).toMatchObject({ estado: 'COMPLETO', total: 0 });
        expect(cob(s, 'ferroMg').total).toBe(0);
        expect(fon(s, 'ferroMg')).toEqual({ contribuintes: 1, fontes: [{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
        expect(cob(s, 'calcioMg')).toMatchObject({ estado: 'DESCONHECIDO', contagens: { incluidos: 1, conhecidos: 0, semComposicao: 1 } });
        expect(cob(s, 'calcioMg')).not.toHaveProperty('total');
        expect(cob(s, 'calcioMg')).not.toHaveProperty('quantidadeConhecida');
        expect(fon(s, 'calcioMg')).toEqual({ contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
      }
    });
  });

  describe('M01-C2 cinco estados, motivos, contagens e origens documentadas', () => {
    it('os cinco estados aparecem com motivo e contagem corretos', () => {
      const s = g.aoVivo;
      expect(cob(s, 'zincoMg')).toMatchObject({ estado: 'COMPLETO', total: 4, causas: [], contagens: { incluidos: 3, conhecidos: 3, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 } });
      expect(cob(s, 'calcioMg')).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 15, causas: [{ codigo: 'ausente', quantidade: 1 }] });
      expect(cob(s, 'magnesioMg')).toMatchObject({ estado: 'DESCONHECIDO', causas: [{ codigo: 'ausente', quantidade: 3 }] });
      expect(cob(s, 'manganesMg')).toMatchObject({ estado: 'INCOMPATIVEL', quantidadeConhecida: 6, causas: [{ codigo: 'unidade_incompativel', quantidade: 1 }], contagens: { incompativeis: 1, conhecidos: 2 } });
      const vazio = g.aoVivoSemComponentes;
      for (const c of CODIGOS_MICRONUTRIENTES) {
        expect(cob(vazio, c)).toMatchObject({ estado: 'INDISPONIVEL', causas: [{ codigo: 'sem_componentes', quantidade: 0 }], contagens: { incluidos: 0 } });
        expect(fon(vazio, c)).toEqual({ contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
      }
    });
    it('cada superfície traz só as origens dos contribuintes conhecidos, separando USDA e TACO', () => {
      for (const s of Object.values(superficies)) {
        expect(fon(s, 'calcioMg').fontes).toEqual([
          { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 },
          { tipo: 'USDA', codigo: 'usda_fdc_foundation', versao: '2025.4', quantidade: 1 }]);
        expect(fon(s, 'zincoMg').contribuintes).toBe(3);
        // Alimento com unidade incompatível (TACO) não aparece como fonte do manganês.
        expect(fon(s, 'manganesMg').fontes.map(f => f.tipo)).toEqual(['manual', 'USDA']);
      }
    });
    it('toda origem reconcilia com os conhecidos da cobertura e declara que é origem do registro', () => {
      for (const s of Object.values(superficies)) for (const c of CODIGOS_MICRONUTRIENTES) {
        const f = fon(s, c);
        expect(f.contribuintes).toBe(cob(s, c).contagens.conhecidos);
        expect(f.fontes.reduce((n, x) => n + x.quantidade, 0) + f.semOrigemDocumentada + f.fontesNaoDetalhadas).toBe(f.contribuintes);
        expect(s.fontes.vinculo).toBe('origem_do_registro_de_composicao');
      }
    });
  });

  describe('M01-C3 subtotal parcial explícito, sem referência, mesmos dados em todas as saídas', () => {
    it('subtotal parcial não vira total e nenhuma saída traz percentual ou referência', () => {
      for (const s of Object.values(superficies)) {
        expect(cob(s, 'calcioMg')).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 15 });
        expect(cob(s, 'calcioMg')).not.toHaveProperty('total');
        for (const c of CODIGOS_MICRONUTRIENTES) expect(Object.keys(cob(s, c)).every(k => CHAVES_COBERTURA.includes(k))).toBe(true);
      }
      expect(g.aoVivo.comparacoes).toEqual({ estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' });
      expect(g.registro.referencias).toEqual({ estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' });
      expect(g.relatorioV2.referencias).toEqual({ estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' });
      expect(JSON.stringify([g.aoVivo.cobertura, g.aoVivo.fontes, g.registro.analise.cobertura, g.registro.fontesPorNutriente])).not.toMatch(/percentual|adequa|rda|"ul"|"ai"/i);
    });
    it('cobertura e origem são idênticas na API ao vivo, no registro, no histórico e no relatório formato 2', () => {
      for (const c of CODIGOS_MICRONUTRIENTES) {
        const base = { cobertura: cob(g.aoVivo, c), fontes: fon(g.aoVivo, c) };
        expect({ cobertura: cob(registroComoSuperficie, c), fontes: fon(registroComoSuperficie, c) }).toEqual(base);
        expect({ cobertura: cob(relatorioComoSuperficie, c), fontes: fon(relatorioComoSuperficie, c) }).toEqual(base);
        expect({ cobertura: cob(historicoComoSuperficie, c), fontes: fon(historicoComoSuperficie, c) }).toEqual(base);
      }
    });
    it('R4C2-02 resumo histórico preserva o subtotal conhecido também quando há incompatibilidade, igual às outras superfícies', () => {
      for (const c of CODIGOS_MICRONUTRIENTES) {
        const h = (g.historico.nutrientes as Record<string, Nut>)[c], base = cob(g.aoVivo, c);
        expect({ estado: h.estado, contagens: h.contagens, causas: h.causas, total: h.total, quantidadeConhecida: h.quantidadeConhecida })
          .toEqual({ estado: base.estado, contagens: base.contagens, causas: base.causas, total: base.total, quantidadeConhecida: base.quantidadeConhecida });
      }
      expect((g.historico.nutrientes as Record<string, Nut>).manganesMg).toMatchObject({ estado: 'INCOMPATIVEL', quantidadeConhecida: 6 });
      expect((g.historico.nutrientes as Record<string, Nut>).manganesMg).not.toHaveProperty('total');
    });
    it('sem o pedido de origem, histórico e relatório formato 2 mantêm o formato anterior (compatível com uma Web antiga)', () => {
      expect(g.historicoSemOrigem).not.toHaveProperty('fontesPorNutriente');
      expect(g.relatorioV2SemOrigem).not.toHaveProperty('fontesPorNutriente');
      expect(g.relatorioV2SemOrigem.schemaVersao).toBe(2);
      expect((g.relatorioV2SemOrigem as any).fontesComposicao.fontes.some((f: Record<string, unknown>) => 'codigo' in f)).toBe(false);
      expect(g.relatorioV2SemOrigem.analise).toEqual(g.relatorioV2.analise);
    });
    it('formato 1 do relatório permanece sem o campo novo e com a mesma cobertura', () => {
      expect(g.relatorioV1).not.toHaveProperty('fontesPorNutriente');
      expect(g.relatorioV1.schemaVersao).toBe(1);
      expect(g.relatorioV1.analise.cobertura).toEqual(g.relatorioV2.analise.cobertura);
    });
    it('nada sensível atravessa nas respostas geradas (hash, descrição, código do alimento)', () => {
      expect(JSON.stringify(g)).not.toMatch(/bbbbbbbb|ALIMENTO-SINTETICO|hashConteudo|conteudoHash|tenantId|pacienteId/);
    });
  });
});
