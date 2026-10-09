export const METRICAS_COMPARTILHAVEIS_PORTAL = [
  'imc',
  'percentualGordura',
  'massaMagraKg'
] as const;

export type MetricaCompartilhavelPortal = (typeof METRICAS_COMPARTILHAVEIS_PORTAL)[number];

export const DEFINICOES_METRICAS_COMPARTILHAVEIS_PORTAL: ReadonlyArray<{
  id: MetricaCompartilhavelPortal;
  rotulo: string;
  unidade: string;
}> = [
  { id: 'imc', rotulo: 'IMC', unidade: 'kg/m²' },
  { id: 'percentualGordura', rotulo: 'Gordura corporal', unidade: '%' },
  { id: 'massaMagraKg', rotulo: 'Massa magra', unidade: 'kg' }
];
