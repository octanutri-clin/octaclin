export interface MarcadorExameLaboratorialApi {
  id: string;
  catalogoMarcadorId?: string;
  nome: string;
  valor: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
  limiteInferior?: string;
  limiteSuperior?: string;
  situacaoFaixa?: 'dentro_da_faixa' | 'fora_da_faixa';
}

export interface CatalogoMarcadorExameApi {
  id: string;
  nome: string;
  unidade?: string;
  limiteInferior?: string;
  limiteSuperior?: string;
}

export type CriarCatalogoMarcadorExameEntrada = Omit<CatalogoMarcadorExameApi, 'id'>;

export interface PaginaCatalogoMarcadoresExamesApi {
  itens: CatalogoMarcadorExameApi[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ColetaExameLaboratorialApi {
  id: string;
  coletadaEm: string;
  recebidaEm?: string;
  laboratorio?: string;
  observacoes?: string;
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
  marcadores: MarcadorExameLaboratorialApi[];
}

export interface CriarMarcadorExameLaboratorialEntrada {
  catalogoMarcadorId?: string;
  nome: string;
  valor: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
  limiteInferior?: string | null;
  limiteSuperior?: string | null;
}

export interface CriarColetaExameLaboratorialEntrada {
  coletadaEm: string;
  recebidaEm?: string;
  laboratorio?: string;
  observacoes?: string;
  marcadores: CriarMarcadorExameLaboratorialEntrada[];
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
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

export async function listarCatalogoMarcadoresExames(pagina = 1): Promise<PaginaCatalogoMarcadoresExamesApi> {
  const resposta = await fetch(`/api/exames/marcadores?pagina=${pagina}&limite=100`, { cache: 'no-store' });
  return lerResposta<PaginaCatalogoMarcadoresExamesApi>(resposta);
}

export async function criarCatalogoMarcadorExame(entrada: CriarCatalogoMarcadorExameEntrada): Promise<CatalogoMarcadorExameApi> {
  const resposta = await fetch('/api/exames/marcadores', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entrada)
  });
  return lerResposta<CatalogoMarcadorExameApi>(resposta);
}

export async function arquivarCatalogoMarcadorExame(itemId: string): Promise<void> {
  const resposta = await fetch(`/api/exames/marcadores/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  await lerResposta<{ id: string }>(resposta);
}
