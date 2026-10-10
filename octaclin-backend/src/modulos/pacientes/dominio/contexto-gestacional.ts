export const ORIGENS_PESO_GESTACIONAL = ['pre_gestacional_medido', 'pre_gestacional_informado', 'inicio_gestacao_medido', 'peso_habitual_informado'] as const;
export interface ReferenciaGestacional {
  pesoKg?: number; alturaCm?: number; origem?: typeof ORIGENS_PESO_GESTACIONAL[number];
  dataPeso?: string; semanasMedida?: number; diasMedida?: number;
  pesoHabitualAnteriorConfirmado?: boolean;
}
export interface ContextoGestacional {
  gestacaoId?: string; referenciaNumero?: number; semanas?: number; dias?: number;
  tipo?: 'unica' | 'multipla' | 'nao_informada'; risco?: 'habitual' | 'alto' | 'nao_informado';
  origemIdadeGestacional?: 'pre_natal' | 'ultrassonografia' | 'dum' | 'nao_informada';
  dataFonteIdadeGestacional?: string; idadeGestacionalInconsistente?: boolean;
}
export const TERMO_GESTACAO = 'acompanhamento_gestacional_v1';
export const TEXTO_TERMO_GESTACAO = 'Autorizo visualizar no portal as medidas, o grafico e a classificacao das avaliacoes atuais e futuras desta gestacao liberadas pela clinica, sem notas internas. Posso revogar este aceite a qualquer momento.';
