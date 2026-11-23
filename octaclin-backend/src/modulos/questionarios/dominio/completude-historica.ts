export interface ContagemCompletudeHistorica {
  estado: 'disponivel' | 'desconhecido';
  motivo?: 'snapshot_ausente' | 'snapshot_invalido' | 'respostas_incompativeis';
  versaoQuestionario: number | null;
  totalPerguntas: number | null;
  respondidas: number | null;
  obrigatorias: number | null;
  obrigatoriasRespondidas: number | null;
}

export function calcularCompletudeHistorica(
  snapshot: unknown,
  respostas: { perguntaId: string; valor: unknown }[],
  valorPreenchido: (valor: unknown) => boolean
): ContagemCompletudeHistorica {
  return { estado: 'desconhecido', motivo: 'snapshot_ausente', versaoQuestionario: null,
    totalPerguntas: null, respondidas: null, obrigatorias: null, obrigatoriasRespondidas: null };
}
