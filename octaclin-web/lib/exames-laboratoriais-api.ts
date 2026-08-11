export interface MarcadorExameLaboratorialApi {
  id: string;
  nome: string;
  valor: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
}

export interface ColetaExameLaboratorialApi {
  id: string;
  coletadaEm: string;
  recebidaEm?: string;
  laboratorio?: string;
  observacoes?: string;
  marcadores: MarcadorExameLaboratorialApi[];
}

export interface CriarMarcadorExameLaboratorialEntrada {
  nome: string;
  valor: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
}

export interface CriarColetaExameLaboratorialEntrada {
  coletadaEm: string;
  recebidaEm?: string;
  laboratorio?: string;
  observacoes?: string;
  marcadores: CriarMarcadorExameLaboratorialEntrada[];
}

export class ErroApiExamesLaboratoriais extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiExamesLaboratoriais';
  }
}

async function lerResposta<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiExamesLaboratoriais(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function listarExamesLaboratoriais(
  pacienteId: string,
  opcoes: { signal?: AbortSignal } = {}
): Promise<ColetaExameLaboratorialApi[]> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/exames-laboratoriais`, {
    cache: 'no-store',
    signal: opcoes.signal
  });
  return lerResposta<ColetaExameLaboratorialApi[]>(resposta);
}

export async function criarColetaExameLaboratorial(
  pacienteId: string,
  entrada: CriarColetaExameLaboratorialEntrada
): Promise<ColetaExameLaboratorialApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/exames-laboratoriais`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  return lerResposta<ColetaExameLaboratorialApi>(resposta);
}
