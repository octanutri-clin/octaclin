export interface DecisaoAcessoRota {
  permitir: boolean;
  redirecionarPara?: string;
}

const ROTAS_PORTAL = ['/portal'];
const ROTAS_CLIENTE = ['/cliente'];

function pertenceARota(pathname: string, rotas: readonly string[]) {
  return rotas.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function sanitizarDestinoInicial(valor?: string) {
  if (!valor) return '/operacoes';
  return valor.startsWith('/') && !valor.startsWith('//') ? valor : '/operacoes';
}

export function decidirAcessoRota(pathname: string, papel?: string, destinoInicial?: string): DecisaoAcessoRota {
  const destino = sanitizarDestinoInicial(destinoInicial);

  if (!papel) return { permitir: true };

  if (papel === 'Patient') {
    return pertenceARota(pathname, ROTAS_PORTAL) ? { permitir: true } : { permitir: false, redirecionarPara: '/portal' };
  }

  if (papel === 'Client') {
    return pertenceARota(pathname, ROTAS_CLIENTE) ? { permitir: true } : { permitir: false, redirecionarPara: '/cliente' };
  }

  if (pertenceARota(pathname, ROTAS_PORTAL) || pertenceARota(pathname, ROTAS_CLIENTE)) {
    return { permitir: false, redirecionarPara: destino };
  }

  return { permitir: true };
}
