import { randomUUID } from 'node:crypto';
import { construirAnaliseFactual, lerRegistroAnaliseFactual } from './construtor-analise-factual';
import { projetarRegistroFactual } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import { analisarFontesPorNutriente } from '../dominio/fontes-por-nutriente';
import { criarSnapshotMicronutrientes, CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';

const HASH = 'a'.repeat(64);
const meta = { id: randomUUID(), criadoEm: new Date('2026-11-07T12:00:00.000Z') };
const origemVersao = () => ({ planoId: randomUUID(), versaoId: randomUUID(), numero: 1, status: 'publicada' as const, registradaEm: '2026-11-01T12:00:00.000Z' });
const taco = (calcio?: number) => ({
  origem: 'catalogo', codigoOrigem: 'ALIMENTO-SINTETICO-1', descricao: 'Descrição sintética',
  fonte: { codigo: 'taco_nepa_unicamp', nome: 'Nome livre', versao: '4.1', baseCodigo: 'TACO', hashConteudo: HASH, esquemaVersao: 'octaclin-composicao-v2-micros1' },
  nutrientesPor100g: { energiaKcal: 0 }, nutrientesPorcao: { energiaKcal: 0 },
  micronutrientes: criarSnapshotMicronutrientes(calcio === undefined ? {} : { calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100)
});
const manual = (calcio: number) => ({
  origem: 'manual', nutrientesPorcao: { energiaKcal: 0 },
  micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100)
});
const semFonte = (calcio: number) => ({ nutrientesPorcao: { energiaKcal: 0 }, micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100) });
const entrada = (itens: unknown[]) => ({
  escopo: { tenantId: randomUUID(), pacienteId: randomUUID() }, origem: origemVersao(), ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: randomUUID(), ativa: true, selecionada: true, itens: itens.map(snapshot => ({ porcaoGramas: 100, snapshot })) }]
});
const criar = (itens: unknown[]) => construirAnaliseFactual(entrada(itens));

describe('FOOD06 M01 fontes por nutriente nas projeções do registro e do relatório', () => {
  const itens = () => [taco(10), manual(0), taco(), taco(5)];

  it('FT13 projeção do registro traz as origens e reconcilia com a cobertura do mesmo registro', () => {
    const p = projetarRegistroFactual(meta, criar(itens()));
    const calcio = p.fontesPorNutriente.nutrientes.calcioMg;
    expect(calcio.fontes).toEqual([
      { tipo: 'manual', quantidade: 1 },
      { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 2 }
    ]);
    expect(p.fontesPorNutriente.vinculo).toBe('origem_do_registro_de_composicao');
    for (const codigo of CODIGOS_MICRONUTRIENTES) {
      const f = p.fontesPorNutriente.nutrientes[codigo], c = p.analise.cobertura.nutrientes[codigo].contagens;
      expect(f.contribuintes).toBe(c.conhecidos);
      expect(f.fontes.reduce((n, x) => n + x.quantidade, 0) + f.semOrigemDocumentada + f.fontesNaoDetalhadas).toBe(c.conhecidos);
    }
    expect(p.fontesPorNutriente.nutrientes.ferroMg).toEqual({ contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
    expect(p.analise.cobertura.nutrientes.calcioMg).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 15 });
  });

  it('FT13 cálculo ao vivo (snapshots completos) e registro (snapshots projetados) concordam', () => {
    const brutos = itens().map(i => ({ ...i, campoInternoQualquer: 'CANARIO_INTERNO' }));
    const ao_vivo = analisarFontesPorNutriente([{ planoId: 'p', ativo: true, selecionado: true,
      refeicoes: [{ identidadeId: 'r', ativa: true, selecionada: true, itens: brutos }] }]);
    const registro = projetarRegistroFactual(meta, criar(brutos)).fontesPorNutriente;
    expect(registro).toEqual(ao_vivo);
    expect(JSON.stringify(ao_vivo)).not.toContain('CANARIO_INTERNO');
  });

  it('FT07/FT17 é derivado: o registro persistido não ganha campo, não é mutado e relê igual', () => {
    const registro = criar(itens());
    const serializado = JSON.stringify(registro);
    expect(serializado).not.toContain('fontesPorNutriente');
    const antes = projetarRegistroFactual(meta, registro);
    expect(JSON.stringify(registro)).toBe(serializado);
    expect(Object.isFrozen(registro)).toBe(true);
    // Registro gravado antes desta mudança: mesmo conteúdo, relido, produz a mesma projeção.
    const relido = lerRegistroAnaliseFactual(serializado);
    expect(projetarRegistroFactual(meta, relido).fontesPorNutriente).toEqual(antes.fontesPorNutriente);
  });

  it('FT12 legado sem fonte documentada é aceito com incerteza explícita', () => {
    const p = projetarRegistroFactual(meta, criar([semFonte(3), semFonte(0)]));
    expect(p.fontesPorNutriente.nutrientes.calcioMg).toEqual({ contribuintes: 2, fontes: [], semOrigemDocumentada: 2, fontesNaoDetalhadas: 0 });
  });

  it('canário: hash, nome livre, descrição, código do alimento e extras não atravessam', () => {
    const r = JSON.parse(JSON.stringify(criar(itens())));
    r.segredo = 'CANARIO_RAIZ';
    r.versao.estado.refeicoes[0].itens[0].extra = 'CANARIO_ITEM';
    r.versao.estado.refeicoes[0].itens[0].fonte.extra = 'CANARIO_FONTE';
    const json = JSON.stringify(projetarRegistroFactual(meta, r));
    expect(json).not.toMatch(/CANARIO_|aaaaaaaa|Nome livre|Descrição sintética|ALIMENTO-SINTETICO/);
  });

  it('relatório formato 2 transporta as fontes por nutriente; formato 1 e padrão permanecem sem o campo', () => {
    const p = projetarRegistroFactual(meta, criar(itens())), agora = new Date('2026-11-07T13:00:00.000Z');
    const v2 = prepararRelatorioFactual(p, agora, 2);
    expect(v2).toMatchObject({ schemaVersao: 2, motorVersao: 'food06-relatorio-factual-v2' });
    expect((v2 as { fontesPorNutriente?: unknown }).fontesPorNutriente).toEqual(p.fontesPorNutriente);
    expect(v2.analise).toEqual(p.analise);
    for (const v1 of [prepararRelatorioFactual(p, agora), prepararRelatorioFactual(p, agora, 1)]) {
      expect(v1).not.toHaveProperty('fontesPorNutriente');
      expect(v1.schemaVersao).toBe(1);
    }
  });

  it('FT20 nenhuma referência é habilitada pela presença de origem', () => {
    const p = projetarRegistroFactual(meta, criar(itens()));
    expect(p.referencias).toEqual({ estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' });
    expect(JSON.stringify(p.fontesPorNutriente)).not.toMatch(/RDA|AI|UL|percentual|adequa/);
  });
});
