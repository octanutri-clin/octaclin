import { ControladorOperacoes } from './controlador-operacoes';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';

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

  it('deve exigir leitura para o painel e escrita para reprocessamentos', () => {
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes)).toEqual(['operacoes.auditoria.ler']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarOutbox)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarFalhaComunicacao)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
  });
});
