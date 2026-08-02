import { ServicoExclusaoProcessador } from './servico-exclusao-processador';

describe('ServicoExclusaoProcessador', () => {
  it('executa somente quem obteve a trava transacional', async () => {
    const gerenciador = { query: jest.fn(async () => [{ bloqueado: true }]) };
    const executorTenant = { executar: jest.fn((_tenantId: string, operacao: (manager: typeof gerenciador) => Promise<unknown>) => operacao(gerenciador)) };
    const operacao = jest.fn(async () => 'feito');
    const servico = new ServicoExclusaoProcessador(executorTenant as never);

    await expect(servico.executar('tenant-1', 'google:prof-1', operacao)).resolves.toBe('feito');
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it('nao executa o efeito quando outra instancia ja possui a trava', async () => {
    const gerenciador = { query: jest.fn(async () => [{ bloqueado: false }]) };
    const executorTenant = { executar: jest.fn((_tenantId: string, operacao: (manager: typeof gerenciador) => Promise<unknown>) => operacao(gerenciador)) };
    const operacao = jest.fn(async () => 'feito');
    const servico = new ServicoExclusaoProcessador(executorTenant as never);

    await expect(servico.executar('tenant-1', 'google:prof-1', operacao)).resolves.toBeUndefined();
    expect(operacao).not.toHaveBeenCalled();
  });
});
