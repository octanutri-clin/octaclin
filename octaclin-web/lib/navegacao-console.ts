export type PapelOctaClin = 'SuperAdmin' | 'Professional' | 'Collaborator' | 'Patient' | 'Client';

export const GRUPOS_NAVEGACAO_CONSOLE = ['Clínica', 'Relacionamento', 'Administração'] as const;
export type GrupoNavegacaoConsole = typeof GRUPOS_NAVEGACAO_CONSOLE[number];

export type IconeModuloConsole =
  | 'dashboard'
  | 'agenda'
  | 'pacientes'
  | 'formularios'
  | 'comunicacoes'
  | 'automacoes'
  | 'ia'
  | 'gamificacao'
  | 'profissionais'
  | 'operacoes';

export interface ModuloConsole {
  id: string;
  href: string;
  rotulo: string;
  descricao: string;
  grupo: GrupoNavegacaoConsole;
  permissao: string;
  permissaoDetalhe?: string;
  rotasEspecificas?: readonly {
    padrao: RegExp;
    permissao: string;
  }[];
  papeisPermitidos?: readonly PapelOctaClin[];
  atalho: string;
  termos: readonly string[];
  icone: IconeModuloConsole;
}

export interface ContextoNavegacaoConsole {
  papel?: string;
  permissoes: readonly string[];
}

export const MODULOS_CONSOLE: readonly ModuloConsole[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    rotulo: 'Hoje',
    descricao: 'Abrir o painel clínico diário',
    grupo: 'Clínica',
    permissao: 'dashboard.ler',
    papeisPermitidos: ['SuperAdmin', 'Professional'],
    atalho: 'G D',
    termos: ['dashboard', 'painel', 'rotina'],
    icone: 'dashboard'
  },
  {
    id: 'agenda',
    href: '/agenda',
    rotulo: 'Agenda',
    descricao: 'Consultas, horários e solicitações',
    grupo: 'Clínica',
    permissao: 'agenda.consultas.ler',
    atalho: 'G A',
    termos: ['consulta', 'calendário', 'agendamento'],
    icone: 'agenda'
  },
  {
    id: 'pacientes',
    href: '/pacientes',
    rotulo: 'Pacientes',
    descricao: 'Buscar carteira e abrir prontuários',
    grupo: 'Clínica',
    permissao: 'pacientes.listar',
    permissaoDetalhe: 'pacientes.ler',
    rotasEspecificas: [
      { padrao: /^\/pacientes\/novo$/, permissao: 'pacientes.gerenciar' },
      { padrao: /^\/pacientes\/[^/]+\/editar$/, permissao: 'pacientes.gerenciar' }
    ],
    atalho: 'G P',
    termos: ['carteira', 'prontuário'],
    icone: 'pacientes'
  },
  {
    id: 'questionarios',
    href: '/questionarios',
    rotulo: 'Formulários',
    descricao: 'Questionários, check-ins e respostas',
    grupo: 'Clínica',
    permissao: 'questionarios.ler',
    atalho: 'G F',
    termos: ['formulário', 'questionário', 'check-in'],
    icone: 'formularios'
  },
  {
    id: 'ia',
    href: '/ia',
    rotulo: 'IA assistida',
    descricao: 'Revisar sugestões clínicas assistidas',
    grupo: 'Clínica',
    permissao: 'ia.executar',
    papeisPermitidos: ['SuperAdmin', 'Professional'],
    atalho: 'G I',
    termos: ['inteligência', 'sentimento', 'reconhecimento', 'revisão'],
    icone: 'ia'
  },
  {
    id: 'comunicacoes',
    href: '/comunicacoes',
    rotulo: 'Comunicações',
    descricao: 'Conversas, canais e mensagens',
    grupo: 'Relacionamento',
    permissao: 'comunicacoes.mensagens.ler',
    atalho: 'G C',
    termos: ['conversas', 'whatsapp', 'e-mail'],
    icone: 'comunicacoes'
  },
  {
    id: 'automacoes',
    href: '/automacoes',
    rotulo: 'Automações',
    descricao: 'Regras, simulações e retorno de pacientes',
    grupo: 'Relacionamento',
    permissao: 'automacoes.gerenciar',
    atalho: 'G U',
    termos: ['regra', 'retorno', 'lembrete'],
    icone: 'automacoes'
  },
  {
    id: 'gamificacao',
    href: '/gamificacao',
    rotulo: 'Metas e adesão',
    descricao: 'Configurar metas, conquistas e adesão',
    grupo: 'Relacionamento',
    permissao: 'gamificacao.gerenciar',
    papeisPermitidos: ['SuperAdmin', 'Professional'],
    atalho: 'G M',
    termos: ['gamificação', 'meta', 'conquista', 'adesão'],
    icone: 'gamificacao'
  },
  {
    id: 'profissionais',
    href: '/profissionais',
    rotulo: 'Profissionais',
    descricao: 'Equipe clínica, acessos e agendas',
    grupo: 'Administração',
    permissao: 'profissionais.ler',
    atalho: 'G E',
    termos: ['equipe', 'profissional', 'acesso'],
    icone: 'profissionais'
  },
  {
    id: 'operacoes',
    href: '/operacoes',
    rotulo: 'Operações',
    descricao: 'Confiabilidade, auditoria e LGPD',
    grupo: 'Administração',
    permissao: 'operacoes.auditoria.ler',
    papeisPermitidos: ['SuperAdmin'],
    atalho: 'G O',
    termos: ['auditoria', 'lgpd', 'incidente'],
    icone: 'operacoes'
  }
] as const;

const PAPEIS_CONSOLE = ['SuperAdmin', 'Professional', 'Collaborator'] as const;

export function moduloConsolePermitePapel(modulo: ModuloConsole, papel?: string) {
  if (!papel || !PAPEIS_CONSOLE.some((papelConsole) => papelConsole === papel)) return false;
  return !modulo.papeisPermitidos || modulo.papeisPermitidos.some((papelPermitido) => papelPermitido === papel);
}

export function modulosConsolePermitidos(contexto: ContextoNavegacaoConsole): ModuloConsole[] {
  return MODULOS_CONSOLE.filter((modulo) =>
    contexto.permissoes.includes(modulo.permissao) && moduloConsolePermitePapel(modulo, contexto.papel)
  );
}

export function moduloConsoleParaRota(pathname: string) {
  return MODULOS_CONSOLE.find((modulo) => pathname === modulo.href || pathname.startsWith(`${modulo.href}/`));
}

export function permissaoExigidaParaRotaConsole(pathname: string): string | undefined {
  const modulo = moduloConsoleParaRota(pathname);
  if (!modulo) return undefined;
  const rotaEspecifica = modulo.rotasEspecificas?.find((rota) => rota.padrao.test(pathname));
  if (rotaEspecifica) return rotaEspecifica.permissao;
  return pathname !== modulo.href && modulo.permissaoDetalhe ? modulo.permissaoDetalhe : modulo.permissao;
}
