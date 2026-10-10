export const episodioId = '31300000-0000-4000-8000-000000000001';
export function detalheGestacao() {
  const ponto = (id, referenciaNumero, ganhoKg) => ({
    id, avaliadaEm: '2026-10-10', referenciaNumero, pesoKg: 61.2,
    gestacional: {
      condicao: 'gestante', source_id: 'ms_ufs_2022_semanal_v1', algorithm_version: 'ganho_gestacional_v1',
      contexto: { semanas: 22, dias: 0 }, referencia: { pesoKg: 60, alturaCm: 160, origem: 'peso_habitual_informado' },
      imcReferencia: 23.4375, ganhoKg, semanaCurva: 22, faixa: { minimo: 1.2, maximo: 4.1 }, classificacao: 'dentro', motivos: []
    }
  });
  return {
    id: episodioId, status: 'ativa', versao: 1, numero: 2, compartilhada: false,
    referencia: { pesoKg: 60, alturaCm: 160, origem: 'peso_habitual_informado', pesoHabitualAnteriorConfirmado: true },
    criadoEm: '2026-10-10T12:00:00Z',
    avaliacoes: [ponto('ponto-a', 1, 1.2), ponto('ponto-b', 1, 1.2), ponto('ponto-c', 2, 2)],
    seriesReferencia: [1, 2].map(numero => ({ numero, source_id: 'ms_ufs_2022_semanal_v1', faixas: [{ semana: 22, minimo: 1.2, maximo: 4.1 }] })),
    proximoCursor: '31300000-0000-4000-8000-000000000002'
  };
}
