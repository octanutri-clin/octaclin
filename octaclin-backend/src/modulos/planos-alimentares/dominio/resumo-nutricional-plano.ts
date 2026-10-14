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
