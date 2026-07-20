import {
  destinoInicialPorPapel,
  escopoDadosPorPapel,
  obterPermissoesPorPapel,
  possuiPermissao
} from './permissoes';

describe('Matriz de permissoes OctaClin', () => {
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

  it('deve separar acesso operacional por perfil profissional', () => {
    expect(possuiPermissao('SuperAdmin', 'operacoes.auditoria.ler')).toBe(true);
    expect(possuiPermissao('Professional', 'operacoes.auditoria.ler')).toBe(false);
    expect(possuiPermissao('Professional', 'agenda.consultas.criar')).toBe(true);
    expect(possuiPermissao('Collaborator', 'profissionais.gerenciar')).toBe(false);
    expect(possuiPermissao('Collaborator', 'comunicacoes.mensagens.enviar')).toBe(true);
  });

  it('deve definir destino inicial por papel para suportar login unificado', () => {
    expect(destinoInicialPorPapel('SuperAdmin')).toBe('/operacoes');
    expect(destinoInicialPorPapel('Professional')).toBe('/agenda');
    expect(destinoInicialPorPapel('Collaborator')).toBe('/agenda');
    expect(destinoInicialPorPapel('Patient')).toBe('/portal');
  });
});
