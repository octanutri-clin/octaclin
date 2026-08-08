export interface ContextoComandos {
  papel?: string;
  permissoes: readonly string[];
}

export interface ComandoPaleta {
  id: string;
  rotulo: string;
  descricao: string;
  href: string;
  grupo: 'Navegacao' | 'Acoes';
  permissao: string;
  papeisPermitidos?: readonly string[];
  atalho?: string;
  termos?: readonly string[];
}

export const COMANDOS_PALETA: readonly ComandoPaleta[] = [
  {
    id: 'navegar-dashboard',
    rotulo: 'Hoje',
    descricao: 'Abrir o painel clinico diario',
    href: '/dashboard',
    grupo: 'Navegacao',
    permissao: 'dashboard.ler',
    papeisPermitidos: ['SuperAdmin', 'Professional'],
    atalho: 'G D',
    termos: ['dashboard', 'painel', 'rotina']
  },
  {
    id: 'navegar-agenda',
    rotulo: 'Agenda',
    descricao: 'Consultas, horarios e solicitacoes',
    href: '/agenda',
    grupo: 'Navegacao',
    permissao: 'agenda.consultas.ler',
    atalho: 'G A',
    termos: ['consulta', 'calendario', 'agendamento']
  },
  {
    id: 'navegar-pacientes',
    rotulo: 'Pacientes',
    descricao: 'Buscar carteira e abrir prontuarios',
    href: '/pacientes',
    grupo: 'Navegacao',
    permissao: 'pacientes.listar',
    atalho: 'G P',
    termos: ['carteira', 'prontuario']
  },
  {
    id: 'navegar-questionarios',
    rotulo: 'Formularios',
    descricao: 'Questionarios, check-ins e respostas',
    href: '/questionarios',
    grupo: 'Navegacao',
    permissao: 'questionarios.ler',
    atalho: 'G F',
    termos: ['formulario', 'questionario', 'checkin']
  },
  {
    id: 'navegar-comunicacoes',
    rotulo: 'Comunicacoes',
    descricao: 'Conversas, canais e mensagens',
    href: '/comunicacoes',
    grupo: 'Navegacao',
    permissao: 'comunicacoes.mensagens.ler',
    atalho: 'G C',
    termos: ['inbox', 'whatsapp', 'email']
  },
  {
    id: 'navegar-automacoes',
    rotulo: 'Automacoes',
    descricao: 'Regras, simulacoes e recall',
    href: '/automacoes',
    grupo: 'Navegacao',
    permissao: 'automacoes.gerenciar',
    atalho: 'G U',
    termos: ['regra', 'recall', 'lembrete']
  },
  {
    id: 'navegar-profissionais',
    rotulo: 'Profissionais',
    descricao: 'Equipe clinica, acessos e agendas',
    href: '/profissionais',
    grupo: 'Navegacao',
    permissao: 'profissionais.ler',
    atalho: 'G E',
    termos: ['equipe', 'profissional', 'acesso']
  },
  {
    id: 'navegar-operacoes',
    rotulo: 'Operacoes',
    descricao: 'Confiabilidade, auditoria e LGPD',
    href: '/operacoes',
    grupo: 'Navegacao',
    permissao: 'operacoes.auditoria.ler',
    papeisPermitidos: ['SuperAdmin'],
    atalho: 'G O',
    termos: ['auditoria', 'lgpd', 'incidente']
  },
  {
    id: 'novo-agendamento',
    rotulo: 'Novo agendamento',
    descricao: 'Abrir a agenda pronta para cadastrar uma consulta',
    href: '/agenda#novo-agendamento',
    grupo: 'Acoes',
    permissao: 'agenda.consultas.criar',
    atalho: 'N A',
    termos: ['agendar', 'consulta', 'horario']
  },
  {
    id: 'novo-paciente',
    rotulo: 'Novo paciente',
    descricao: 'Abrir o cadastro de paciente',
    href: '/pacientes#novo-paciente',
    grupo: 'Acoes',
    permissao: 'pacientes.gerenciar',
    atalho: 'N P',
    termos: ['cadastrar', 'adicionar', 'carteira']
  }
] as const;

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function comandosPermitidos(contexto: ContextoComandos): ComandoPaleta[] {
  return COMANDOS_PALETA.filter((comando) => {
    if (!contexto.permissoes.includes(comando.permissao)) return false;
    return !comando.papeisPermitidos || Boolean(contexto.papel && comando.papeisPermitidos.includes(contexto.papel));
  });
}

export function filtrarComandos(comandos: readonly ComandoPaleta[], busca: string): ComandoPaleta[] {
  const termosBusca = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!termosBusca.length) return [...comandos];

  return comandos.filter((comando) => {
    const palavrasIndice = normalizar([
      comando.rotulo,
      comando.descricao,
      ...(comando.termos ?? [])
    ].join(' ')).split(/\s+/);
    return termosBusca.every((termo) => palavrasIndice.some((palavra) => palavra.startsWith(termo)));
  });
}

export function resolverAtalho(comandos: readonly ComandoPaleta[], teclas: readonly string[]) {
  const atalho = teclas.map(normalizar).join(' ');
  return comandos.find((comando) => comando.atalho && normalizar(comando.atalho) === atalho);
}
