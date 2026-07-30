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
      throw new Error('Falha no servidor web ao autenticar. Recarregue a aplicacao e tente novamente.');
    }

    throw new Error(detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function autenticar(dados: LoginEntrada): Promise<RespostaLoginPublica> {
  return requisitar<RespostaLoginPublica>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
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
  await fetch('/api/auth/sair', { method: 'POST' });
}
