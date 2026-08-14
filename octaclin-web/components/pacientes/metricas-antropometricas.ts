import type { AvaliacaoAntropometricaApi } from '@/lib/prontuario-api';

export interface MetricaAntropometrica {
  id: string;
  rotulo: string;
  unidade: string;
  casas: number;
  ler: (avaliacao: AvaliacaoAntropometricaApi) => number | undefined;
}

export const METRICAS_ANTROPOMETRICAS: MetricaAntropometrica[] = [
  { id: 'peso', rotulo: 'Peso', unidade: 'kg', casas: 1, ler: (avaliacao) => avaliacao.medidas.pesoKg },
  { id: 'imc', rotulo: 'IMC', unidade: 'kg/m2', casas: 2, ler: (avaliacao) => avaliacao.resultado.imc },
  {
    id: 'gordura',
    rotulo: 'Gordura corporal',
    unidade: '%',
    casas: 1,
    ler: (avaliacao) => avaliacao.resultado.percentualGordura
  },
  {
    id: 'massaMagra',
    rotulo: 'Massa magra',
    unidade: 'kg',
    casas: 1,
    ler: (avaliacao) => avaliacao.resultado.massaMagraKg
  }
];

export function formatarMetricaAntropometrica(valor: number | undefined, casas: number) {
  return valor === undefined
    ? '-'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
