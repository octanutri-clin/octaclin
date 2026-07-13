export interface ResultadoAvaliacaoRegra {
  executar: boolean;
  motivos: string[];
}

export function avaliarCondicoes(
  condicoes: Array<Record<string, unknown>>,
  contexto: Record<string, unknown>
): ResultadoAvaliacaoRegra {
  const motivos: string[] = [];

  for (const condicao of condicoes) {
    const campo = String(condicao.campo ?? '');
    const operador = String(condicao.operador ?? 'igual');
    const esperado = condicao.valor;
    const recebido = contexto[campo];
    let ok = false;

    if (operador === 'igual') ok = recebido === esperado;
    if (operador === 'maior_que') ok = Number(recebido) > Number(esperado);
    if (operador === 'maior_ou_igual') ok = Number(recebido) >= Number(esperado);
    if (operador === 'menor_que') ok = Number(recebido) < Number(esperado);
    if (operador === 'inclui') ok = Array.isArray(recebido) && recebido.includes(esperado);

    if (!ok) motivos.push(`Condicao nao atendida: ${campo} ${operador} ${String(esperado)}`);
  }

  return { executar: motivos.length === 0, motivos };
}
