import { randomUUID } from 'node:crypto';
import { construirAnaliseFactual, type EntradaConstrutorAnaliseFactual, type RegistroAnaliseFactual } from './construtor-analise-factual';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { compararBasesHistoricas, projetarRegistroFactual, projetarResumoHistoricoFactual } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import * as comparacaoReferencias from '../dominio/comparacao-referencias';

// FOOD06 T3b: projeções usam a versão de referência gravada no registro, só por opt-in.
const m = { id: randomUUID(), criadoEm: new Date('2026-11-03T12:00:00.000Z') };
const PLACEHOLDER = { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' };
const contexto = (extra: Record<string, unknown> = {}) => ({ nascimento: '1985-06-15', dataAnalise: '2026-11-03', populacaoReferencia: 'feminina',
  populacaoConfirmada: true, gestacao: 'nao', lactacao: 'nao', aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao', ...extra }) as EntradaConstrutorAnaliseFactual['contexto'];
// `null` = captura sem confirmacoes (undefined acionaria o padrao).
const criar = (comContexto: EntradaConstrutorAnaliseFactual['contexto'] | null = contexto()): RegistroAnaliseFactual => construirAnaliseFactual({
  escopo: { tenantId: randomUUID(), pacienteId: randomUUID() },
  origem: { planoId: randomUUID(), versaoId: randomUUID(), numero: 1, status: 'publicada', registradaEm: '2026-11-01T12:00:00.000Z' },
  ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: randomUUID(), ativa: true, selecionada: true, itens: [{ porcaoGramas: 100, snapshot: { origem: 'manual', nutrientesPorcao: { energiaKcal: 0 },
    micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 500 } }, 100, 100) } }] }],
  ...(comContexto ? { contexto: comContexto } : {})
});
const clonar = (r: RegistroAnaliseFactual): any => JSON.parse(JSON.stringify(r));
// Registro gravado antes da T3b, com contexto confirmado e sem versão de referência.
const legadoV1 = () => {
  const r = clonar(criar()); r.schemaVersao = 1; r.motorVersao = 'food06-registro-factual-v1'; r.referencias = { ...PLACEHOLDER }; delete r.versao.bases.referencia;
  return r as RegistroAnaliseFactual;
};

describe('FOOD06 T3b: referencias projetadas do registro factual', () => {
  it('sem opt-in, a projecao continua com o placeholder, inclusive em registro v2', () => {
    expect(projetarRegistroFactual(m, criar()).referencias).toEqual(PLACEHOLDER);
    expect(projetarRegistroFactual(m, criar(null)).referencias).toEqual(PLACEHOLDER);
  });

  it('com opt-in, compara com a versao e o contexto gravados no registro', () => {
    const p: any = projetarRegistroFactual(m, criar(), true);
    expect(p.referencias).toMatchObject({ estado: 'calculado', versaoReferencias: 'dri-hc-2025-11-19-adulto-v1', contextoElegivel: true, motivosContexto: [] });
    expect(p.referencias.fonteReferencias).toMatchObject({ autoridade: 'Health Canada', licenca: 'OGL-Canada' });
    expect(p.referencias.nutrientes).toHaveLength(22);
    const calcio = p.referencias.nutrientes.find((n: any) => n.codigo === 'calcioMg');
    // Feminina, 41 anos na data gravada: RDA 1000 mg, UL 2500 mg.
    expect(calcio.referencia).toMatchObject({ estado: 'comparavel', tipo: 'RDA', valorReferencia: 1000, percentual: 50 });
    expect(calcio.ul).toMatchObject({ estado: 'comparavel', tipo: 'UL', valorReferencia: 2500, posicao: 'abaixo' });
    expect(JSON.stringify(p.referencias)).not.toMatch(/1985-06-15|nascimento|idadeAnos/);
  });

  it('usa o contexto gravado, nao um recalculado: contexto inelegivel fica com o motivo registrado', () => {
    const p: any = projetarRegistroFactual(m, criar(contexto({ gestacao: 'sim' })), true);
    expect(p.referencias).toMatchObject({ estado: 'calculado', contextoElegivel: false, motivosContexto: ['gestacao_fora_do_escopo'] });
  });

  it('registro v1 (antigo ou sem contexto) fica indisponivel com motivo, sem recalcular', () => {
    const espiao = jest.spyOn(comparacaoReferencias, 'compararAnaliseComReferencias');
    try {
      for (const r of [legadoV1(), criar(null)]) {
        expect(projetarRegistroFactual(m, r, true).referencias).toEqual({ estado: 'indisponivel', motivo: 'registro_sem_referencias' });
      }
      expect(espiao).not.toHaveBeenCalled();
    } finally { espiao.mockRestore(); }
  });

  it('versao gravada diferente da conhecida nunca e recalculada com a atual', () => {
    const r = clonar(criar()); r.referencias.versao = 'dri-hc-2030-01-01-adulto-v9';
    const espiao = jest.spyOn(comparacaoReferencias, 'compararAnaliseComReferencias');
    try {
      expect(projetarRegistroFactual(m, r, true).referencias).toEqual({ estado: 'indisponivel', motivo: 'versao_referencias_indisponivel' });
      expect(espiao).not.toHaveBeenCalled();
    } finally { espiao.mockRestore(); }
  });

  it('historico: placeholder sem opt-in e comparacao com opt-in', () => {
    const r = criar();
    expect(projetarResumoHistoricoFactual(m, r).referencias).toEqual(PLACEHOLDER);
    expect(projetarResumoHistoricoFactual(m, r, compararBasesHistoricas(r), false, false).referencias).toEqual(PLACEHOLDER);
    expect(projetarResumoHistoricoFactual(m, r, compararBasesHistoricas(r), false, false, true).referencias).toMatchObject({ estado: 'calculado', contextoElegivel: true });
    expect(projetarResumoHistoricoFactual(m, legadoV1(), compararBasesHistoricas(legadoV1()), false, false, true).referencias)
      .toEqual({ estado: 'indisponivel', motivo: 'registro_sem_referencias' });
  });

  it('historico: a dimensao referencia passa a ser comparavel entre registros v2', () => {
    expect(compararBasesHistoricas(criar(), criar()).referencia).toBe('IGUAL');
    expect(compararBasesHistoricas(criar(), legadoV1()).referencia).toBe('NAO_COMPARAVEL');
    expect(compararBasesHistoricas(legadoV1(), legadoV1()).referencia).toBe('NAO_COMPARAVEL');
  });

  it('relatorio: so o formato 2 com opt-in leva a comparacao; formato 1 recusa a flag', () => {
    const comRef = projetarRegistroFactual(m, criar(), true), semRef = projetarRegistroFactual(m, criar());
    expect((prepararRelatorioFactual(comRef, new Date(), 2, false, true) as any).referencias).toMatchObject({ estado: 'calculado' });
    expect(prepararRelatorioFactual(semRef, new Date(), 2).referencias).toEqual(PLACEHOLDER);
    // Projeção com referências sem pedir no relatório não vaza a comparação.
    expect(prepararRelatorioFactual(comRef, new Date(), 2).referencias).toEqual(PLACEHOLDER);
    expect(prepararRelatorioFactual(comRef, new Date(), 1).referencias).toEqual(PLACEHOLDER);
    expect(() => prepararRelatorioFactual(comRef, new Date(), 1, false, true)).toThrow();
  });
});
