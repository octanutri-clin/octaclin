export type TipoFalhaInterface =
  | 'sessao'
  | 'permissao'
  | 'nao_encontrado'
  | 'validacao'
  | 'conflito'
  | 'indisponivel';

export interface FalhaInterface {
  tipo: TipoFalhaInterface;
  mensagem: string;
  recuperavel: boolean;
  status?: number;
}

interface ErroComStatus {
  status?: unknown;
  statusCode?: unknown;
}

const PADRAO_TECNICO = /(?:internal server error|falha http|http\s*\d{3}|cannot\s+(?:get|post|put|patch|delete)|failed to fetch|networkerror|syntaxerror|typeerror|statuscode|stack trace|\/interno\/|<!doctype|<html)/i;

function statusDoErro(erro: unknown): number | undefined {
  if (!erro || typeof erro !== 'object') return undefined;
  const candidato = erro as ErroComStatus;
  const status = candidato.status ?? candidato.statusCode;
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
}

function mensagemDeObjeto(valor: unknown): string | undefined {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return undefined;
  const objeto = valor as Record<string, unknown>;
  for (const chave of ['mensagem', 'message', 'erro', 'error']) {
    const candidato = objeto[chave];
    if (typeof candidato === 'string' && candidato.trim()) return candidato.trim();
    const mensagemAninhada = mensagemDeObjeto(candidato);
    if (mensagemAninhada) return mensagemAninhada;
  }
  return undefined;
}

function mensagemDoErro(erro: unknown): string | undefined {
  const original = erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : undefined;
  if (!original?.trim()) return undefined;
  const texto = original.trim();

  try {
    const mensagemJson = mensagemDeObjeto(JSON.parse(texto));
    return mensagemJson ?? texto;
  } catch {
    return texto;
  }
}

function mensagemEhSegura(mensagem?: string): mensagem is string {
  if (!mensagem) return false;
  const texto = mensagem.trim();
  return Boolean(texto) && texto.length <= 280 && !PADRAO_TECNICO.test(texto) && !/^[{[]/.test(texto);
}

function comTentativa(mensagemPadrao: string) {
  return `${mensagemPadrao.trim().replace(/[.!?]+$/, '')}. Tente novamente.`;
}

export function classificarFalhaInterface(erro: unknown, mensagemPadrao: string): FalhaInterface {
  const status = statusDoErro(erro);
  const mensagemRecebida = mensagemDoErro(erro);
  const mensagemSegura = mensagemEhSegura(mensagemRecebida) ? mensagemRecebida : undefined;

  if (status === 401) {
    return {
      tipo: 'sessao',
      status,
      recuperavel: true,
      mensagem: 'Sua sessão expirou. Entre novamente para continuar.'
    };
  }
  if (status === 403) {
    return {
      tipo: 'permissao',
      status,
      recuperavel: false,
      mensagem: 'Seu perfil não possui permissão para acessar este conteúdo.'
    };
  }
  if (status === 404) {
    return {
      tipo: 'nao_encontrado',
      status,
      recuperavel: false,
      mensagem: 'Este conteúdo não está mais disponível.'
    };
  }
  if (status === 400 || status === 422) {
    return {
      tipo: 'validacao',
      status,
      recuperavel: true,
      mensagem: mensagemSegura ?? 'Confira os dados informados e tente novamente.'
    };
  }
  if (status === 409) {
    return {
      tipo: 'conflito',
      status,
      recuperavel: true,
      mensagem: mensagemSegura ?? 'Os dados foram alterados em outra operação. Atualize e tente novamente.'
    };
  }

  if (status === undefined && mensagemSegura) {
    return { tipo: 'validacao', recuperavel: true, mensagem: mensagemSegura };
  }

  return {
    tipo: 'indisponivel',
    status,
    recuperavel: true,
    mensagem: comTentativa(mensagemPadrao)
  };
}

export function mensagemFalhaInterface(erro: unknown, mensagemPadrao: string): string {
  return classificarFalhaInterface(erro, mensagemPadrao).mensagem;
}
