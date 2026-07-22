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
    status: string;
    origem: string;
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
