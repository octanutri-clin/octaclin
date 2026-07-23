import { Logger } from '@nestjs/common';
import { ServicoAuditoria } from './servico-auditoria';
import { UserActionLogOrm } from './user-action-log.orm';

describe('ServicoAuditoria', () => {
  it('deve registrar evento no contexto do tenant', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => ({ persistido: true, ...dados })),
      save: jest.fn(async () => undefined)
    };
    const gerenciador = {
      getRepository: jest.fn().mockReturnValue(repositorio)
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'pacientes.obter_dados_sensiveis',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-123',
      metadados: { origem: 'teste' }
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(gerenciador.getRepository).toHaveBeenCalledWith(UserActionLogOrm);
    expect(repositorio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'pacientes.obter_dados_sensiveis',
        recursoTipo: 'paciente',
        recursoId: 'paciente-1',
        ip: '127.0.0.1',
        userAgent: 'jest',
        metadados: { origem: 'teste', requestId: 'req-123' }
      })
    );
    expect(repositorio.save).toHaveBeenCalledWith(expect.objectContaining({ persistido: true }));
  });

  it('nao deve propagar falha de auditoria para o fluxo principal', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await expect(
      servico.registrar({
        tenantId: 'tenant-1',
        acao: 'profissionais.listar_dados_sensiveis'
      })
    ).resolves.toBeUndefined();

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'auditoria.falha',
        tenantId: 'tenant-1',
        acao: 'profissionais.listar_dados_sensiveis',
        erroNome: 'Error'
      })
    );
    expect(JSON.stringify(loggerWarn.mock.calls[0][0])).not.toContain('banco indisponivel');
    loggerWarn.mockRestore();
  });
});
