import type { PacienteResumo } from './cadastros-api';

export type TipoEventoProntuarioPaciente = 'consulta' | 'formulario' | 'resposta_formulario' | 'mensagem' | 'evolucao_clinica';
export type TipoEvolucaoClinicaApi = 'consulta' | 'retorno' | 'observacao' | 'ajuste_plano';

export interface EventoProntuarioPacienteApi {
  id: string;
  tipo: TipoEventoProntuarioPaciente;
  titulo: string;
  descricao?: string;
  data: string;
  status?: string;
  origemId?: string;
  metadados?: Record<string, unknown>;
}

export interface ProntuarioPacienteApi {
  paciente: PacienteResumo;
  resumo: {
    consultas: number;
    formulariosPendentes: number;
    respostas: number;
    mensagens: number;
    evolucoes: number;
    ultimoEventoEm?: string;
  };
  linhaDoTempo: EventoProntuarioPacienteApi[];
}

export interface CriarEvolucaoClinicaEntrada {
  titulo: string;
  conteudo: string;
  tipo?: TipoEvolucaoClinicaApi;
  visibilidade?: 'privada';
}

export interface EvolucaoClinicaApi extends CriarEvolucaoClinicaEntrada {
  id: string;
  tenantId: string;
  pacienteId: string;
  autorUsuarioId: string;
  tipo: TipoEvolucaoClinicaApi;
  visibilidade: 'privada';
  criadoEm: string;
  atualizadoEm: string;
}

class ErroApiProntuario extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiProntuario';
  }
}

export async function obterProntuarioPaciente(pacienteId: string): Promise<ProntuarioPacienteApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prontuario`, { cache: 'no-store' });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<ProntuarioPacienteApi>;
}

export async function criarEvolucaoClinica(
  pacienteId: string,
  entrada: CriarEvolucaoClinicaEntrada
): Promise<EvolucaoClinicaApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/evolucoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<EvolucaoClinicaApi>;
}
