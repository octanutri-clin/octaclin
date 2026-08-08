import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoProfissionais } from '../aplicacao/servico-profissionais';
import { ControladorProfissionais } from './controlador-profissionais';

describe('ControladorProfissionais', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-admin-1', tenantId: 'tenant-1', papel: 'SuperAdmin', emailHash: 'hash', permissoes: ['profissionais.gerenciar']
  };
  const requisicao = { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown as Request;

  it('audita leitura da lixeira e restauracao de profissional', async () => {
    const listarArquivados = jest.fn().mockResolvedValue({ itens: [], total: 0 });
    const restaurar = jest.fn().mockResolvedValue(undefined);
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorProfissionais(
      { listarArquivados, restaurar } as unknown as ServicoProfissionais,
      { registrar } as unknown as ServicoAuditoria
    );

    await controlador.listarArquivados(usuario, requisicao, 1, 25);
    await controlador.restaurar(usuario, requisicao, 'profissional-1');

    expect(listarArquivados).toHaveBeenCalledWith('tenant-1', 1, 25);
    expect(restaurar).toHaveBeenCalledWith('tenant-1', 'profissional-1');
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'profissionais.lixeira.listar' }));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'profissionais.restaurar', recursoId: 'profissional-1' }));
  });

  it('restringe lixeira e restauracao ao SuperAdmin com permissao de gerenciar', () => {
    for (const metodo of [ControladorProfissionais.prototype.listarArquivados, ControladorProfissionais.prototype.restaurar]) {
      expect(Reflect.getMetadata(CHAVE_PAPEIS, metodo)).toEqual(['SuperAdmin']);
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, metodo)).toEqual(['profissionais.gerenciar']);
    }
  });
});
