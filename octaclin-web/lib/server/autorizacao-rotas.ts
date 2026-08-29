import {
  MODULOS_CONSOLE,
  moduloConsoleParaRota,
  moduloConsolePermitePapel,
  permissaoExigidaParaRotaConsole
} from '../navegacao-console';

export interface DecisaoAcessoRota {
  permitir: boolean;
  redirecionarPara?: string;
}

const ROTAS_PORTAL = ['/portal'];
const ROTAS_CLIENTE = ['/cliente'];
/** Superficie de conta do proprio usuario: acessivel a qualquer papel autenticado. */
const ROTAS_CONTA = ['/conta'];
function pertenceARota(pathname: string, rotas: readonly string[]) {
  return rotas.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function sanitizarDestinoInicial(valor?: string) {
  if (!valor) return '/dashboard';
  return valor.startsWith('/') && !valor.startsWith('//') ? valor : '/dashboard';
}

function papelPermiteRotaOperacional(pathname: string, papel: string) {
  const modulo = moduloConsoleParaRota(pathname);
  return Boolean(modulo && moduloConsolePermitePapel(modulo, papel));
}

function rotaOperacionalPermitida(pathname: string, papel: string, permissoes?: string[]) {
  const permissaoExigida = permissaoExigidaParaRotaConsole(pathname);
  if (!permissaoExigida || !papelPermiteRotaOperacional(pathname, papel)) return false;
  return !Array.isArray(permissoes) || permissoes.includes(permissaoExigida);
}

export function resolverDestinoPermitido(papel: string, destinoInicial?: string, permissoes?: string[]) {
  if (papel === 'Patient') return '/portal';
  if (papel === 'Client') return '/cliente';

  const destino = sanitizarDestinoInicial(destinoInicial);
  const candidatos = [destino, ...MODULOS_CONSOLE.map((modulo) => modulo.href)];
  return candidatos.find((candidato) => rotaOperacionalPermitida(candidato, papel, permissoes)) ?? '/login';
}

export function decidirAcessoRota(pathname: string, papel?: string, destinoInicial?: string, permissoes?: string[]): DecisaoAcessoRota {
  if (!papel) return { permitir: true };

  if (pertenceARota(pathname, ROTAS_CONTA)) return { permitir: true };

  if (papel === 'Patient') {
    return pertenceARota(pathname, ROTAS_PORTAL) ? { permitir: true } : { permitir: false, redirecionarPara: '/portal' };
  }

  if (papel === 'Client') {
    return pertenceARota(pathname, ROTAS_CLIENTE) ? { permitir: true } : { permitir: false, redirecionarPara: '/cliente' };
  }

  const destino = resolverDestinoPermitido(papel, destinoInicial, permissoes);

  if (pertenceARota(pathname, ROTAS_PORTAL) || pertenceARota(pathname, ROTAS_CLIENTE)) {
    return { permitir: false, redirecionarPara: destino };
  }

  const permissaoExigida = permissaoExigidaParaRotaConsole(pathname);
  if (permissaoExigida && !rotaOperacionalPermitida(pathname, papel, permissoes)) {
    return { permitir: false, redirecionarPara: destino };
  }

  return { permitir: true };
}
