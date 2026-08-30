import {
  destinoInicialPorPapel,
  escopoDadosPorPapel,
  obterPermissoesPorPapel,
  possuiPermissao,
  type EscopoDados,
  type PermissaoOctaClin
} from './permissoes';
import type { PapelUsuario } from './usuario-autenticado';

type LinhaMatrizAcesso = {
  papel: PapelUsuario;
  escopo: EscopoDados;
  permitidas: PermissaoOctaClin[];
  negadas: PermissaoOctaClin[];
};

describe('Matriz de permissoes OctaClin', () => {
  it.each<LinhaMatrizAcesso>([
    {
      papel: 'SuperAdmin' as const,
      escopo: 'tenant_total',
      permitidas: ['profissionais.gerenciar', 'operacoes.auditoria.ler'],
      negadas: ['portal.acessar', 'cliente.acessar']
    },
    {
      papel: 'Professional' as const,
      escopo: 'pacientes_responsaveis',
      permitidas: ['pacientes.gerenciar', 'comunicacoes.mensagens.enviar'],
      negadas: ['profissionais.gerenciar', 'operacoes.auditoria.ler']
    },
    {
      papel: 'Collaborator' as const,
      escopo: 'operacional_delegado',
      permitidas: ['pacientes.ler', 'comunicacoes.mensagens.enviar'],
      negadas: ['pacientes.gerenciar', 'profissionais.gerenciar']
    },
    {
      papel: 'Patient' as const,
      escopo: 'proprio_paciente',
      permitidas: ['portal.acessar', 'portal.questionarios.responder'],
      negadas: ['console.acessar', 'pacientes.ler']
    },
    {
      papel: 'Client' as const,
      escopo: 'conta_cliente',
      permitidas: ['cliente.acessar', 'cliente.usuarios.gerenciar'],
      negadas: ['console.acessar', 'pacientes.ler']
    }
  ])(
    'aplica capacidades e escopo de recurso para $papel',
    ({ papel, escopo, permitidas, negadas }) => {
      expect(escopoDadosPorPapel(papel)).toBe(escopo);
      for (const permissao of permitidas) {
        expect(possuiPermissao(papel, permissao)).toBe(true);
      }
      for (const permissao of negadas) {
        expect(possuiPermissao(papel, permissao)).toBe(false);
      }
    }
  );

  it('deve manter paciente restrito ao portal e aos proprios dados', () => {
    const permissoes = obterPermissoesPorPapel('Patient');

    expect(permissoes).toContain('portal.acessar');
    expect(permissoes).toContain('portal.agenda.ler_propria');
    expect(permissoes).not.toContain('console.acessar');
    expect(permissoes).not.toContain('pacientes.listar');
    expect(permissoes).not.toContain('agenda.consultas.criar');
    expect(possuiPermissao('Patient', 'portal.questionarios.responder')).toBe(true);
    expect(possuiPermissao('Patient', 'operacoes.auditoria.ler')).toBe(false);
    expect(escopoDadosPorPapel('Patient')).toBe('proprio_paciente');
  });

  it('deve manter cliente restrito ao portal do cliente e aos dados da conta', () => {
    const permissoes = obterPermissoesPorPapel('Client');

    expect(permissoes).toContain('cliente.acessar');
    expect(permissoes).toContain('cliente.assinatura.ler');
    expect(permissoes).toContain('cliente.usuarios.ler');
    expect(permissoes).toContain('cliente.usuarios.convidar');
    expect(permissoes).toContain('cliente.usuarios.desativar');
    expect(permissoes).toContain('cliente.usuarios.gerenciar');
    expect(permissoes).toContain('cliente.convites.gerenciar');
    expect(permissoes).not.toContain('console.acessar');
    expect(permissoes).not.toContain('portal.acessar');
    expect(permissoes).not.toContain('pacientes.listar');
    expect(possuiPermissao('Client', 'cliente.usuarios.convidar')).toBe(true);
    expect(possuiPermissao('Client', 'agenda.consultas.criar')).toBe(false);
    expect(escopoDadosPorPapel('Client')).toBe('conta_cliente');
  });

  it('deve separar acesso operacional por perfil profissional', () => {
    expect(possuiPermissao('SuperAdmin', 'operacoes.auditoria.ler')).toBe(true);
    expect(possuiPermissao('Professional', 'operacoes.auditoria.ler')).toBe(false);
    expect(possuiPermissao('Professional', 'dashboard.ler')).toBe(true);
    expect(possuiPermissao('Professional', 'agenda.consultas.criar')).toBe(true);
    expect(possuiPermissao('Professional', 'pacientes.gerenciar')).toBe(true);
    expect(possuiPermissao('Professional', 'planos_alimentares.ler')).toBe(true);
    expect(possuiPermissao('Professional', 'planos_alimentares.gerenciar')).toBe(true);
    expect(possuiPermissao('Professional', 'questionarios.gerenciar')).toBe(true);
    expect(possuiPermissao('Collaborator', 'profissionais.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'pacientes.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'planos_alimentares.ler')).toBe(false);
    expect(possuiPermissao('Collaborator', 'planos_alimentares.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'questionarios.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'automacoes.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'ia.executar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'mobile.operar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'gamificacao.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'comunicacoes.mensagens.enviar')).toBe(true);
  });

  it('deve definir destino inicial por papel para suportar login unificado', () => {
    expect(destinoInicialPorPapel('SuperAdmin')).toBe('/dashboard');
    expect(destinoInicialPorPapel('Professional')).toBe('/dashboard');
    expect(destinoInicialPorPapel('Collaborator')).toBe('/dashboard');
    expect(destinoInicialPorPapel('Patient')).toBe('/portal');
    expect(destinoInicialPorPapel('Client')).toBe('/cliente');
  });
});
