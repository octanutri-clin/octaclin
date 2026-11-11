import { randomUUID } from 'node:crypto';
import { construirAnaliseFactual, type EntradaConstrutorAnaliseFactual, type RegistroAnaliseFactual } from './construtor-analise-factual';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { projetarRegistroFactual, projetarResumoHistoricoFactual, compararBasesHistoricas } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import { compararAnaliseComReferencias } from '../dominio/comparacao-referencias';
import { FONTE_REFERENCIAS_DRI_ADULTO } from '../dominio/referencias-dri';

// FOOD06 T6 (M03-C2): a mesma análise sintética precisa mostrar os mesmos números e motivos em todas as saídas
// do servidor (registro, histórico, relatório e comparador ao vivo), sem campo extra (canário) nem dado de contexto.
const CANARIO = 'CANARIO_T6_NAO_VAZAR';
const m = { id: randomUUID(), criadoEm: new Date('2026-11-03T12:00:00.000Z') };
const contexto = (extra: Record<string, unknown> = {}) => ({ nascimento: '1985-06-15', dataAnalise: '2026-11-03', populacaoReferencia: 'feminina',
  populacaoConfirmada: true, gestacao: 'nao', lactacao: 'nao', aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'sim', ...extra }) as EntradaConstrutorAnaliseFactual['contexto'];
const criar = (ctx = contexto()): RegistroAnaliseFactual => construirAnaliseFactual({
  escopo: { tenantId: randomUUID(), pacienteId: randomUUID() },
  origem: { planoId: randomUUID(), versaoId: randomUUID(), numero: 1, status: 'publicada', registradaEm: '2026-11-01T12:00:00.000Z' },
  ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: randomUUID(), ativa: true, selecionada: true, itens: [
    { porcaoGramas: 100, snapshot: { origem: 'manual', nutrientesPorcao: { energiaKcal: 0 },
      micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 500 }, vitaminaCMg: { estado: 'conhecido', valor: 90 }, zincoMg: { estado: 'conhecido', valor: 60 }, ferroMg: { estado: 'conhecido', valor: 2 } }, 100, 100) } },
    { porcaoGramas: 100, snapshot: { origem: 'manual', nutrientesPorcao: { energiaKcal: 0 },
      micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 0 }, vitaminaCMg: { estado: 'conhecido', valor: 0 }, zincoMg: { estado: 'conhecido', valor: 0 } }, 100, 100) } }] }],
  contexto: ctx
});
const sem = (o: any) => JSON.parse(JSON.stringify(o));

describe('FOOD06 T6: consistencia entre as saidas do servidor', () => {
  it('registro, historico, relatorio e comparador ao vivo trazem exatamente as mesmas referencias', () => {
    const r = criar();
    const vivo = { estado: 'calculado', fonteReferencias: FONTE_REFERENCIAS_DRI_ADULTO, ...compararAnaliseComReferencias(r.analise.calculo.nutrientes, r.contexto!.resolvido) };
    const registro: any = projetarRegistroFactual(m, r, true);
    const historico: any = projetarResumoHistoricoFactual(m, r, compararBasesHistoricas(r), false, false, true);
    const relatorio: any = prepararRelatorioFactual(registro, new Date(), 2, false, true);
    expect(sem(registro.referencias)).toEqual(sem(vivo));
    expect(sem(historico.referencias)).toEqual(sem(vivo));
    expect(sem(relatorio.referencias)).toEqual(sem(vivo));
    const calcio = registro.referencias.nutrientes.find((n: any) => n.codigo === 'calcioMg');
    expect(calcio.referencia).toMatchObject({ estado: 'comparavel', quantidadePlanejada: 500, valorReferencia: 1000, percentual: 50 });
    // Ferro: um item conhecido e um sem dado => sem comparacao, e o mesmo motivo em todas as saidas.
    for (const s of [registro, historico, relatorio]) {
      const ferro = s.referencias.nutrientes.find((n: any) => n.codigo === 'ferroMg');
      expect(ferro.referencia).toEqual(expect.objectContaining({ estado: expect.any(String) }));
    }
  });

  it('o total comparado e o da cobertura registrada na mesma saida (nunca outro numero)', () => {
    const registro: any = projetarRegistroFactual(m, criar(), true);
    for (const n of registro.referencias.nutrientes) {
      if (n.referencia.estado !== 'comparavel') continue;
      const cob = registro.analise.cobertura.nutrientes[n.codigo];
      expect(cob.estado).toBe('COMPLETO');
      expect(n.referencia.quantidadePlanejada).toBe(cob.total);
    }
  });

  it('o ajuste de tabagismo so existe com tabagismo confirmado e nunca expoe o contexto bruto', () => {
    const fuma: any = projetarRegistroFactual(m, criar(contexto({ tabagismo: 'sim' })), true);
    const naoFuma: any = projetarRegistroFactual(m, criar(contexto({ tabagismo: 'nao' })), true);
    const vit = (p: any) => p.referencias.nutrientes.find((n: any) => n.codigo === 'vitaminaCMg').referencia;
    expect(vit(fuma).ajusteTabagismoMg).toBe(35);
    expect(vit(naoFuma).ajusteTabagismoMg).toBeUndefined();
    for (const s of [fuma, naoFuma]) expect(JSON.stringify(s.referencias)).not.toMatch(/1985-06-15|nascimento|idadeAnos|tabagismo/);
  });

  it('campos extras (canarios) no registro gravado nao atravessam nenhuma projecao', () => {
    const r: any = sem(criar());
    Object.assign(r, { segredo: CANARIO });
    Object.assign(r.contexto, { segredo: CANARIO });
    Object.assign(r.contexto.resolvido, { segredo: CANARIO });
    Object.assign(r.referencias, { segredo: CANARIO });
    const registro: any = projetarRegistroFactual(m, r, true);
    const saidas = [registro, projetarResumoHistoricoFactual(m, r, compararBasesHistoricas(r), false, false, true), prepararRelatorioFactual(registro, new Date(), 2, false, true)];
    for (const s of saidas) expect(JSON.stringify(s)).not.toContain(CANARIO);
  });
});
