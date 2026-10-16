export type ResumoNutricionalPlano =
  | { estado: 'sem_snapshot' | 'indisponivel' }
  | {
      estado: 'completo' | 'incompleto';
      energiaKcal?: number;
      proteinasG?: number;
      carboidratosG?: number;
      gordurasG?: number;
    };

const CAMPOS = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;

export function projetarResumoNutricionalPlano(
  snapshot: unknown,
  indisponivel = false
): ResumoNutricionalPlano {
  if (indisponivel) return { estado: 'indisponivel' };
  if (snapshot === undefined) return { estado: 'sem_snapshot' };
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { estado: 'indisponivel' };
  }

  const origem = snapshot as Record<string, unknown>;
  const valores: Partial<Record<(typeof CAMPOS)[number], number>> = {};
  let completo = true;
  for (const campo of CAMPOS) {
    const valor = origem[campo];
    if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {
      valores[campo] = valor;
    } else {
      completo = false;
    }
  }

  return { estado: completo ? 'completo' : 'incompleto', ...valores };
}

/** Soma exclusivamente nutrientes já preservados nos snapshots dos itens
 * efetivos; não consulta catálogo, meta, substituições ou consumo do paciente. */
export function resumirNutrientesItensEfetivos(itens: unknown[]): ResumoNutricionalPlano {
  const valores: Partial<Record<(typeof CAMPOS)[number], number>> = {};
  for (const campo of CAMPOS) {
    let soma = 0;
    let completo = true;
    for (const item of itens) {
      const valor = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string,unknown>)[campo] : undefined;
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) { completo = false; break; }
      soma += valor;
      if (!Number.isFinite(soma)) { completo = false; break; }
    }
    if (completo) valores[campo] = soma;
  }
  return {estado: CAMPOS.every(c => valores[c] !== undefined) ? 'completo' : 'incompleto', ...valores};
}
