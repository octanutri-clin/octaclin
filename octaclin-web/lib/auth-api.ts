export interface LoginEntrada {
  email: string;
  senha: string;
}

export interface SessaoPublica {
  autenticado: true;
  apiUrl: string;
  tenantSlug: string;
  email: string;
  expiraEm: string;
  papel?: string;
  permissoes: string[];
  escopoDados?: string;
  destinoInicial?: string;
}

export interface RespostaLoginPublica {
  apiUrl: string;
  tenantSlug: string;
  email: string;
  expiraEmSegundos: number;
  papel?: string;
  permissoes: string[];
  escopoDados?: string;
  destinoInicial?: string;
}

export interface DesafioMfaPublico {
  mfaObrigatorio: true;
  modo: 'configurar' | 'verificar';
}

export interface ConfiguracaoMfaPublica {
  segredo: string;
  uri: string;
  expiraEm: string;
}

export interface SessaoAtivaPublica {
  referencia: string;
  criadaEm: string;
  ultimaAtividadeEm: string;
  expiraEm: string;
  estado: 'ativa' | 'revogada' | 'expirada';
  atual: boolean;
}

export interface SessoesPaginadasPublicas {
  itens: SessaoAtivaPublica[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ContextoAcessoPublico {
  papel: string;
  permissoes: string[];
  escopoDados: string;
  destinoInicial: string;
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    let mensagemJson: string | undefined;
    try {
      const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
      mensagemJson = corpo.mensagem ?? corpo.message;
    } catch {
      mensagemJson = undefined;
    }

    if (mensagemJson) {
      throw new Error(mensagemJson);
    }

    if (detalhe.trim().startsWith('<!DOCTYPE html>') || detalhe.trim().startsWith('<html')) {
      throw new Error('Falha no servidor web ao autenticar. Recarregue a aplicação e tente novamente.');
    }

    throw new Error(detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function autenticar(dados: LoginEntrada): Promise<RespostaLoginPublica | DesafioMfaPublico> {
  return requisitar<RespostaLoginPublica | DesafioMfaPublico>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
}

export function obterConfiguracaoMfaLogin(): Promise<ConfiguracaoMfaPublica> {
  return requisitar<ConfiguracaoMfaPublica>('/api/auth/mfa/configuracao-login', { method: 'POST' });
}

export function concluirLoginMfa(codigo: string): Promise<{ destinoInicial?: string; codigosRecuperacao: string[] }> {
  return requisitar('/api/auth/mfa/concluir-login', { method: 'POST', body: JSON.stringify({ codigo }) });
}

export function reautenticar(senha: string): Promise<{ confirmado: true; expiraEmSegundos: number }> {
  return requisitar('/api/auth/reautenticar', { method: 'POST', body: JSON.stringify({ senha }) });
}

export function obterStatusMfa(): Promise<{
  obrigatorio: boolean;
  habilitado: boolean;
  habilitadoEm?: string;
  codigosRecuperacaoDisponiveis: number;
}> {
  return requisitar('/api/auth/mfa');
}

export function iniciarConfiguracaoMfa(): Promise<ConfiguracaoMfaPublica> {
  return requisitar('/api/auth/mfa/configuracao', { method: 'POST' });
}

export function confirmarConfiguracaoMfa(codigo: string): Promise<{ codigosRecuperacao: string[] }> {
  return requisitar('/api/auth/mfa/configuracao/confirmar', { method: 'POST', body: JSON.stringify({ codigo }) });
}

export function regenerarCodigosMfa(): Promise<{ codigosRecuperacao: string[] }> {
  return requisitar('/api/auth/mfa/codigos-recuperacao', { method: 'POST' });
}

export async function removerMfa(): Promise<void> {
  const resposta = await fetch('/api/auth/mfa', { method: 'DELETE' });
  if (!resposta.ok) throw new Error('Não foi possível remover a autenticação multifator.');
}

export async function obterSessao(): Promise<SessaoPublica | null> {
  const resposta = await fetch('/api/auth/session');
  if (resposta.status === 401) return null;
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<SessaoPublica>;
}

export async function obterPermissoes(): Promise<ContextoAcessoPublico> {
  return requisitar<ContextoAcessoPublico>('/api/auth/permissoes');
}

export async function sair(): Promise<void> {
  try {
    await fetch('/api/auth/sair', { method: 'POST' });
  } finally {
    const { purgarDadosPrivadosPwa } = await import('./pwa-private-queue');
    await purgarDadosPrivadosPwa();
  }
}

export async function listarSessoes(pagina = 1): Promise<SessoesPaginadasPublicas> {
  return requisitar<SessoesPaginadasPublicas>(`/api/auth/sessoes?pagina=${pagina}`);
}

export async function encerrarSessao(referencia: string): Promise<void> {
  const resposta = await fetch(`/api/auth/sessoes/${encodeURIComponent(referencia)}`, { method: 'DELETE' });
  if (!resposta.ok) throw new Error('Não foi possível encerrar a sessão.');
}

export async function encerrarOutrasSessoes(): Promise<{ encerradas: number }> {
  return requisitar<{ encerradas: number }>('/api/auth/sessoes/encerrar-outras', { method: 'POST' });
}

export async function encerrarTodasSessoes(): Promise<{ encerradas: number }> {
  const resposta = await requisitar<{ encerradas: number }>('/api/auth/sessoes/encerrar-todas', { method: 'POST' });
  const { purgarDadosPrivadosPwa } = await import('./pwa-private-queue');
  await purgarDadosPrivadosPwa();
  return resposta;
}

export async function limparHistoricoSessoes(): Promise<{ removidos: number }> {
  return requisitar<{ removidos: number }>('/api/auth/sessoes/historico', { method: 'DELETE' });
}
