export type CanalPreferidoPaciente = 'email' | 'whatsapp' | 'telefone';

export interface EnderecoCadastroPacienteApi {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

export interface PerfilCadastroPacienteApi {
  identificacao?: { nomeUso?: string };
  contato?: {
    email?: string;
    telefone?: string;
    canalPreferido?: CanalPreferidoPaciente;
    endereco?: EnderecoCadastroPacienteApi;
  };
  operacao?: {
    origem?: string;
    tags?: string[];
    proximaRevisaoEm?: string;
    responsavel?: { nome?: string; parentesco?: string; contato?: string };
  };
  atualizadoEm?: string;
}

export interface FiscalCadastroPacienteApi {
  nomePagador?: string;
  documentoPagador?: string;
  emailRecibo?: string;
  enderecoCobranca?: EnderecoCadastroPacienteApi;
  atualizadoEm?: string;
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers }
  });
  if (!resposta.ok) throw new Error((await resposta.text()) || `Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<T>;
}

export function obterPerfilCadastroPaciente(pacienteId: string): Promise<PerfilCadastroPacienteApi> {
  return requisitar(`/api/pacientes/${pacienteId}/perfil-cadastro`);
}

export function obterFiscalCadastroPaciente(pacienteId: string): Promise<FiscalCadastroPacienteApi> {
  return requisitar(`/api/pacientes/${pacienteId}/perfil-cadastro/fiscal`);
}

export function salvarSecaoCadastroPaciente<T extends object>(
  pacienteId: string,
  secao: 'identificacao' | 'contato' | 'operacao' | 'fiscal',
  dados: T
): Promise<T> {
  return requisitar(`/api/pacientes/${pacienteId}/perfil-cadastro/${secao}`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });
}
