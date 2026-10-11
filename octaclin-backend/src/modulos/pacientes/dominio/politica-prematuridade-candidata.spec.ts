import { politicaPrematuridadeCandidata } from './politica-prematuridade-candidata';
describe('política candidata versionada, sem ativação clínica', () => {
  it('mantém PMA 64s0d e muda proposta em 64s1d', () => {
    expect(politicaPrematuridadeCandidata('2024-01-01','2024-08-26',30,0).referenciaProposta).toBe('intergrowth');
    expect(politicaPrematuridadeCandidata('2024-01-01','2024-08-27',30,0).referenciaProposta).toBe('oms_corrigida');
  });
  it('distingue proposta 31s6d de 32s0d e não declara aprovação', () => {
    expect(politicaPrematuridadeCandidata('2024-01-01','2025-01-01',31,6).prazoMesesCorrigidos).toBe(36);
    expect(politicaPrematuridadeCandidata('2024-01-01','2025-01-01',32,0).prazoMesesCorrigidos).toBe(24);
    expect(politicaPrematuridadeCandidata('2024-01-01','2025-01-01',32,0).estado).toBe('proposta_nao_ratificada');
  });
  it('não transforma corrigida negativa em zero, não cobre nascimento', () => {
    const r = politicaPrematuridadeCandidata('2024-01-01','2024-01-02',30,0);
    expect(r.idadeCorrigidaDias).toBe(-69); expect(r.referenciaProposta).toBe('sem_classificacao');
    expect(politicaPrematuridadeCandidata('2024-01-01','2025-01-01',37,0).referenciaProposta).toBe('sem_classificacao');
  });
  it('inclui dia-limite corrigido e muda base no dia seguinte', () => {
    expect(politicaPrematuridadeCandidata('2024-01-01','2026-02-26',32,0).referenciaProposta).toBe('oms_corrigida');
    expect(politicaPrematuridadeCandidata('2024-01-01','2026-02-27',32,0).referenciaProposta).toBe('oms_cronologica');
  });
});
