import { ControladorOperacoes } from './controlador-operacoes';

describe('ControladorOperacoes', () => {
  it('deve expor alertas operacionais do tenant autenticado', async () => {
    const servicoOperacoes = {
      listarAlertasOperacionais: jest.fn(async () => ({ status: 'atencao', itens: [] }))
    };
    const controlador = new ControladorOperacoes(servicoOperacoes as never);

    await expect(
      controlador.listarAlertasOperacionais({
        tenantId: 'tenant-1',
        usuarioId: 'admin-1',
        papel: 'SuperAdmin',
        emailHash: 'hash',
        permissoes: []
      })
    ).resolves.toEqual({ status: 'atencao', itens: [] });
    expect(servicoOperacoes.listarAlertasOperacionais).toHaveBeenCalledWith('tenant-1');
  });
});
