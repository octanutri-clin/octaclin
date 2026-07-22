import type { PacienteResumo } from './cadastros-api';

export type TipoEventoProntuarioPaciente = 'consulta' | 'formulario' | 'resposta_formulario' | 'mensagem';

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
    ultimoEventoEm?: string;
  };
  linhaDoTempo: EventoProntuarioPacienteApi[];
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
