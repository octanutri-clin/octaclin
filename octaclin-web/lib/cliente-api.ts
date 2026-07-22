export type PlanoSaasIdApi = 'gratuito' | 'profissional' | 'clinica' | 'enterprise';
export type RecursoLimitavelSaasApi =
  | 'usuariosAdministrativos'
  | 'pacientes'
  | 'mensagensMes'
  | 'formulariosAtivos'
  | 'armazenamentoMb';

export interface ResumoPortalClienteApi {
  conta: {
    tenantId: string;
    nome: string;
    slug: string;
    status: string;
    criadoEm: string;
    atualizadoEm: string;
  };
  assinatura: {
    plano: string;
    planoId: PlanoSaasIdApi;
    status: string;
    origem: string;
    renovacaoEm?: string;
    limites: Record<RecursoLimitavelSaasApi, number | null>;
    uso: Record<RecursoLimitavelSaasApi, number>;
    alertas: {
      recurso: RecursoLimitavelSaasApi;
      uso: number;
      limite: number;
      percentual: number;
      status: 'atencao' | 'excedido';
    }[];
  };
  usuarios: {
    totalAtivos: number;
    clientes: number;
    profissionais: number;
    pacientes: number;
  };
  acesso: {
    usuarioId: string;
    papel: 'Client';
    escopoDados: string;
    destinoInicial: string;
  };
}

export interface ConfiguracoesPortalClienteApi {
  tenantId: string;
  nome: string;
  slug: string;
  status: string;
  timezone: string;
  idioma: 'pt-BR' | 'en-US' | 'es';
  canaisPadrao: {
    email: boolean;
    whatsapp: boolean;
    googleCalendar: boolean;
  };
  marca: {
    nomeExibido: string;
    emailRemetente: string;
    corPrimaria: string;
  };
  atualizadoEm: string;
}

export type AtualizarConfiguracoesClienteEntrada = Omit<ConfiguracoesPortalClienteApi, 'tenantId' | 'slug' | 'status' | 'atualizadoEm'>;

export interface PerfilEmpresaClienteApi {
  tenantId: string;
  tipoPessoa: 'pf' | 'pj';
  documento: string;
  nomeLegal: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  responsavel: {
    nome: string;
    email: string;
    telefone: string;
    cargo: string;
  };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    pais: string;
  };
  contatos: {
    emailFinanceiro: string;
    telefoneFinanceiro: string;
    whatsappAtendimento: string;
    emailAtendimento: string;
  };
  fiscal: {
    prepararRecibos: boolean;
    observacoes: string;
  };
  atualizadoEm: string;
}

export type AtualizarPerfilEmpresaClienteEntrada = Omit<PerfilEmpresaClienteApi, 'tenantId' | 'atualizadoEm'>;

export type PapelUsuarioClienteApi = 'Client' | 'Professional' | 'Collaborator';
export type PapelUsuarioClienteCriavelApi = 'Professional' | 'Collaborator';

export interface UsuarioClienteApi {
  id: string;
  tenantId: string;
  email: string;
  role: PapelUsuarioClienteApi;
  ativo: boolean;
  ultimoLoginEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  convite?: {
    expiraEm: string;
    linkPrimeiroAcesso?: string;
  };
}

export interface RespostaUsuariosClienteApi {
  itens: UsuarioClienteApi[];
  total: number;
}

export interface ConviteUsuarioClienteApi {
  id: string;
  usuarioId: string;
  tenantId: string;
  email: string;
  role: PapelUsuarioClienteApi;
  status: string;
  expiraEm: string;
  criadoEm: string;
  criadoPorUsuarioId?: string;
  emailErro?: string;
}

export interface RespostaConvitesUsuarioClienteApi {
  itens: ConviteUsuarioClienteApi[];
  total: number;
}

export interface HistoricoConviteUsuarioClienteApi extends ConviteUsuarioClienteApi {
  usadoEm?: string;
  revogadoEm?: string;
  convidadoEm?: string;
  reenviadoPorUsuarioId?: string;
  revogadoPorUsuarioId?: string;
  motivoRevogacao?: string;
}

export interface RespostaHistoricoConvitesUsuarioClienteApi {
  itens: HistoricoConviteUsuarioClienteApi[];
  total: number;
}

export interface CriarUsuarioClienteEntrada {
  email: string;
  role: PapelUsuarioClienteCriavelApi;
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const texto = await resposta.text();
  try {
    const corpo = JSON.parse(texto) as { mensagem?: string; message?: string };
    return corpo.mensagem ?? corpo.message ?? `Falha HTTP ${resposta.status}`;
  } catch {
    return texto || `Falha HTTP ${resposta.status}`;
  }
}

export async function obterResumoPortalCliente(): Promise<ResumoPortalClienteApi> {
  const resposta = await fetch('/api/cliente/resumo', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<ResumoPortalClienteApi>;
}

export async function obterConfiguracoesCliente(): Promise<ConfiguracoesPortalClienteApi> {
  const resposta = await fetch('/api/cliente/configuracoes', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<ConfiguracoesPortalClienteApi>;
}

export async function atualizarConfiguracoesCliente(entrada: AtualizarConfiguracoesClienteEntrada): Promise<ConfiguracoesPortalClienteApi> {
  const resposta = await fetch('/api/cliente/configuracoes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<ConfiguracoesPortalClienteApi>;
}

export async function obterPerfilEmpresaCliente(): Promise<PerfilEmpresaClienteApi> {
  const resposta = await fetch('/api/cliente/perfil-empresa', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<PerfilEmpresaClienteApi>;
}

export async function atualizarPerfilEmpresaCliente(entrada: AtualizarPerfilEmpresaClienteEntrada): Promise<PerfilEmpresaClienteApi> {
  const resposta = await fetch('/api/cliente/perfil-empresa', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<PerfilEmpresaClienteApi>;
}

export async function listarUsuariosCliente(): Promise<RespostaUsuariosClienteApi> {
  const resposta = await fetch('/api/cliente/usuarios', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<RespostaUsuariosClienteApi>;
}

export async function listarConvitesUsuariosCliente(): Promise<RespostaConvitesUsuarioClienteApi> {
  const resposta = await fetch('/api/cliente/usuarios/convites', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<RespostaConvitesUsuarioClienteApi>;
}

export async function listarHistoricoConvitesUsuariosCliente(): Promise<RespostaHistoricoConvitesUsuarioClienteApi> {
  const resposta = await fetch('/api/cliente/usuarios/convites/historico', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<RespostaHistoricoConvitesUsuarioClienteApi>;
}

export async function criarUsuarioCliente(entrada: CriarUsuarioClienteEntrada): Promise<UsuarioClienteApi> {
  const resposta = await fetch('/api/cliente/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<UsuarioClienteApi>;
}

export async function desativarUsuarioCliente(id: string): Promise<void> {
  const resposta = await fetch(`/api/cliente/usuarios/${id}`, { method: 'DELETE' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
}

export async function reenviarConviteUsuarioCliente(usuarioId: string): Promise<UsuarioClienteApi> {
  const resposta = await fetch(`/api/cliente/usuarios/${usuarioId}/convite/reenvio`, { method: 'POST' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
  return resposta.json() as Promise<UsuarioClienteApi>;
}

export async function revogarConviteUsuarioCliente(usuarioId: string): Promise<void> {
  const resposta = await fetch(`/api/cliente/usuarios/${usuarioId}/convite`, { method: 'DELETE' });
  if (!resposta.ok) throw new Error(await extrairMensagemErro(resposta));
}
