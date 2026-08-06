import { EntityManager } from 'typeorm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { registrarNotificacao } from './registrar-notificacao';

function criarGerenciador(opcoes?: {
  usuarios?: Array<{ id: string; role: string }>;
  profissionalDoPaciente?: string;
  usuarioDoProfissional?: string | null;
}) {
  const linhas: Record<string, unknown>[] = [];
  const construtor: Record<string, jest.Mock> = {
    insert: jest.fn(() => construtor),
    into: jest.fn(() => construtor),
    values: jest.fn((valores: Record<string, unknown>[]) => {
      linhas.push(...valores);
      return construtor;
    }),
    orIgnore: jest.fn(() => construtor),
    execute: jest.fn(async () => ({ identifiers: linhas.map(() => ({ id: 'gerado' })) }))
  };

  const repositorioPacientes = {
    findOne: jest.fn(async () =>
      opcoes?.profissionalDoPaciente ? { profissionalResponsavelId: opcoes.profissionalDoPaciente } : null
    )
  };
  const repositorioProfissionais = {
    findOne: jest.fn(async () =>
      opcoes?.usuarioDoProfissional === null ? null : { usuarioId: opcoes?.usuarioDoProfissional ?? 'usuario-ana' }
    )
  };
  const repositorioUsuarios = {
    find: jest.fn(async () => opcoes?.usuarios ?? [{ id: 'usuario-admin', role: 'SuperAdmin' }])
  };

  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === ProfissionalOrm) return repositorioProfissionais;
      if (entidade === UsuarioOrm) return repositorioUsuarios;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    }),
    createQueryBuilder: jest.fn(() => construtor)
  } as unknown as EntityManager;

  return { gerenciador, linhas, construtor, repositorioPacientes, repositorioProfissionais };
}

const evento = {
  tipo: 'mensagem_recebida' as const,
  recursoTipo: 'mensagem_notificacao',
  recursoId: 'mensagem-1'
};

describe('registrarNotificacao', () => {
  it('grava uma linha por destinatario', async () => {
    const { gerenciador, linhas } = criarGerenciador({
      usuarios: [
        { id: 'usuario-admin', role: 'SuperAdmin' },
        { id: 'usuario-colab', role: 'Collaborator' }
      ]
    });

    await expect(registrarNotificacao(gerenciador, 'tenant-1', evento)).resolves.toBe(2);
    expect(linhas.map((linha) => linha.usuarioId)).toEqual(['usuario-admin', 'usuario-colab']);
    expect(linhas.every((linha) => linha.tenantId === 'tenant-1')).toBe(true);
  });

  it('deriva o profissional responsavel a partir do paciente do evento', async () => {
    const { gerenciador, linhas, repositorioPacientes } = criarGerenciador({
      usuarios: [{ id: 'usuario-ana', role: 'Professional' }],
      profissionalDoPaciente: 'profissional-ana',
      usuarioDoProfissional: 'usuario-ana'
    });

    await registrarNotificacao(gerenciador, 'tenant-1', { ...evento, pacienteId: 'paciente-1' });

    expect(repositorioPacientes.findOne).toHaveBeenCalled();
    expect(linhas.map((linha) => linha.usuarioId)).toEqual(['usuario-ana']);
  });

  it('prefere o profissional explicito do evento e nao consulta o paciente', async () => {
    const { gerenciador, repositorioPacientes } = criarGerenciador({
      usuarios: [{ id: 'usuario-ana', role: 'Professional' }]
    });

    await registrarNotificacao(gerenciador, 'tenant-1', {
      ...evento,
      tipo: 'solicitacao_agendamento',
      profissionalId: 'profissional-ana'
    });

    // Solicitacao publica ainda nao tem paciente; o dono vem do link.
    expect(repositorioPacientes.findOne).not.toHaveBeenCalled();
  });

  it('nao escreve nada quando o tenant nao tem destinatario', async () => {
    const { gerenciador, construtor } = criarGerenciador({ usuarios: [] });

    await expect(registrarNotificacao(gerenciador, 'tenant-1', evento)).resolves.toBe(0);
    expect(construtor.execute).not.toHaveBeenCalled();
  });

  it('insere com orIgnore para que reentrega do webhook nao infle o contador', async () => {
    const { gerenciador, construtor } = criarGerenciador();

    await registrarNotificacao(gerenciador, 'tenant-1', evento);

    expect(construtor.orIgnore).toHaveBeenCalled();
  });

  it('ignora profissional arquivado sem usuario vinculado', async () => {
    const { gerenciador, linhas } = criarGerenciador({
      usuarios: [
        { id: 'usuario-admin', role: 'SuperAdmin' },
        { id: 'usuario-ana', role: 'Professional' }
      ],
      profissionalDoPaciente: 'profissional-arquivada',
      usuarioDoProfissional: null
    });

    await registrarNotificacao(gerenciador, 'tenant-1', { ...evento, pacienteId: 'paciente-1' });

    expect(linhas.map((linha) => linha.usuarioId)).toEqual(['usuario-admin']);
  });
});
