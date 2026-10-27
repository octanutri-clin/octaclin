export interface EscopoPlanoCopia {
  pacienteId: string;
  planoId: string;
}

export interface PlanoCopiaComLock extends EscopoPlanoCopia {
  modo: 'pessimistic_read' | 'pessimistic_write';
}

export interface EscoposCopiaOrdenados {
  pacientes: Array<{ pacienteId: string; modo: 'pessimistic_read' | 'pessimistic_write' }>;
  planos: PlanoCopiaComLock[];
}

function compararUuid(a: string, b: string): number {
  const esquerdo = a.toLowerCase();
  const direito = b.toLowerCase();
  return esquerdo < direito ? -1 : esquerdo > direito ? 1 : 0;
}

/** Cria um manifesto estável de locks; o destino recebe sempre o lock mais forte. */
export function ordenarEscoposCopia(destino: EscopoPlanoCopia, origens: readonly EscopoPlanoCopia[]): EscoposCopiaOrdenados {
  const pacientes = new Map<string, string>();
  const planos = new Map<string, PlanoCopiaComLock>();
  for (const escopo of [destino, ...origens]) {
    const pacienteKey = escopo.pacienteId.toLowerCase();
    const planoKey = escopo.planoId.toLowerCase();
    pacientes.set(pacienteKey, escopo.pacienteId);
    const existente = planos.get(planoKey);
    if (existente && existente.pacienteId.toLowerCase() !== pacienteKey) {
      throw new Error('Identidade de plano associada a mais de um paciente.');
    }
    planos.set(planoKey, {
      pacienteId: escopo.pacienteId,
      planoId: escopo.planoId,
      modo: planoKey === destino.planoId.toLowerCase() ? 'pessimistic_write' : 'pessimistic_read'
    });
  }
  return {
    pacientes: [...pacientes.entries()].sort(([a], [b]) => compararUuid(a, b)).map(([id, original]) => ({
      pacienteId: original,
      modo: id === destino.pacienteId.toLowerCase() ? 'pessimistic_write' : 'pessimistic_read'
    })),
    planos: [...planos.entries()].sort(([a], [b]) => compararUuid(a, b)).map(([, escopo]) => escopo)
  };
}
