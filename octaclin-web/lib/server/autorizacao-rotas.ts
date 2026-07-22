export interface DecisaoAcessoRota {
  permitir: boolean;
  redirecionarPara?: string;
}

const ROTAS_PORTAL = ['/portal'];
const ROTAS_CLIENTE = ['/cliente'];
const permissoesRotasOperacionais: Record<string, string> = {
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
  if (!valor) return '/operacoes';
  return valor.startsWith('/') && !valor.startsWith('//') ? valor : '/operacoes';
}

function permissaoExigidaParaRota(pathname: string): string | undefined {
  const entrada = Object.entries(permissoesRotasOperacionais).find(
    ([rota]) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
  return entrada?.[1];
}

export function decidirAcessoRota(pathname: string, papel?: string, destinoInicial?: string, permissoes?: string[]): DecisaoAcessoRota {
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

  const permissaoExigida = permissaoExigidaParaRota(pathname);
  if (permissaoExigida && Array.isArray(permissoes) && !permissoes.includes(permissaoExigida)) {
    return { permitir: false, redirecionarPara: destino };
  }

  return { permitir: true };
}
