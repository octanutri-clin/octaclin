import type { PapelUsuario } from './usuario-autenticado';

export type EscopoDados = 'tenant_total' | 'pacientes_responsaveis' | 'operacional_delegado' | 'proprio_paciente' | 'conta_cliente';

export type PermissaoOctaClin =
  | 'console.acessar'
  | 'dashboard.ler'
  | 'operacoes.auditoria.ler'
  | 'operacoes.outbox.reprocessar'
  | 'profissionais.ler'
  | 'profissionais.gerenciar'
  | 'pacientes.listar'
  | 'pacientes.ler'
  | 'pacientes.gerenciar'
  | 'planos_alimentares.ler'
  | 'planos_alimentares.gerenciar'
  | 'questionarios.ler'
  | 'questionarios.gerenciar'
  | 'agenda.consultas.ler'
  | 'agenda.consultas.criar'
  | 'agenda.financeiro.ler'
  | 'comunicacoes.canais.gerenciar'
  | 'comunicacoes.templates.gerenciar'
  | 'comunicacoes.mensagens.ler'
  | 'comunicacoes.mensagens.enviar'
  | 'materiais.ler'
  | 'materiais.gerenciar'
  | 'automacoes.gerenciar'
  | 'ia.executar'
  | 'mobile.operar'
  | 'gamificacao.gerenciar'
  | 'portal.acessar'
  | 'portal.agenda.ler_propria'
  | 'portal.questionarios.responder'
  | 'portal.comunicacoes.ler_proprias'
  | 'portal.materiais.ler'
  | 'portal.perfil.gerenciar'
  | 'cliente.acessar'
  | 'cliente.assinatura.ler'
  | 'cliente.usuarios.ler'
  | 'cliente.usuarios.convidar'
  | 'cliente.usuarios.desativar'
  | 'cliente.usuarios.gerenciar'
  | 'cliente.convites.gerenciar'
  | 'cliente.configuracoes.gerenciar';

const permissoesPaciente = [
  'portal.acessar',
  'portal.agenda.ler_propria',
  'portal.questionarios.responder',
  'portal.comunicacoes.ler_proprias',
  'portal.materiais.ler',
  'portal.perfil.gerenciar'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesCliente = [
  'cliente.acessar',
  'cliente.assinatura.ler',
  'cliente.usuarios.ler',
  'cliente.usuarios.convidar',
  'cliente.usuarios.desativar',
  'cliente.usuarios.gerenciar',
  'cliente.convites.gerenciar',
  'cliente.configuracoes.gerenciar',
  // Faturamento e o numero que o dono da clinica olha; quem opera a recepcao
  // registra pagamento (agenda.consultas.criar) mas nao ve o total da casa.
  'agenda.financeiro.ler'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesColaborador = [
  'console.acessar',
  'dashboard.ler',
  'pacientes.listar',
  'pacientes.ler',
  'questionarios.ler',
  'agenda.consultas.ler',
  'agenda.consultas.criar',
  'comunicacoes.mensagens.ler',
  'comunicacoes.mensagens.enviar',
  'materiais.ler'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesProfissional = [
  ...permissoesColaborador,
  'pacientes.gerenciar',
  'planos_alimentares.ler',
  'planos_alimentares.gerenciar',
  'questionarios.gerenciar',
  'materiais.gerenciar',
  'profissionais.ler',
  'comunicacoes.canais.gerenciar',
  'comunicacoes.templates.gerenciar',
  'automacoes.gerenciar',
  'ia.executar',
  'mobile.operar',
  'gamificacao.gerenciar',
  'agenda.financeiro.ler'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesSuperAdmin = [
  ...permissoesProfissional,
  'operacoes.auditoria.ler',
  'operacoes.outbox.reprocessar',
  'profissionais.gerenciar'
] as const satisfies readonly PermissaoOctaClin[];

const matrizPermissoes: Record<PapelUsuario, readonly PermissaoOctaClin[]> = {
  SuperAdmin: permissoesSuperAdmin,
  Professional: permissoesProfissional,
  Collaborator: permissoesColaborador,
  Patient: permissoesPaciente,
  Client: permissoesCliente
};

const destinosIniciais: Record<PapelUsuario, string> = {
  SuperAdmin: '/dashboard',
  Professional: '/dashboard',
  Collaborator: '/dashboard',
  Patient: '/portal',
  Client: '/cliente'
};

const escoposDados: Record<PapelUsuario, EscopoDados> = {
  SuperAdmin: 'tenant_total',
  Professional: 'pacientes_responsaveis',
  Collaborator: 'operacional_delegado',
  Patient: 'proprio_paciente',
  Client: 'conta_cliente'
};

export function obterPermissoesPorPapel(papel: PapelUsuario): PermissaoOctaClin[] {
  return [...matrizPermissoes[papel]];
}

export function possuiPermissao(papel: PapelUsuario, permissao: PermissaoOctaClin): boolean {
  return matrizPermissoes[papel].includes(permissao);
}

export function destinoInicialPorPapel(papel: PapelUsuario): string {
  return destinosIniciais[papel];
}

export function escopoDadosPorPapel(papel: PapelUsuario): EscopoDados {
  return escoposDados[papel];
}

export function contextoAcessoPorPapel(papel: PapelUsuario) {
  return {
    papel,
    permissoes: obterPermissoesPorPapel(papel),
    escopoDados: escopoDadosPorPapel(papel),
    destinoInicial: destinoInicialPorPapel(papel)
  };
}
