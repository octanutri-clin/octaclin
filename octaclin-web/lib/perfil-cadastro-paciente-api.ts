import { projetarFalhaCadastro, type FalhaPublicaCadastro, type SecaoErroCadastro } from './erros-cadastro.mjs';

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
  identificacao?: {
    nomeUso?: string;
    sexo?: 'feminino' | 'masculino' | 'intersexo' | 'nao_informar';
    condicaoBiologica?: 'nao_gestante' | 'gestante' | 'lactante' | 'menopausa';
  };
  contato?: {
    email?: string;
    telefone?: string;
    ddi?: string;
    celular?: string;
    instagram?: string;
    canalPreferido?: CanalPreferidoPaciente;
    endereco?: EnderecoCadastroPacienteApi;
  };
  operacao?: {
    origem?: string;
    categoria?: string;
    tags?: string[];
    proximaRevisaoEm?: string;
    responsavel?: { nome?: string; parentesco?: string; contato?: string };
  };
  atualizadoEm?: string;
}

export interface FiscalCadastroPacienteApi {
  cpf?: string;
  nomePagador?: string;
  documentoPagador?: string;
  emailRecibo?: string;
  enderecoCobranca?: EnderecoCadastroPacienteApi;
  atualizadoEm?: string;
}

export interface QualidadeEAcessoPacienteApi {
  percentualPreenchido: number;
  secoes: Array<{
    secao: 'identificacao' | 'contato' | 'operacao' | 'fiscal';
    titulo: string;
    camposFaltantes: string[];
    preenchidos: number;
    total: number;
    opcional?: boolean;
  }>;
  possiveisDuplicidades: Array<{
    pacienteId: string;
    nome: string;
    motivos: Array<'nome_e_nascimento' | 'contato' | 'nome'>;
  }>;
  acessoPortal: {
    status: 'nao_convidado' | 'convite_pendente' | 'convite_expirado' | 'convite_revogado' | 'acesso_ativo' | 'acesso_desativado';
    email?: string;
    conviteId?: string;
    conviteCriadoEm?: string;
    conviteExpiraEm?: string;
    conviteAceitoEm?: string;
    conviteRevogadoEm?: string;
    ultimoAcessoEm?: string;
    canalPreferido?: CanalPreferidoPaciente;
    preferencias?: {
      email?: boolean;
      whatsapp?: boolean;
      canalPreferido?: 'email' | 'whatsapp' | 'qualquer';
      horarioPermitido?: { inicio?: string; fim?: string; timezone?: string };
    };
    aceites: Array<{ tipo: string; versao: string; aceitoEm: string }>;
  };
}

export class ErroCadastroPaciente extends Error {
  readonly status?: number;
  constructor(readonly falha: FalhaPublicaCadastro) {
    super(falha.mensagem);
    this.name = 'ErroCadastroPaciente';
    this.status = falha.status;
  }
}

async function falhaPublica(resposta: Response, secao?: SecaoErroCadastro) {
  let corpo: string | undefined;
  try { corpo = await resposta.text(); } catch { /* O status continua autoritativo. */ }
  return new ErroCadastroPaciente(projetarFalhaCadastro(resposta.status, corpo, secao));
}

async function requisitar<T>(caminho: string, init?: RequestInit, secao?: SecaoErroCadastro): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers }
  });
  if (!resposta.ok) throw await falhaPublica(resposta, secao);
  return resposta.json() as Promise<T>;
}

export function obterPerfilCadastroPaciente(pacienteId: string): Promise<PerfilCadastroPacienteApi> {
  return requisitar(`/api/pacientes/${pacienteId}/perfil-cadastro`);
}

export function obterQualidadeEAcessoPaciente(pacienteId: string): Promise<QualidadeEAcessoPacienteApi> {
  return requisitar(`/api/pacientes/${pacienteId}/perfil-cadastro/qualidade-acesso`);
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
  }, secao);
}

export async function atualizarDadosBasicosPaciente(
  pacienteId: string,
  dados: { nome?: string; dataNascimento?: string }
): Promise<void> {
  const resposta = await fetch(`/api/pacientes/${pacienteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!resposta.ok) throw await falhaPublica(resposta, 'basicos');
}
