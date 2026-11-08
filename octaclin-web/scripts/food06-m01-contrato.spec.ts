/**
 * FOOD06 M01-C1/C2/C3 — lado Web do contrato.
 * Lê o fixture gerado pelo backend (verificado por fontes-por-nutriente-contrato.spec.ts) com os
 * leitores reais da tabela e do relatório, e prova que os mesmos fatos aparecem nas superfícies.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lerAnaliseMicronutrientesFactual, lerLinhaMicronutrienteFactual, CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-factuais';
import { lerRelatorioFactual } from '../lib/relatorio-factual';
import { lerPaginaHistoricoMicronutrientesFactual } from '../lib/historico-micronutrientes-factuais';

type Entrada = Parameters<typeof lerAnaliseMicronutrientesFactual>[1];
const g = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/fixtures/food06-m01-contrato.json'), 'utf8')) as {
  entrada: Entrada; registroId: string; aoVivo: Record<string, unknown>; aoVivoSemComponentes: Record<string, unknown>;
  relatorioV1: Record<string, unknown>; relatorioV2: Record<string, unknown>;
  historico: { nutrientes: Record<string, unknown> };
  aoVivoZero: Record<string, unknown>;
  zero: { historico: Record<string, unknown>; relatorioV2: Record<string, unknown> };
};
type Origem = { contribuintes: number; fontes: { tipo: string; codigo?: string; versao?: string; quantidade: number }[]; semOrigemDocumentada: number; fontesNaoDetalhadas: number };
type Linha = { codigo: string; estado: string; valor?: number; contagens: Record<string, number>; causas: { codigo: string; quantidade: number }[]; origem?: Origem };
type Adulteravel = { fontes: { nutrientes: Record<string, { contribuintes: number }> }; fontesPorNutriente: { nutrientes: Record<string, { fontes: { quantidade: number }[] }> } };
const aoVivo = () => lerAnaliseMicronutrientesFactual(g.aoVivo, g.entrada).linhas as unknown as Linha[];
const relatorio = () => lerRelatorioFactual(g.relatorioV2, g.registroId).linhas as unknown as Linha[];
const por = (l: Linha[], codigo: string) => l.find(x => x.codigo === codigo)!;
const MANUAL_TACO = [{ tipo: 'manual', quantidade: 1 }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }];

test('M01-C1 Web: zero conhecido e ausência seguem distintos na tabela e no relatório, por nutriente', () => {
  for (const linhas of [aoVivo(), relatorio()]) {
    const ferro = por(linhas, 'ferroMg'), magnesio = por(linhas, 'magnesioMg');
    assert.equal(ferro.estado, 'PARCIAL'); assert.equal(ferro.valor, 3);
    assert.deepEqual(ferro.origem?.fontes, MANUAL_TACO);
    assert.equal(magnesio.estado, 'DESCONHECIDO'); assert.equal(magnesio.valor, undefined);
    assert.deepEqual(magnesio.origem, { contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
    assert.deepEqual(['calcioMg', 'ferroMg', 'zincoMg', 'magnesioMg'].map(c => por(linhas, c).contagens.conhecidos), [2, 2, 3, 0]);
  }
});

test('M01-C2 Web: cinco estados, motivos, contagens e origens chegam íntegros', () => {
  const l = aoVivo();
  assert.equal(por(l, 'zincoMg').estado, 'COMPLETO'); assert.equal(por(l, 'zincoMg').valor, 4);
  assert.equal(por(l, 'calcioMg').estado, 'PARCIAL'); assert.equal(por(l, 'calcioMg').valor, 15);
  assert.deepEqual(por(l, 'calcioMg').causas, [{ codigo: 'ausente', quantidade: 1 }]);
  assert.equal(por(l, 'magnesioMg').estado, 'DESCONHECIDO');
  assert.equal(por(l, 'manganesMg').estado, 'INCOMPATIVEL');
  assert.deepEqual(por(l, 'manganesMg').causas, [{ codigo: 'unidade_incompativel', quantidade: 1 }]);
  assert.deepEqual(por(l, 'manganesMg').origem?.fontes.map(f => f.tipo), ['manual', 'USDA']);
  assert.deepEqual(por(l, 'calcioMg').origem?.fontes, [
    { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 },
    { tipo: 'USDA', codigo: 'usda_fdc_foundation', versao: '2025.4', quantidade: 1 }]);
  const vazio = lerAnaliseMicronutrientesFactual(g.aoVivoSemComponentes, g.entrada).linhas as unknown as Linha[];
  assert.ok(vazio.every(x => x.estado === 'INDISPONIVEL' && x.origem?.contribuintes === 0));
  const estados = new Set([...l, ...vazio].map(x => x.estado));
  assert.deepEqual([...estados].sort(), ['COMPLETO', 'DESCONHECIDO', 'INCOMPATIVEL', 'INDISPONIVEL', 'PARCIAL']);
});

test('M01-C3 Web: tabela e relatório formato 2 concordam em valor, estado, contagens, causas e origem', () => {
  const a = aoVivo(), b = relatorio();
  assert.equal(a.length, CAMPOS_MICRONUTRIENTES_PLANO.length);
  for (const c of CAMPOS_MICRONUTRIENTES_PLANO) assert.deepEqual(por(b, c.codigo), por(a, c.codigo), c.codigo);
  // Subtotal parcial segue parcial: nenhum total é inventado nem há percentual.
  assert.equal(por(a, 'calcioMg').estado, 'PARCIAL');
  assert.ok(!JSON.stringify([a, b]).match(/percentual|adequa/i));
});

test('M01-C3 Web: legados continuam legíveis e não presumem origem', () => {
  const semFontes = { ...g.aoVivo }; delete semFontes.fontes;
  const l = lerAnaliseMicronutrientesFactual(semFontes, g.entrada).linhas as unknown as Linha[];
  assert.ok(l.every(x => x.origem === undefined)); assert.equal(por(l, 'calcioMg').valor, 15);
  const v1 = lerRelatorioFactual(g.relatorioV1, g.registroId).linhas as unknown as Linha[];
  assert.ok(v1.every(x => x.origem === undefined)); assert.equal(por(v1, 'zincoMg').valor, 4);
  const v2SemCampo = { ...g.relatorioV2 }; delete v2SemCampo.fontesPorNutriente;
  assert.ok((lerRelatorioFactual(v2SemCampo, g.registroId).linhas as unknown as Linha[]).every(x => x.origem === undefined));
});

test('M01-C3 Web: origem adulterada em qualquer superfície é recusada, sem completar valor', () => {
  const alterado = JSON.parse(JSON.stringify(g.aoVivo)) as Adulteravel;
  alterado.fontes.nutrientes.calcioMg.contribuintes = 3;
  assert.throws(() => lerAnaliseMicronutrientesFactual(alterado, g.entrada), /interpretar/);
  const rel = JSON.parse(JSON.stringify(g.relatorioV2)) as Adulteravel;
  rel.fontesPorNutriente.nutrientes.zincoMg.fontes[0].quantidade += 1;
  assert.throws(() => lerRelatorioFactual(rel, g.registroId));
  const v1 = { ...JSON.parse(JSON.stringify(g.relatorioV1)), fontesPorNutriente: (g.relatorioV2 as Adulteravel).fontesPorNutriente };
  assert.throws(() => lerRelatorioFactual(v1, g.registroId));
});

test('R4C2-02 Web: resumo histórico lê todos os estados, inclusive INCOMPATIVEL com subtotal conhecido', () => {
  const vivo = aoVivo();
  for (const c of CAMPOS_MICRONUTRIENTES_PLANO) {
    const h = lerLinhaMicronutrienteFactual(g.historico.nutrientes[c.codigo], c.codigo) as unknown as Linha;
    const base = por(vivo, c.codigo);
    assert.deepEqual({ estado: h.estado, valor: h.valor, contagens: h.contagens, causas: h.causas }, { estado: base.estado, valor: base.valor, contagens: base.contagens, causas: base.causas }, c.codigo);
  }
  assert.equal((lerLinhaMicronutrienteFactual(g.historico.nutrientes.manganesMg, 'manganesMg') as unknown as Linha).valor, 6);
});

const paginaHistorico = (ponto: Record<string, unknown>) => lerPaginaHistoricoMicronutrientesFactual({ schemaVersao: 1, itens: [ponto], temMais: false });
const linhasDoHistorico = (ponto: Record<string, unknown>) => Object.values(paginaHistorico(ponto).itens[0]!.nutrientes) as unknown as Linha[];

test('M01-C3 Web: o histórico passa pelo leitor real e concorda com a tabela em estado, valor, contagens, causas e origem', () => {
  const vivo = aoVivo(), hist = linhasDoHistorico(g.historico as unknown as Record<string, unknown>);
  assert.equal(hist.length, CAMPOS_MICRONUTRIENTES_PLANO.length);
  for (const c of CAMPOS_MICRONUTRIENTES_PLANO) assert.deepEqual(por(hist, c.codigo), por(vivo, c.codigo), c.codigo);
  assert.equal(por(hist, 'manganesMg').estado, 'INCOMPATIVEL');
  assert.equal(por(hist, 'manganesMg').valor, 6);
});

test('M01-C1 Web: zero conhecido aparece como valor 0 na tabela, no histórico e no relatório; ausência continua sem valor', () => {
  const vivoZero = lerAnaliseMicronutrientesFactual(g.aoVivoZero, g.entrada).linhas as unknown as Linha[];
  const histZero = linhasDoHistorico(g.zero.historico);
  const relZero = lerRelatorioFactual(g.zero.relatorioV2, g.registroId).linhas as unknown as Linha[];
  const origemTaco = { contribuintes: 1, fontes: [{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 };
  for (const [nome, linhas] of [['tabela', vivoZero], ['historico', histZero], ['relatorio', relZero]] as const) {
    const ferro = por(linhas, 'ferroMg'), calcio = por(linhas, 'calcioMg');
    assert.strictEqual(ferro.valor, 0, `${nome}: zero conhecido deve ser o número 0`);
    assert.equal(ferro.estado, 'COMPLETO', nome);
    assert.deepEqual(ferro.origem, origemTaco, nome);
    assert.strictEqual(calcio.valor, undefined, `${nome}: ausência não pode virar zero`);
    assert.equal(calcio.estado, 'DESCONHECIDO', nome);
    assert.deepEqual(calcio.origem, { contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 }, nome);
  }
});

test('M01 Web: histórico recusa origem adulterada e aceita ponto sem origem (registro anterior)', () => {
  type PontoAdulteravel = Record<string, unknown> & { fontesPorNutriente: { nutrientes: Record<string, { contribuintes: number }> } };
  const ponto = JSON.parse(JSON.stringify(g.historico)) as PontoAdulteravel;
  const sem = JSON.parse(JSON.stringify(g.historico)) as PontoAdulteravel;
  delete (sem as Record<string, unknown>).fontesPorNutriente;
  assert.ok(linhasDoHistorico(sem).every(l => l.origem === undefined));
  ponto.fontesPorNutriente.nutrientes.calcioMg.contribuintes += 1;
  assert.throws(() => paginaHistorico(ponto));
});
