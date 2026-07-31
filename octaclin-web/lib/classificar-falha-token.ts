export type EstadoFalhaToken = 'sem_token' | 'expirado' | 'nao_encontrado' | 'indisponivel';

interface ErroComStatusHttp extends Error {
  status: number;
}

function temStatusHttp(erro: unknown): erro is ErroComStatusHttp {
  return erro instanceof Error && typeof (erro as { status?: unknown }).status === 'number';
}

export function classificarFalhaToken(
  erro: unknown,
  mensagemPadrao: string
): { tipo: EstadoFalhaToken; mensagem?: string } {
  if (temStatusHttp(erro)) {
    if (erro.status === 410) return { tipo: 'expirado', mensagem: erro.message };
    if (erro.status === 404) return { tipo: 'nao_encontrado', mensagem: erro.message };
    return { tipo: 'indisponivel', mensagem: erro.message };
  }

  return { tipo: 'indisponivel', mensagem: erro instanceof Error ? erro.message : mensagemPadrao };
}
