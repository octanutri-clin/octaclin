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
import { projetarRegistroFactual } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import { resumirFontesRegistro } from './fontes-relatorio-factual';
import { projetarAjudaDietetica } from './projecao-ajuda-dietetica';
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
  catalogo('taco_nepa_unicamp', '4.1', 'TACO', { calcioMg: { estado: 'conhecido', valor: 10 }, ferroMg: { estado: 'conhecido', valor: 0 }, zincoMg: { estado: 'conhecido', valor: 1 }, manganesMg: { estado: 'unidade_incompativel' } }),
  catalogo('usda_fdc_foundation', '2025.4', 'USDA', { calcioMg: { estado: 'conhecido', valor: 5 }, zincoMg: { estado: 'conhecido', valor: 2 }, manganesMg: { estado: 'conhecido', valor: 4 } }),
  { origem: 'manual', nutrientesPor100g: macros, nutrientesPorcao: macros, micronutrientes: criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor: 3 }, zincoMg: { estado: 'conhecido', valor: 1 }, manganesMg: { estado: 'conhecido', valor: 2 } }, 100, 100) }
];
const plano = (it: unknown[]): EntradaPlanoCombinado => ({ planoId: PLANO, ativo: true, selecionado: true, refeicoes: [{ identidadeId: REFEICAO, ativa: true, selecionada: true, itens: it }] });
const registro = () => construirAnaliseFactual({
  escopo: { tenantId: TENANT, pacienteId: PACIENTE },
  origem: { planoId: PLANO, versaoId: VERSAO, numero: 1, status: 'publicada', registradaEm: '2026-11-01T12:00:00.000Z' },
  ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: REFEICAO, ativa: true, selecionada: true, itens: itens().map(snapshot => ({ porcaoGramas: 100, snapshot })) }]
});
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** Mesma composição de `analisarMicronutrientes` (resposta do cálculo ao vivo). */
const aoVivo = (planos: EntradaPlanoCombinado[]) => json({
  schemaVersao: 1, motorVersao: 'food06-factual-v1', calculadoEm: '2026-11-07T12:00:00.000Z',
  publicacoes: [{ planoId: PLANO, versaoId: VERSAO, ativacaoRevisao: 1 }],
  calculo: calcularNutrientesCombinados(planos), cobertura: analisarCoberturaDietetica(planos),
  fontes: analisarFontesPorNutriente(planos),
  comparacoes: { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }, ajuda: projetarAjudaDietetica()
});
function gerar() {
  const r = registro(), meta = { id: REGISTRO, criadoEm: new Date('2026-11-07T11:00:00.000Z') };
  const projecao = projetarRegistroFactual(meta, r);
  const comFontes = { ...projecao, fontesComposicao: resumirFontesRegistro(r) };
  const agora = new Date('2026-11-07T13:00:00.000Z');
  return {
    descricao: 'Fixture gerado por fontes-por-nutriente-contrato.spec.ts. Dados 100% sintéticos. Não editar à mão.',
    entrada: { selecoes: [{ planoId: PLANO, versaoIdEsperada: VERSAO, ativacaoRevisaoEsperada: 1, identidadesRefeicoes: [REFEICAO] }] },
    registroId: REGISTRO,
    aoVivo: aoVivo([plano(itens())]),
    aoVivoSemComponentes: aoVivo([plano([])]),
    registro: json(projecao),
    relatorioV1: json(prepararRelatorioFactual(comFontes, agora, 1)),
    relatorioV2: json(prepararRelatorioFactual(comFontes, agora, 2))
  };
}
const CHAVES_COBERTURA = ['codigo', 'unidade', 'estado', 'contagens', 'causas', 'total', 'quantidadeConhecida'];
type Nut = { estado: string; contagens: Record<string, number>; causas: { codigo: string; quantidade: number }[]; total?: number; quantidadeConhecida?: number };
type Fon = { contribuintes: number; fontes: { tipo: string; codigo?: string; versao?: string; quantidade: number }[]; semOrigemDocumentada: number; fontesNaoDetalhadas: number };
const cob = (o: any, c: string): Nut => o.cobertura.nutrientes[c];
const fon = (o: any, c: string): Fon => o.fontes.nutrientes[c];

describe('FOOD06 M01-C1/C2/C3: contrato entre API ao vivo, registro, detalhes e relatório', () => {
  const g = gerar();
  const registroComoSuperficie = { cobertura: g.registro.analise.cobertura, fontes: g.registro.fontesPorNutriente };
  const relatorioComoSuperficie = { cobertura: g.relatorioV2.analise.cobertura, fontes: (g.relatorioV2 as any).fontesPorNutriente };
  const superficies = { aoVivo: g.aoVivo, registro: registroComoSuperficie, relatorioV2: relatorioComoSuperficie } as Record<string, any>;

  it('o fixture compartilhado com a Web é exatamente o que o backend produz hoje', () => {
    if (process.env.ATUALIZAR_FIXTURE_FOOD06_M01 === 'true') writeFileSync(FIXTURE, JSON.stringify(g, null, 1) + '\n');
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(g);
  });

  describe('M01-C1 zero conhecido é diferente de ausência; cobertura por nutriente, não por alimento', () => {
    it.each(Object.keys(superficies))('%s: ferro com zero conhecido contribui; magnésio ausente não tem valor nem origem', nome => {
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
    it('cobertura e origem são idênticas na API ao vivo, no registro e no relatório formato 2', () => {
      for (const c of CODIGOS_MICRONUTRIENTES) {
        const base = { cobertura: cob(g.aoVivo, c), fontes: fon(g.aoVivo, c) };
        expect({ cobertura: cob(registroComoSuperficie, c), fontes: fon(registroComoSuperficie, c) }).toEqual(base);
        expect({ cobertura: cob(relatorioComoSuperficie, c), fontes: fon(relatorioComoSuperficie, c) }).toEqual(base);
      }
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
