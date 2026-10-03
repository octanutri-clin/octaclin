import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ServicoApiPublica } from './servico-api-publica';

describe('ServicoApiPublica: carteira do profissional', () => {
  it('lista apenas consultas de pacientes sob sua responsabilidade atual', async () => {
    const agenda = {
      listarFeed: jest.fn(async () => [
        { id: 'consulta-propria', tipo: 'consulta', pacienteId: 'paciente-1', profissionalId: 'profissional-1' },
        { id: 'consulta-alheia', tipo: 'consulta', pacienteId: 'paciente-2', profissionalId: 'profissional-1' }
      ])
    };
    const pacientes = { find: jest.fn(async () => [{ id: 'paciente-1' }]) };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === ProfissionalOrm) return { findOne: jest.fn(async () => ({ id: 'profissional-1' })) };
        if (entidade === PacienteOrm) return pacientes;
        throw new Error('Repositorio inesperado');
      })
    };
    const executor = {
      executar: jest.fn((_tenant: string, operacao: (manager: unknown) => Promise<unknown>) => operacao(gerenciador))
    };
    const servico = new ServicoApiPublica({} as never, agenda as never, {} as never, executor as never);
    const contexto = {
      tenantId: 'tenant-1',
      chaveId: 'chave-1',
      profissionalUsuarioId: 'usuario-profissional-1',
      escopos: ['agenda:ler']
    } as const;

    const resposta = await servico.listarConsultas(contexto as never, { pagina: 1, limite: 25 });

    expect(resposta.data).toEqual([expect.objectContaining({ id: 'consulta-propria' })]);
    expect(resposta.meta.total).toBe(1);
    expect(agenda.listarFeed).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Object),
      expect.objectContaining({ papel: 'Professional', usuarioId: 'usuario-profissional-1' })
    );
    expect(pacientes.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' })
    }));
  });
});
