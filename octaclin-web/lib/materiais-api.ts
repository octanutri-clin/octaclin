export type TipoMaterialEducativoApi = 'link' | 'pdf_url' | 'orientacao';
export type StatusEnvioMaterialPacienteApi = 'enviado' | 'visualizado' | 'arquivado';

export interface CriarMaterialEducativoEntrada {
  titulo: string;
  tipo: TipoMaterialEducativoApi;
  categoria?: string;
  resumo?: string;
  url?: string;
  conteudo?: string;
}

export interface MaterialEducativoApi extends CriarMaterialEducativoEntrada {
  id: string;
  tenantId: string;
  criadoPorUsuarioId: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EnviarMaterialPacienteEntrada {
  materialId: string;
  observacao?: string;
}

export interface EnvioMaterialPacienteApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  materialId: string;
  enviadoPorUsuarioId: string;
  titulo: string;
  tipo: TipoMaterialEducativoApi;
  categoria?: string;
  resumo?: string;
  url?: string;
  conteudo?: string;
  observacao?: string;
  status: StatusEnvioMaterialPacienteApi;
  enviadoEm?: string;
  visualizadoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
}

class ErroApiMateriais extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiMateriais';
  }
}

async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, init);
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiMateriais(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }
  return resposta.json() as Promise<T>;
}

export function listarMateriais(): Promise<MaterialEducativoApi[]> {
  return requisitar('/api/materiais', { cache: 'no-store' });
}

export function criarMaterial(entrada: CriarMaterialEducativoEntrada): Promise<MaterialEducativoApi> {
  return requisitar('/api/materiais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
}

export function listarMateriaisPaciente(pacienteId: string): Promise<EnvioMaterialPacienteApi[]> {
  return requisitar(`/api/materiais/pacientes/${encodeURIComponent(pacienteId)}`, { cache: 'no-store' });
}

export function enviarMaterialPaciente(pacienteId: string, entrada: EnviarMaterialPacienteEntrada): Promise<EnvioMaterialPacienteApi> {
  return requisitar(`/api/materiais/pacientes/${encodeURIComponent(pacienteId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
}
