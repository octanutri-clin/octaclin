export interface SolicitarRecuperacaoSenhaEntrada {
  apiUrl?: string;
  tenantSlug: string;
  email: string;
}

export interface SolicitarRecuperacaoSenhaResposta {
  mensagem: string;
  linkRecuperacao?: string;
}

export interface TokenRecuperacaoSenhaApi {
  email: string;
  expiraEm: string;
}

class ErroApiRecuperacaoSenha extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiRecuperacaoSenha';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    let mensagem = detalhe || `Falha HTTP ${resposta.status}`;
    try {
      const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
      mensagem = corpo.mensagem ?? corpo.message ?? mensagem;
    } catch {
      // Mantem mensagem textual original.
    }
    throw new ErroApiRecuperacaoSenha(resposta.status, mensagem);
  }

  return resposta.json() as Promise<T>;
}

export async function solicitarRecuperacaoSenha(
  entrada: SolicitarRecuperacaoSenhaEntrada
): Promise<SolicitarRecuperacaoSenhaResposta> {
  return requisitar<SolicitarRecuperacaoSenhaResposta>('/api/auth/recuperar-senha', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function validarTokenRecuperacaoSenha(token: string): Promise<TokenRecuperacaoSenhaApi> {
  return requisitar<TokenRecuperacaoSenhaApi>('/api/auth/recuperar-senha/validar', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export async function redefinirSenha(token: string, senha: string): Promise<{ mensagem: string }> {
  return requisitar<{ mensagem: string }>('/api/auth/redefinir-senha', {
    method: 'POST',
    body: JSON.stringify({ token, senha })
  });
}
