export interface AlvoStagingE2E {
  banco: string;
  host: string;
  remoto: boolean;
}

export function validarAlvoStagingE2E(
  databaseUrl: string | undefined,
  bancoConfirmado: string | undefined,
  permitirRemoto: boolean
): AlvoStagingE2E {
  if (!databaseUrl?.trim()) {
    throw new Error('Informe a URL dedicada da Fase 231. DATABASE_URL corrente nao e reutilizada.');
  }

  const url = new URL(databaseUrl);
  const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!banco || banco !== bancoConfirmado?.trim()) {
    throw new Error(`Banco E2E nao confirmado. Informe E2E_CONFIRMAR_BANCO=${banco || '<nome-do-banco>'}.`);
  }

  if (!/(^|[_-])(test|staging|integracao|integration|e2e)([_-]|$)/i.test(banco)) {
    throw new Error('O banco E2E precisa ser dedicado a test, staging, integracao ou e2e. Producao e recusada.');
  }

  const host = url.hostname.toLowerCase();
  const remoto = !['localhost', '127.0.0.1', '::1'].includes(host);
  if (remoto && !permitirRemoto) {
    throw new Error('Banco E2E remoto exige E2E_CONFIRMAR_REMOTO=SIM.');
  }

  return { banco, host, remoto };
}

export function validarNomeRoleRuntime(role: string | undefined): string {
  const valor = role?.trim() ?? '';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(valor)) {
    throw new Error('E2E_RUNTIME_ROLE deve ser uma role PostgreSQL simples e explicita.');
  }
  return valor;
}
