export interface ContagemCompletudeHistorica {
  estado: 'disponivel' | 'desconhecido';
  motivo?: 'snapshot_ausente' | 'snapshot_invalido' | 'respostas_incompativeis';
  versaoQuestionario: number | null;
  totalPerguntas: number | null;
  respondidas: number | null;
  obrigatorias: number | null;
  obrigatoriasRespondidas: number | null;
}

export function completudeDesconhecida(motivo: NonNullable<ContagemCompletudeHistorica['motivo']>): ContagemCompletudeHistorica {
  return { estado: 'desconhecido', motivo, versaoQuestionario: null,
    totalPerguntas: null, respondidas: null, obrigatorias: null, obrigatoriasRespondidas: null };
}

const objeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Só usa a estrutura congelada; o predicado de presença é o mesmo da submissão. */
export function calcularCompletudeHistorica(
  snapshot: unknown,
  respostas: { perguntaId: string; valor: unknown }[],
  valorPreenchido: (valor: unknown) => boolean
): ContagemCompletudeHistorica {
  if (snapshot === null || snapshot === undefined) return completudeDesconhecida('snapshot_ausente');
  if (!objeto(snapshot) || !Number.isSafeInteger(snapshot.versaoQuestionario) || (snapshot.versaoQuestionario as number) < 1 || !Array.isArray(snapshot.perguntas)) return completudeDesconhecida('snapshot_invalido');
  const perguntas: { id: string; obrigatoria: boolean }[] = [];
  const ids = new Set<string>();
  for (const p of snapshot.perguntas) {
    if (!objeto(p) || typeof p.id !== 'string' || !p.id.trim() || typeof p.obrigatoria !== 'boolean' || ids.has(p.id)) return completudeDesconhecida('snapshot_invalido');
    ids.add(p.id); perguntas.push({ id: p.id, obrigatoria: p.obrigatoria });
  }
  const porId = new Map<string, unknown>();
  for (const r of respostas) {
    if (!ids.has(r.perguntaId) || porId.has(r.perguntaId)) return completudeDesconhecida('respostas_incompativeis');
    porId.set(r.perguntaId, r.valor);
  }
  return { estado: 'disponivel', versaoQuestionario: snapshot.versaoQuestionario as number,
    totalPerguntas: perguntas.length, respondidas: perguntas.filter(p => valorPreenchido(porId.get(p.id))).length,
    obrigatorias: perguntas.filter(p => p.obrigatoria).length,
    obrigatoriasRespondidas: perguntas.filter(p => p.obrigatoria && valorPreenchido(porId.get(p.id))).length };
}
