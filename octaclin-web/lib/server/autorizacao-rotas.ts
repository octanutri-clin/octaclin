export interface DecisaoAcessoRota {
  permitir: boolean;
  redirecionarPara?: string;
}

const ROTAS_PORTAL = ['/portal'];
const ROTAS_CLIENTE = ['/cliente'];
const permissoesRotasOperacionais: Record<string, string> = {
  '/dashboard': 'dashboard.ler',
  '/agenda': 'agenda.consultas.ler',
  '/operacoes': 'operacoes.auditoria.ler',
  '/questionarios': 'questionarios.ler',
  '/comunicacoes': 'comunicacoes.mensagens.ler',
  '/automacoes': 'automacoes.gerenciar',
  '/ia': 'ia.executar',
  '/mobile': 'mobile.operar',
  '/gamificacao': 'gamificacao.gerenciar',
  '/pacientes': 'pacientes.listar',
  '/profissionais': 'profissionais.ler'
};

function pertenceARota(pathname: string, rotas: readonly string[]) {
  return rotas.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function sanitizarDestinoInicial(valor?: string) {
  if (!valor) return '/dashboard';
  return valor.startsWith('/') && !valor.startsWith('//') ? valor : '/dashboard';
}

function permissaoExigidaParaRota(pathname: string): string | undefined {
  if (pathname.startsWith('/pacientes/')) return 'pacientes.ler';

  const entrada = Object.entries(permissoesRotasOperacionais).find(
    ([rota]) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
  return entrada?.[1];
}

function papelPermiteRotaOperacional(pathname: string, papel: string) {
  return !pertenceARota(pathname, ['/dashboard']) || papel === 'SuperAdmin' || papel === 'Professional';
}

function rotaOperacionalPermitida(pathname: string, papel: string, permissoes?: string[]) {
  const permissaoExigida = permissaoExigidaParaRota(pathname);
  if (!permissaoExigida || !papelPermiteRotaOperacional(pathname, papel)) return false;
  return !Array.isArray(permissoes) || permissoes.includes(permissaoExigida);
}

export function resolverDestinoPermitido(papel: string, destinoInicial?: string, permissoes?: string[]) {
  if (papel === 'Patient') return '/portal';
  if (papel === 'Client') return '/cliente';

  const destino = sanitizarDestinoInicial(destinoInicial);
  const candidatos = [destino, ...Object.keys(permissoesRotasOperacionais)];
  return candidatos.find((candidato) => rotaOperacionalPermitida(candidato, papel, permissoes)) ?? '/login';
}

export function decidirAcessoRota(pathname: string, papel?: string, destinoInicial?: string, permissoes?: string[]): DecisaoAcessoRota {
  if (!papel) return { permitir: true };

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

  const permissaoExigida = permissaoExigidaParaRota(pathname);
  if (permissaoExigida && !rotaOperacionalPermitida(pathname, papel, permissoes)) {
    return { permitir: false, redirecionarPara: destino };
  }

  return { permitir: true };
}
