import type { PapelUsuario } from './usuario-autenticado';

export type EscopoDados = 'tenant_total' | 'pacientes_responsaveis' | 'operacional_delegado' | 'proprio_paciente';

export type PermissaoOctaClin =
  | 'console.acessar'
  | 'operacoes.auditoria.ler'
  | 'operacoes.outbox.reprocessar'
  | 'profissionais.ler'
  | 'profissionais.gerenciar'
  | 'pacientes.listar'
  | 'pacientes.ler'
  | 'pacientes.gerenciar'
  | 'questionarios.ler'
  | 'questionarios.gerenciar'
  | 'agenda.consultas.ler'
  | 'agenda.consultas.criar'
  | 'comunicacoes.canais.gerenciar'
  | 'comunicacoes.templates.gerenciar'
  | 'comunicacoes.mensagens.ler'
  | 'comunicacoes.mensagens.enviar'
  | 'automacoes.gerenciar'
  | 'ia.executar'
  | 'mobile.operar'
  | 'gamificacao.gerenciar'
  | 'portal.acessar'
  | 'portal.agenda.ler_propria'
  | 'portal.questionarios.responder'
  | 'portal.comunicacoes.ler_proprias'
  | 'portal.materiais.ler'
  | 'portal.perfil.gerenciar';

const permissoesPaciente = [
  'portal.acessar',
  'portal.agenda.ler_propria',
  'portal.questionarios.responder',
  'portal.comunicacoes.ler_proprias',
  'portal.materiais.ler',
  'portal.perfil.gerenciar'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesColaborador = [
  'console.acessar',
  'pacientes.listar',
  'pacientes.ler',
  'pacientes.gerenciar',
  'questionarios.ler',
  'questionarios.gerenciar',
  'agenda.consultas.ler',
  'agenda.consultas.criar',
  'comunicacoes.mensagens.ler',
  'comunicacoes.mensagens.enviar',
  'automacoes.gerenciar',
  'ia.executar',
  'mobile.operar',
  'gamificacao.gerenciar'
] as const satisfies readonly PermissaoOctaClin[];

const permissoesProfissional = [
  ...permissoesColaborador,
  'profissionais.ler',
  'comunicacoes.canais.gerenciar',
  'comunicacoes.templates.gerenciar'
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
  Patient: permissoesPaciente
};

const destinosIniciais: Record<PapelUsuario, string> = {
  SuperAdmin: '/operacoes',
  Professional: '/agenda',
  Collaborator: '/agenda',
  Patient: '/portal'
};

const escoposDados: Record<PapelUsuario, EscopoDados> = {
  SuperAdmin: 'tenant_total',
  Professional: 'pacientes_responsaveis',
  Collaborator: 'operacional_delegado',
  Patient: 'proprio_paciente'
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
